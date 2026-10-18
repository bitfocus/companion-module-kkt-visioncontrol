const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const UpdatePresets = require('./presets')

const REQUEST_TIMEOUT_MS = 5000
const MAX_TRANSIENT_RETRIES = 3

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
		try {
			await this.authenticate()
			await this.poll()
			const interval = Math.max(500, Number(this.config.poll) || 2000)
			this.pollTimer = setInterval(() => {
				this.poll().catch(() => {})
			}, interval)
		} catch (e) {
			this.updateStatus(InstanceStatus.ConnectionFailure, String(e.message || e))
			this.log('error', `Verbindung fehlgeschlagen: ${e.message || e}`)
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
			if (sres.ok) {
				const scenes = await sres.json()
				this.scenes = Array.isArray(scenes) ? scenes : []
				this.sceneActive = {}
				for (const s of this.scenes) {
					this.sceneActive[String(s.ItemId)] = !!s.Active
				}
			}

			this.connected = true
			this.updateStatus(InstanceStatus.Ok)
			this.checkFeedbacks('scene_active', 'connected')
			this.updateVariables()
		} catch (e) {
			this.connected = false
			this.updateStatus(InstanceStatus.ConnectionFailure, String(e.message || e))
			this.checkFeedbacks('connected')
			this.updateVariables()
			throw e
		}
	}

	updateVariables() {
		this.setVariableValues({
			connection: this.connected ? 'connected' : 'disconnected',
			network_name: (this.network && this.network.Name) || '',
			network_id: (this.network && this.network.Identifier) || '',
			scene_count: Array.isArray(this.scenes) ? this.scenes.length : 0,
		})
	}

	// ---- Steuer-Helfer --------------------------------------------------------

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
		if (!res.ok) {
			const text = await res.text().catch(() => '')
			throw new Error(`Steuerbefehl fehlgeschlagen (HTTP ${res.status}) ${text}`)
		}
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
