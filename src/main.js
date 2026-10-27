const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const UpdatePresets = require('./presets')
const { findContent, describeActive, adjustContent, fingerprintOfEntry } = require('./active')
const { sceneName, scenesSignature } = require('./scenes')
const { networkStatus } = require('./devices')
const { readLocalScenes, readLocalSceneDetail, watchLocalScenes } = require('./localscenes')
const { sceneToControl, sceneOffControl, sceneMatches } = require('./scenecontent')
const { labelText, shortLabel } = require('./labels')
const { normalizeGroups, groupsSignature } = require('./groups')

const REQUEST_TIMEOUT_MS = 5000
const MAX_TRANSIENT_RETRIES = 3
// How long a rotary encoder value counts as current, even if the poll still returns the old state
const DIM_HOLD_MS = 2500
const DIM_FULL = 65535

class VisionControlInstance extends InstanceBase {
	constructor(internal) {
		super(internal)

		this.token = null
		this.tokenExpiresAt = 0
		this.connected = false
		this.scenes = [] // [{ ItemId, Path, Type, Active }]
		this.sceneActive = {} // itemId -> bool
		this.network = { Name: '', Identifier: '' }
		this.pollTimer = null
		this.programmer = null // last state from GET /Control
		this.lastSent = {} // 'group:0' -> { id, fp } catalog effect last sent by the module
		this.refreshTimer = null
		this.fastTimer = null // fast poll of the running state only (GET /Control)
		this.scenesSig = '' // comparison key of the scene list
		this.scenesReadError = null
		this.devices = [] // network devices from GET /Network/Info (including switched-off ones)
		this.devicesReadOk = false
		this.groups = [] // groups from GET /Network/Info: [{ id, name }]
		this.groupsSig = '' // comparison key of the group list
		this.dimPending = {} // 'group:0' -> { value, at } last brightness value from the rotary encoder
		this.dimSending = {} // 'group:0' -> true while a brightness command is in flight
		this.dimMemory = {} // 'group:0' -> brightness before the blackout
		this.sceneApiBroken = false // the app's scene API does not process commands (2.17.3/2.18.4)
	}

	async init(config) {
		this.config = config

		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()

		await this.initConnection()
	}

	async destroy() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = null
		}
		if (this.fastTimer) {
			clearInterval(this.fastTimer)
			this.fastTimer = null
		}
		this.stopSceneWatch()
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer)
			this.refreshTimer = null
		}
		this.token = null
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {
		this.config = config
		await this.initConnection()
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Vision Control',
				value:
					'Controls the Vision Control app via its local REST API. ' +
					'The API must be enabled in the app. Enter host, port and network password below.',
			},
			{ type: 'textinput', id: 'host', label: 'IP address of the app', width: 6, default: '127.0.0.1', regex: Regex.IP },
			{ type: 'textinput', id: 'port', label: 'Port', width: 3, default: '5123', regex: Regex.PORT },
			{ type: 'textinput', id: 'password', label: 'Network password', width: 6 },
			{ type: 'number', id: 'poll', label: 'Poll interval scenes / devices (ms)', width: 3, default: 1000, min: 500, max: 60000 },
			{
				type: 'number',
				id: 'fastPoll',
				label: 'Poll brightness / running effect (ms, 0 = off)',
				tooltip: 'Reads only the running state (GET /Control) so displays pick up changes made in the app quickly.',
				width: 4,
				default: 500,
				min: 0,
				max: 10000,
			},
			{ type: 'textinput', id: 'statusGroup', label: 'Group for status display (GroupID)', width: 4, default: '0' },
			{
				type: 'checkbox',
				id: 'localScenes',
				label: "Read scene names from the app's local scene files if the API does not provide them (only when Companion runs on the same PC)",
				width: 12,
				default: true,
			},
		]
	}

	// ---- Connection / polling -------------------------------------------------

	baseUrl() {
		return `http://${this.config.host}:${this.config.port || 5123}`
	}

	async initConnection() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = null
		}
		if (this.fastTimer) {
			clearInterval(this.fastTimer)
			this.fastTimer = null
		}
		this.stopSceneWatch()
		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'No IP address set')
			return
		}
		this.updateStatus(InstanceStatus.Connecting)
		this.token = null
		this.sceneApiBroken = false // after reconnecting (possibly a new app version) try the API first again
		// Polling always runs, even if the app is not reachable at startup
		// (e.g. after an app update with the API still disabled). Otherwise the
		// module would stay "offline" although commands have long been working again.
		const interval = Math.max(500, Number(this.config.poll) || 1000)
		this.pollTimer = setInterval(() => this.pollSafe(), interval)
		// Brightness and running effect change often (also in the app) – this
		// small poll runs faster than the big one with scenes and devices.
		const fast = Number(this.config.fastPoll ?? 500)
		if (fast > 0) this.fastTimer = setInterval(() => this.refreshProgrammer(), Math.max(200, fast))
		// Pick up scenes from the app immediately instead of waiting for the next poll
		if (this.config.localScenes !== false) this.sceneWatchStop = watchLocalScenes(() => this.refreshScenes())
		await this.pollSafe()
	}

	stopSceneWatch() {
		if (this.sceneWatchStop) this.sceneWatchStop()
		this.sceneWatchStop = null
	}

	/** Re-read scenes when the app has changed its scene files */
	async refreshScenes() {
		try {
			await this.readScenes()
			this.checkFeedbacks('scene_active')
			this.updateVariables()
		} catch (e) {
			this.log('debug', `Scene refresh failed: ${e.message || e}`)
		}
	}

	/** Read only the running state and update displays, without overlap */
	async refreshProgrammer() {
		if (!this.connected || this.polling || this.programmerBusy) return
		this.programmerBusy = true
		try {
			await this.readProgrammer()
			this.checkFeedbacks('effect_active', 'color_active', 'active_effect_image', 'dimmer_level')
			this.updateVariables()
		} catch (e) {
			this.log('debug', `Fast poll failed: ${e.message || e}`)
		} finally {
			this.programmerBusy = false
		}
	}

	/** One poll without overlap; log errors only when the error text changes */
	async pollSafe() {
		if (this.polling) return
		this.polling = true
		try {
			await this.poll()
			if (this.lastPollError) this.log('info', 'Connection to the app restored')
			this.lastPollError = null
		} catch (e) {
			const msg = String(e.message || e)
			if (msg !== this.lastPollError) this.log('error', `Connection failed: ${msg}`)
			this.lastPollError = msg
		} finally {
			this.polling = false
		}
	}

	async authenticate() {
		const res = await this.http('POST', '/Access/Authenticate', { Password: this.config.password ?? '' }, false)
		if (!res.ok) {
			this.token = null
			if (res.status === 503 || res.status === 401) {
				throw new Error('Wrong or missing network password')
			}
			throw new Error(`Authentication failed (HTTP ${res.status})`)
		}
		const data = await res.json()
		this.token = data.access_token
		const ttl = Number(data.expires_in) || 3600
		this.tokenExpiresAt = Date.now() + ttl * 1000
		return this.token
	}

	async ensureToken() {
		// 30 s buffer before expiry
		if (!this.token || Date.now() > this.tokenExpiresAt - 30000) {
			await this.authenticate()
		}
		return this.token
	}

	/**
	 * Low-level HTTP request.
	 * @param {boolean} auth  true = attach bearer token and re-authenticate once on 401
	 */
	async http(method, path, body, auth = true, _retried = false, _attempt = 0) {
		const headers = {}
		if (body !== undefined) headers['Content-Type'] = 'application/json'
		if (auth) {
			await this.ensureToken()
			headers['Authorization'] = 'Bearer ' + this.token
		}

		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
		let res
		try {
			res = await fetch(this.baseUrl() + path, {
				method,
				headers,
				body: body !== undefined ? JSON.stringify(body) : undefined,
				signal: controller.signal,
			})
		} finally {
			clearTimeout(timer)
		}

		if (auth && res.status === 401 && !_retried) {
			this.token = null
			await this.ensureToken()
			return this.http(method, path, body, auth, true, _attempt)
		}

		// Vision Control has a sporadic threading bug: the API handler
		// updates the UI from a background thread and then responds
		// with a COMException (0x8001010E, RPC_E_WRONG_THREAD).
		// Control commands are idempotent, so wait briefly and retry.
		if (!res.ok && _attempt < MAX_TRANSIENT_RETRIES) {
			const text = await res
				.clone()
				.text()
				.catch(() => '')
			if (text.includes('COMException') || text.includes('0x8001010E')) {
				this.log('debug', `Transient app error on ${method} ${path}, retry ${_attempt + 1}`)
				await new Promise((r) => setTimeout(r, 150 * (_attempt + 1)))
				return this.http(method, path, body, auth, _retried, _attempt + 1)
			}
		}
		return res
	}

	async poll() {
		try {
			const nres = await this.http('GET', '/Network', undefined, false)
			if (nres.ok) {
				this.network = await nres.json()
			}

			await this.readScenes()
			await this.readProgrammer()
			await this.readDevices()

			this.connected = true
			this.updateStatus(InstanceStatus.Ok)
			this.checkFeedbacks('scene_active', 'connected', 'effect_active', 'color_active', 'active_effect_image', 'network_status', 'dimmer_level')
			this.updateVariables()
		} catch (e) {
			this.connected = false
			this.updateStatus(InstanceStatus.ConnectionFailure, String(e.message || e))
			this.checkFeedbacks('connected', 'network_status')
			this.updateVariables()
			throw e
		}
	}

	/** Read the scene list (API, otherwise local scene files) and rebuild definitions on change */
	async readScenes() {
		const sres = await this.http('GET', '/Scenes', undefined, true)
		let scenes = []
		if (sres.ok) {
			const data = await sres.json()
			scenes = Array.isArray(data) ? data : []
			this.scenesReadError = null
		} else {
			// Vision Control 2.17.3 and 2.18.4: GET /Scenes responds with HTTP 500 even if
			// scenes exist. Fallback: names from the app's local scene files.
			const useLocal = this.config.localScenes !== false
			if (useLocal) scenes = readLocalScenes()
			if (this.scenesReadError !== sres.status) {
				this.scenesReadError = sres.status
				this.log(
					'warn',
					`Scene list not readable via the API (HTTP ${sres.status}, app error).` +
						(useLocal ? ` ${scenes.length} scene(s) taken from the app's local scene files.` : ''),
				)
			}
		}
		this.scenes = scenes
		this.updateSceneActive()
		// New, deleted, renamed or moved scenes: rebuild definitions
		const sig = scenesSignature(this.scenes)
		if (sig !== this.scenesSig) {
			this.scenesSig = sig
			this.updateDefinitions()
		}
	}

	updateVariables() {
		const a = this.activeFor('group', Number(this.config && this.config.statusGroup) || 0)
		const sceneVars = {}
		for (const s of this.scenes || []) {
			sceneVars[`scene_${s.ItemId}_name`] = sceneName(s)
			// For buttons: wrapped at font size 14, fits below the icon
			sceneVars[`scene_${s.ItemId}_label`] = labelText(sceneName(s), 14, 36).text
			sceneVars[`scene_${s.ItemId}_active`] = s.Active ? 'true' : 'false'
		}
		// Per group: name, brightness and running effect
		const groupVars = {}
		for (const g of this.groups || []) {
			const ga = this.activeFor('group', g.id)
			groupVars[`group_${g.id}_name`] = g.name
			groupVars[`group_${g.id}_short`] = shortLabel(g.name, 14)
			groupVars[`group_${g.id}_dimmer`] = `${Math.round((this.dimmerNow('group', g.id) / DIM_FULL) * 100)} %`
			groupVars[`group_${g.id}_effect`] = ga.name
		}
		const net = this.networkStatusNow()
		this.setVariableValues({
			...sceneVars,
			...groupVars,
			group_count: Array.isArray(this.groups) ? this.groups.length : 0,
			network_devices: String(net.count),
			network_device_names: net.names.length ? net.names.join(', ') : '–',
			app_reachable: net.level === 'ok' ? 'yes' : 'no',
			connection: this.connected ? 'connected' : 'disconnected',
			network_name: (this.network && this.network.Name) || '',
			network_id: (this.network && this.network.Identifier) || '',
			scene_count: Array.isArray(this.scenes) ? this.scenes.length : 0,
			active_effect: a.name,
			active_effect_id: a.id || '',
			active_category: a.category,
			active_seconds: a.seconds === null ? '' : `${a.seconds.toFixed(2)} s`,
			active_dimmer: a.dimmerPct === null ? '' : `${a.dimmerPct} %`,
			active_range: a.range === null ? '' : String(a.range),
		})
	}

	// ---- Network devices and app reachability --------------------------------
	// Note: /Network/Info also contains switched-off devices; the API currently
	// does not provide a per-device online status.

	async readDevices() {
		const res = await this.http('GET', '/Network/Info', undefined, true)
		if (!res.ok) {
			this.devicesReadOk = false
			return
		}
		const info = await res.json()
		this.devices = Array.isArray(info.Fixtures) ? info.Fixtures : []
		this.devicesReadOk = true
		this.groups = normalizeGroups(info.Groups)
		// New, deleted or renamed groups: rebuild dropdowns, variables and presets
		const sig = groupsSignature(this.groups)
		if (sig !== this.groupsSig) {
			this.groupsSig = sig
			this.updateDefinitions()
		}
	}

	networkStatusNow() {
		return networkStatus({ connected: this.connected, readOk: this.devicesReadOk, current: this.devices })
	}

	// ---- Active effect --------------------------------------------------------

	async readProgrammer() {
		const res = await this.http('GET', '/Control', undefined, true)
		if (res.ok) {
			this.programmer = await res.json()
			this.applyPendingDimmer()
			this.updateSceneActive()
		}
		return this.programmer
	}

	/** What is currently running on the group/fixture? (from the last read state) */
	activeFor(target, id) {
		return describeActive(findContent(this.programmer, target, id), this.lastSent[`${target}:${id}`])
	}

	/** Remember the catalog effect sent by the module so it is recognized even with overrides */
	markSent(target, id, catalogId, entry) {
		this.lastSent[`${target}:${id}`] = { id: catalogId, fp: fingerprintOfEntry(entry) }
		this.scheduleRefresh()
	}

	/** Re-read the programmer shortly after a change so feedbacks are correct right away */
	scheduleRefresh(delay = 250) {
		if (this.refreshTimer) clearTimeout(this.refreshTimer)
		this.refreshTimer = setTimeout(async () => {
			this.refreshTimer = null
			try {
				await this.readProgrammer()
				this.checkFeedbacks('effect_active', 'color_active', 'active_effect_image', 'dimmer_level')
				this.updateVariables()
			} catch (e) {
				this.log('debug', `Refresh failed: ${e.message || e}`)
			}
		}, delay)
	}

	/** Adjust the running effect: faster, slower, brighter, darker, range_up, range_down */
	async adjustActive(target, id, what, percent, rangeStep) {
		await this.readProgrammer()
		const partial = adjustContent(findContent(this.programmer, target, id), what, percent, rangeStep)
		if (!partial) {
			this.log('warn', `Cannot adjust "${what}": no matching effect is running on ${target} ${id}.`)
			return
		}
		await this.setControl(target, id, partial, 0)
		this.scheduleRefresh()
	}

	/**
	 * Active state of the scenes. Scenes read from the API carry it; locally
	 * read ones are recognized from the running state (same color or same
	 * color effect in the programmer). This way a scene goes dark as soon as another
	 * preset or the app sets something else, and scenes started in the app
	 * light up as well.
	 */
	updateSceneActive() {
		const next = {}
		for (const s of this.scenes || []) {
			next[String(s.ItemId)] = s.source === 'local' ? sceneMatches(s.detail, this.programmer) : !!s.Active
		}
		const changed = JSON.stringify(next) !== JSON.stringify(this.sceneActive || {})
		this.sceneActive = next
		if (changed) this.checkFeedbacks('scene_active')
	}

	// ---- Switching scenes ------------------------------------------------------

	/**
	 * Scene on/off. First via the scene API; if the app does not process it
	 * (2.17.3/2.18.4), the saved scene from the local scene files is
	 * recreated via POST /Control.
	 */
	async switchScene(id, on) {
		const what = on ? 'Scene On' : 'Scene Off'
		if (!this.sceneApiBroken) {
			const res = await this.http('POST', `/Scenes/${encodeURIComponent(id)}/${on ? 'On' : 'Off'}`)
			try {
				await this.expectHandled(res, what)
				return
			} catch (e) {
				if (this.config.localScenes === false) throw e
				this.sceneApiBroken = true
				this.log('info', `${what} not possible via the API (${e.message}). Fallback: scene from the app's local scene files via /Control.`)
			}
		}
		const scene = this.config.localScenes === false ? null : readLocalSceneDetail(id)
		if (!scene) throw new Error(`${what}: scene ${id} not found in the app's local scene files (Companion must run on the app's PC).`)
		const plan = on ? sceneToControl(scene) : sceneOffControl(scene)
		if (!plan.groups.length) throw new Error(`${what}: scene "${scene.Name}" contains no transferable values.`)
		if (on && plan.skipped && plan.skipped.length) {
			this.log('debug', `Scene "${scene.Name}": components ${plan.skipped.join(', ')} not supported yet, skipped.`)
		}
		const res = await this.http('POST', '/Control', { FadeTime: plan.fade, Fixtures: [], Groups: plan.groups })
		await this.expectHandled(res, what)
		// Check the status right away against the app's actual state
		await this.readProgrammer()
		this.checkFeedbacks('effect_active', 'color_active', 'active_effect_image', 'dimmer_level')
		this.updateVariables()
	}

	// ---- Brightness via rotary encoder ----------------------------------------

	/** Current brightness 0..65535: fresh rotary encoder value, otherwise the last read state */
	dimmerNow(target, id) {
		const p = this.dimPending[`${target}:${id}`]
		if (p && Date.now() - p.at < DIM_HOLD_MS) return p.value
		const c = findContent(this.programmer, target, id)
		return c && c.MasterDimmer && typeof c.MasterDimmer.Value === 'number' ? c.MasterDimmer.Value : DIM_FULL
	}

	/** Write fresh rotary encoder values into the read state so displays and feedbacks do not jump back */
	applyPendingDimmer() {
		for (const [key, p] of Object.entries(this.dimPending)) {
			if (Date.now() - p.at >= DIM_HOLD_MS) continue
			const [target, id] = key.split(':')
			const c = findContent(this.programmer, target, id)
			if (c) c.MasterDimmer = { ...(c.MasterDimmer || {}), Default: false, Value: p.value }
		}
	}

	/** Change brightness by stepPct percentage points (positive = brighter) */
	async stepDimmer(target, id, stepPct) {
		const value = this.dimmerNow(target, id) + Math.round((stepPct / 100) * DIM_FULL)
		await this.setDimmerQueued(target, id, value, 0)
	}

	/** Blackout on/off: remembers the brightness before and restores it */
	async toggleBlackout(target, id, fade) {
		const key = `${target}:${id}`
		const cur = this.dimmerNow(target, id)
		if (cur > 0) {
			this.dimMemory[key] = cur
			await this.setDimmerQueued(target, id, 0, fade)
		} else {
			await this.setDimmerQueued(target, id, this.dimMemory[key] || DIM_FULL, fade)
		}
	}

	/**
	 * Sets the brightness. Fast rotary encoder steps are combined:
	 * if a command is already running, only the newest value is sent afterwards.
	 */
	/** Show the new brightness immediately, before the app confirms it */
	noteDimmer(target, id, value) {
		const v = Math.max(0, Math.min(DIM_FULL, Math.round(value)))
		this.dimPending[`${target}:${id}`] = { value: v, at: Date.now() }
		this.applyPendingDimmer()
		this.updateVariables()
		this.checkFeedbacks('active_effect_image', 'effect_active', 'color_active', 'dimmer_level')
		return v
	}

	async setDimmerQueued(target, id, value, fade) {
		const key = `${target}:${id}`
		this.noteDimmer(target, id, value)
		if (this.dimSending[key]) return
		this.dimSending[key] = true
		try {
			let sent = null
			while (sent !== this.dimPending[key].value) {
				sent = this.dimPending[key].value
				await this.setControl(target, Number(id), { MasterDimmer: { Default: false, Value: sent, Fx: null } }, fade)
			}
		} finally {
			this.dimSending[key] = false
			this.scheduleRefresh(300)
		}
	}

	// ---- Control helpers ------------------------------------------------------

	/**
	 * Checks whether the app really processed a command. It answers unknown routes
	 * with HTTP 200 and its documentation page, which would otherwise be a
	 * silent fake success.
	 */
	async expectHandled(res, what) {
		const text = await res
			.clone()
			.text()
			.catch(() => '')
		if (res.ok && !text.includes('<title>API Documentation')) return text
		if (res.ok) throw new Error(`${what}: the app did not process the command (not available in this app version).`)
		throw new Error(`${what} failed (HTTP ${res.status}) ${text.replace(/\s+/g, ' ').slice(0, 120)}`)
	}

	/**
	 * Sets ProgrammerContent on a group or a fixture via POST /Control.
	 * @param {'group'|'fixture'} target
	 * @param {number} id        GroupID or RDMID
	 * @param {object} content   ProgrammerContent (only required fields)
	 * @param {number|null} fade FadeTime 0..255 or null
	 */
	async setControl(target, id, content, fade) {
		// FadeTime is an integer 0..255 and must NOT be null (otherwise the API
		// responds with HTTP 400). 0 = instant.
		const fadeByte = Math.max(0, Math.min(255, Math.round(Number(fade) || 0)))
		const body = {
			FadeTime: fadeByte,
			Fixtures: [],
			Groups: [],
		}
		if (target === 'fixture') {
			body.Fixtures.push({ RDMID: id, Content: content })
		} else {
			body.Groups.push({ GroupID: id, Content: content })
		}
		const res = await this.http('POST', '/Control', body)
		await this.expectHandled(res, 'Control command')
		// Read back right away so displays do not wait for the next poll
		this.scheduleRefresh(150)
	}

	// ---- Load definitions -----------------------------------------------------

	/** Rebuild everything that lists scenes or groups */
	updateDefinitions() {
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()
		this.updateVariables()
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}

	updatePresets() {
		UpdatePresets(this)
	}
}

runEntrypoint(VisionControlInstance, UpgradeScripts)
