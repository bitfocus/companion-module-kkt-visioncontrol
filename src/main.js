const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const UpdatePresets = require('./presets')
const { findContent, describeActive, adjustContent, fingerprintOfEntry } = require('./active')
const { sceneName, scenesSignature } = require('./scenes')
const { networkStatus } = require('./devices')
const { readLocalScenes } = require('./localscenes')

const REQUEST_TIMEOUT_MS = 5000
const MAX_TRANSIENT_RETRIES = 3
// Solange gilt ein Drehregler-Wert als aktuell, auch wenn die Abfrage noch den alten Stand liefert
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
		this.programmer = null // letzter Stand aus GET /Control
		this.lastSent = {} // 'group:0' -> { id, fp } zuletzt vom Modul gesendeter Katalog-Effekt
		this.refreshTimer = null
		this.scenesSig = '' // Vergleichsschlüssel der Szenenliste
		this.scenesReadError = null
		this.devices = [] // Geräte des Netzwerks aus GET /Network/Info (auch ausgeschaltete)
		this.devicesReadOk = false
		this.dimPending = {} // 'group:0' -> { value, at } letzter Helligkeitswert vom Drehregler
		this.dimSending = {} // 'group:0' -> true, solange ein Helligkeitsbefehl unterwegs ist
		this.dimMemory = {} // 'group:0' -> Helligkeit vor dem Blackout
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
					'Steuert die Vision Control App über ihre lokale REST-API. ' +
					'Die API muss in der App aktiviert sein. Host, Port und Netzwerk-Passwort unten eintragen.',
			},
			{ type: 'textinput', id: 'host', label: 'IP-Adresse der App', width: 6, default: '127.0.0.1', regex: Regex.IP },
			{ type: 'textinput', id: 'port', label: 'Port', width: 3, default: '5123', regex: Regex.PORT },
			{ type: 'textinput', id: 'password', label: 'Netzwerk-Passwort', width: 6 },
			{ type: 'number', id: 'poll', label: 'Abfrage-Intervall (ms)', width: 3, default: 2000, min: 500, max: 60000 },
			{ type: 'textinput', id: 'statusGroup', label: 'Gruppe für Statusanzeige (GroupID)', width: 4, default: '0' },
			{
				type: 'checkbox',
				id: 'localScenes',
				label: 'Szenennamen aus den lokalen App-Dateien lesen, falls die API sie nicht liefert (nur wenn Companion auf demselben PC läuft)',
				width: 12,
				default: true,
			},
		]
	}

	// ---- Verbindung / Polling -------------------------------------------------

	baseUrl() {
		return `http://${this.config.host}:${this.config.port || 5123}`
	}

	async initConnection() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = null
		}
		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'Keine IP-Adresse gesetzt')
			return
		}
		this.updateStatus(InstanceStatus.Connecting)
		this.token = null
		// Die Abfrage läuft immer, auch wenn die App beim Start nicht erreichbar ist
		// (z. B. nach einem App-Update mit noch abgeschalteter API). Sonst bliebe das
		// Modul "offline", obwohl Befehle längst wieder funktionieren.
		const interval = Math.max(500, Number(this.config.poll) || 2000)
		this.pollTimer = setInterval(() => this.pollSafe(), interval)
		await this.pollSafe()
	}

	/** Eine Abfrage ohne Überlappung; Fehler nur beim Wechsel des Fehlertexts loggen */
	async pollSafe() {
		if (this.polling) return
		this.polling = true
		try {
			await this.poll()
			if (this.lastPollError) this.log('info', 'Verbindung zur App wiederhergestellt')
			this.lastPollError = null
		} catch (e) {
			const msg = String(e.message || e)
			if (msg !== this.lastPollError) this.log('error', `Verbindung fehlgeschlagen: ${msg}`)
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
				throw new Error('Falsches oder fehlendes Netzwerk-Passwort')
			}
			throw new Error(`Anmeldung fehlgeschlagen (HTTP ${res.status})`)
		}
		const data = await res.json()
		this.token = data.access_token
		const ttl = Number(data.expires_in) || 3600
		this.tokenExpiresAt = Date.now() + ttl * 1000
		return this.token
	}

	async ensureToken() {
		// 30 s Puffer vor Ablauf
		if (!this.token || Date.now() > this.tokenExpiresAt - 30000) {
			await this.authenticate()
		}
		return this.token
	}

	/**
	 * Low-level HTTP-Request.
	 * @param {boolean} auth  true = Bearer-Token anhängen und bei 401 einmal neu anmelden
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

		// Vision Control hat einen sporadischen Threading-Bug: Der API-Handler
		// aktualisiert die Oberfläche aus einem Hintergrund-Thread und antwortet
		// dann mit einer COMException (0x8001010E, RPC_E_WRONG_THREAD).
		// Steuerbefehle sind idempotent, daher kurz warten und wiederholen.
		if (!res.ok && _attempt < MAX_TRANSIENT_RETRIES) {
			const text = await res
				.clone()
				.text()
				.catch(() => '')
			if (text.includes('COMException') || text.includes('0x8001010E')) {
				this.log('debug', `Transienter App-Fehler bei ${method} ${path}, Wiederholung ${_attempt + 1}`)
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

			const sres = await this.http('GET', '/Scenes', undefined, true)
			let scenes = []
			if (sres.ok) {
				const data = await sres.json()
				scenes = Array.isArray(data) ? data : []
				this.scenesReadError = null
			} else {
				// Vision Control 2.17.3 und 2.18.4: GET /Scenes antwortet mit HTTP 500, auch wenn
				// Szenen existieren. Rückfall: Namen aus den lokalen Szenendateien der App.
				const useLocal = this.config.localScenes !== false
				if (useLocal) scenes = readLocalScenes()
				if (this.scenesReadError !== sres.status) {
					this.scenesReadError = sres.status
					this.log(
						'warn',
						`Szenenliste über die API nicht lesbar (HTTP ${sres.status}, Fehler der App).` +
							(useLocal ? ` ${scenes.length} Szene(n) aus den lokalen App-Dateien übernommen.` : ''),
					)
				}
			}
			this.scenes = scenes
			this.sceneActive = {}
			for (const s of this.scenes) {
				this.sceneActive[String(s.ItemId)] = !!s.Active
			}
			// Neue, gelöschte, umbenannte oder verschobene Szenen: Definitionen neu aufbauen
			const sig = scenesSignature(this.scenes)
			if (sig !== this.scenesSig) {
				this.scenesSig = sig
				this.updateActions()
				this.updateFeedbacks()
				this.updateVariableDefinitions()
				this.updatePresets()
			}

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

	updateVariables() {
		const a = this.activeFor('group', Number(this.config && this.config.statusGroup) || 0)
		const sceneVars = {}
		for (const s of this.scenes || []) {
			sceneVars[`scene_${s.ItemId}_name`] = sceneName(s)
			sceneVars[`scene_${s.ItemId}_active`] = s.Active ? 'true' : 'false'
		}
		const net = this.networkStatusNow()
		this.setVariableValues({
			...sceneVars,
			network_devices: String(net.count),
			network_device_names: net.names.length ? net.names.join(', ') : '–',
			app_reachable: net.level === 'ok' ? 'ja' : 'nein',
			connection: this.connected ? 'connected' : 'disconnected',
			network_name: (this.network && this.network.Name) || '',
			network_id: (this.network && this.network.Identifier) || '',
			scene_count: Array.isArray(this.scenes) ? this.scenes.length : 0,
			active_effect: a.name,
			active_effect_id: a.id || '',
			active_category: a.category,
			active_seconds: a.seconds === null ? '' : `${a.seconds.toFixed(2).replace('.', ',')} s`,
			active_dimmer: a.dimmerPct === null ? '' : `${a.dimmerPct} %`,
			active_range: a.range === null ? '' : String(a.range),
		})
	}

	// ---- Netzwerk-Geräte und Erreichbarkeit der App ---------------------------
	// Hinweis: /Network/Info enthält auch ausgeschaltete Geräte; einen
	// Online-Status pro Gerät liefert die API derzeit nicht.

	async readDevices() {
		const res = await this.http('GET', '/Network/Info', undefined, true)
		if (!res.ok) {
			this.devicesReadOk = false
			return
		}
		const info = await res.json()
		this.devices = Array.isArray(info.Fixtures) ? info.Fixtures : []
		this.devicesReadOk = true
	}

	networkStatusNow() {
		return networkStatus({ connected: this.connected, readOk: this.devicesReadOk, current: this.devices })
	}

	// ---- Aktiver Effekt -------------------------------------------------------

	async readProgrammer() {
		const res = await this.http('GET', '/Control', undefined, true)
		if (res.ok) {
			this.programmer = await res.json()
			this.applyPendingDimmer()
		}
		return this.programmer
	}

	/** Was läuft gerade auf Gruppe/Fixture? (aus dem zuletzt gelesenen Stand) */
	activeFor(target, id) {
		return describeActive(findContent(this.programmer, target, id), this.lastSent[`${target}:${id}`])
	}

	/** Vom Modul gesendeten Katalog-Effekt merken, damit er auch mit Überschreibungen erkannt wird */
	markSent(target, id, catalogId, entry) {
		this.lastSent[`${target}:${id}`] = { id: catalogId, fp: fingerprintOfEntry(entry) }
		this.scheduleRefresh()
	}

	/** Programmer kurz nach einer Änderung neu lesen, damit Feedbacks sofort stimmen */
	scheduleRefresh(delay = 250) {
		if (this.refreshTimer) clearTimeout(this.refreshTimer)
		this.refreshTimer = setTimeout(async () => {
			this.refreshTimer = null
			try {
				await this.readProgrammer()
				this.checkFeedbacks('effect_active', 'color_active', 'active_effect_image', 'dimmer_level')
				this.updateVariables()
			} catch (e) {
				this.log('debug', `Aktualisierung fehlgeschlagen: ${e.message || e}`)
			}
		}, delay)
	}

	/** Laufenden Effekt anpassen: faster, slower, brighter, darker, range_up, range_down */
	async adjustActive(target, id, what, percent, rangeStep) {
		await this.readProgrammer()
		const partial = adjustContent(findContent(this.programmer, target, id), what, percent, rangeStep)
		if (!partial) {
			this.log('warn', `Anpassen "${what}" nicht möglich: Auf ${target} ${id} läuft kein passender Effekt.`)
			return
		}
		await this.setControl(target, id, partial, 0)
		this.scheduleRefresh()
	}

	// ---- Helligkeit per Drehregler -------------------------------------------

	/** Aktuelle Helligkeit 0..65535: frischer Drehregler-Wert, sonst der zuletzt gelesene Stand */
	dimmerNow(target, id) {
		const p = this.dimPending[`${target}:${id}`]
		if (p && Date.now() - p.at < DIM_HOLD_MS) return p.value
		const c = findContent(this.programmer, target, id)
		return c && c.MasterDimmer && typeof c.MasterDimmer.Value === 'number' ? c.MasterDimmer.Value : DIM_FULL
	}

	/** Frische Drehregler-Werte in den gelesenen Stand eintragen, damit Anzeige und Feedbacks nicht zurückspringen */
	applyPendingDimmer() {
		for (const [key, p] of Object.entries(this.dimPending)) {
			if (Date.now() - p.at >= DIM_HOLD_MS) continue
			const [target, id] = key.split(':')
			const c = findContent(this.programmer, target, id)
			if (c) c.MasterDimmer = { ...(c.MasterDimmer || {}), Default: false, Value: p.value }
		}
	}

	/** Helligkeit um stepPct Prozentpunkte ändern (positiv = heller) */
	async stepDimmer(target, id, stepPct) {
		const value = this.dimmerNow(target, id) + Math.round((stepPct / 100) * DIM_FULL)
		await this.setDimmerQueued(target, id, value, 0)
	}

	/** Blackout an/aus: merkt sich die Helligkeit davor und stellt sie wieder her */
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
	 * Setzt die Helligkeit. Schnelle Drehregler-Schritte werden zusammengefasst:
	 * Läuft schon ein Befehl, wird danach nur der neueste Wert gesendet.
	 */
	async setDimmerQueued(target, id, value, fade) {
		const key = `${target}:${id}`
		const v = Math.max(0, Math.min(DIM_FULL, Math.round(value)))
		this.dimPending[key] = { value: v, at: Date.now() }
		this.applyPendingDimmer()
		this.updateVariables()
		this.checkFeedbacks('active_effect_image', 'effect_active', 'color_active', 'dimmer_level')
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

	// ---- Steuer-Helfer --------------------------------------------------------

	/**
	 * Prüft, ob die App einen Befehl wirklich verarbeitet hat. Unbekannte Routen
	 * beantwortet sie mit HTTP 200 und ihrer Doku-Seite, das wäre sonst ein
	 * stiller Scheinerfolg.
	 */
	async expectHandled(res, what) {
		const text = await res
			.clone()
			.text()
			.catch(() => '')
		if (res.ok && !text.includes('<title>API Documentation')) return text
		if (res.ok) throw new Error(`${what}: Die App hat den Befehl nicht verarbeitet (in dieser App-Version nicht verfügbar).`)
		throw new Error(`${what} fehlgeschlagen (HTTP ${res.status}) ${text.replace(/\s+/g, ' ').slice(0, 120)}`)
	}

	/**
	 * Setzt ProgrammerContent auf eine Gruppe oder ein Fixture via POST /Control.
	 * @param {'group'|'fixture'} target
	 * @param {number} id        GroupID oder RDMID
	 * @param {object} content   ProgrammerContent (nur benötigte Felder)
	 * @param {number|null} fade FadeTime 0..255 oder null
	 */
	async setControl(target, id, content, fade) {
		// FadeTime ist eine Ganzzahl 0..255 und darf NICHT null sein (die API
		// antwortet sonst mit HTTP 400). 0 = sofort.
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
		await this.expectHandled(res, 'Steuerbefehl')
	}

	// ---- Definitionen laden ---------------------------------------------------

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
