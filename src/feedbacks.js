const { combineRgb } = require('@companion-module/base')
const { CATALOG, CATALOG_BY_ID, COLORS } = require('./effects-data')
const { tile, overlay, icon } = require('./icons')
const { sceneChoices } = require('./scenes')

const BLACK = combineRgb(0, 0, 0)
const LOCAL_VARS = { local: true }

/**
 * Button-Stil mit dem Bild des aktiven Effekts.
 * Katalog-Effekt/Farbe: deren Kachel. App-Effekt: Effektfarbe + Motiv-Ebene.
 * Aus: Mond-Symbol. Nichts aktiv: {} (Grundstil der Taste bleibt).
 */
function activeImageStyle(a) {
	const textStyle = { color: combineRgb(255, 255, 255), alignment: 'center:bottom' }
	if (!a || !a.id) return {}
	if (a.id === 'off') {
		return { ...textStyle, bgcolor: BLACK, png64: icon('blackout', 'light'), pngalignment: 'center:top' }
	}
	if (CATALOG_BY_ID[a.id]) {
		const png = tile(a.id)
		const c = CATALOG_BY_ID[a.id].colors[0]
		return png ? { ...textStyle, bgcolor: BLACK, png64: png, pngalignment: 'center:center' } : { ...textStyle, bgcolor: combineRgb(...c) }
	}
	if (a.id.startsWith('color:')) {
		const png = tile(`color_${a.id.slice(6)}`)
		if (png) return { ...textStyle, bgcolor: BLACK, png64: png, pngalignment: 'center:center' }
	}
	const base = a.rgb || (a.colors && a.colors[0]) || [40, 40, 40]
	const layer = overlay(a.effect === null ? 0 : a.effect)
	const style = { ...textStyle, bgcolor: combineRgb(...base) }
	if (layer) {
		style.png64 = layer
		style.pngalignment = 'center:center'
	}
	return style
}

const TARGETS = [
	{ id: 'group', label: 'Gruppe (GroupID)' },
	{ id: 'fixture', label: 'Fixture (RDMID)' },
]
const ORANGE = combineRgb(255, 122, 0)
const WHITE = combineRgb(255, 255, 255)
// Farben für die Erreichbarkeit der App
const GREEN = combineRgb(0, 153, 51)
const RED = combineRgb(204, 0, 0)

// Balken zwischen Symbol (bis y 33) und Wert: orange gefüllt (wie der Aktiv-Rahmen), Rest dunkelgrau
const BAR = { x: 8, y: 37, width: 56, height: 5 }
function levelBar(fraction) {
	const f = Math.max(0, Math.min(1, fraction || 0))
	const filled = Math.round(f * BAR.width)
	const buf = Buffer.alloc(BAR.width * BAR.height * 4)
	for (let y = 0; y < BAR.height; y++) {
		for (let x = 0; x < BAR.width; x++) {
			const i = (y * BAR.width + x) * 4
			const [r, g, b] = x < filled ? [255, 122, 0] : [85, 85, 85]
			buf[i] = r
			buf[i + 1] = g
			buf[i + 2] = b
			buf[i + 3] = 255
		}
	}
	return { imageBuffer: buf.toString('base64'), imageBufferEncoding: { pixelFormat: 'RGBA' }, imageBufferPosition: BAR }
}

module.exports = UpdateFeedbacks
module.exports.activeImageStyle = activeImageStyle
module.exports.levelBar = levelBar

function UpdateFeedbacks(self) {
	// Variablen im Kontext der Taste auflösen, inkl. lokaler Variablen
	const parse = (context, text) =>
		context && typeof context.parseVariablesInString === 'function'
			? context.parseVariablesInString(String(text ?? ''))
			: self.parseVariablesInString(String(text ?? ''))

	self.setFeedbackDefinitions({
		scene_active: {
			name: 'Szene / Sequenz ist aktiv',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 153, 51),
				color: WHITE,
			},
			options: [
				{
					id: 'itemId',
					type: 'dropdown',
					label: 'Szene / Sequenz',
					default: sceneChoices(self.scenes)[0].id,
					choices: sceneChoices(self.scenes),
					allowCustom: true,
				},
			],
			callback: async (feedback, context) => {
				const id = String(await parse(context, feedback.options.itemId)).trim()
				return !!self.sceneActive[id]
			},
		},

		connected: {
			name: 'Mit Vision Control verbunden',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 102, 204),
				color: WHITE,
			},
			options: [],
			callback: () => {
				return !!self.connected
			},
		},

		effect_active: {
			name: 'Katalog-Effekt ist aktiv',
			description: 'Wahr, solange dieser Effekt auf dem Ziel läuft (auch mit überschriebenen Werten).',
			type: 'boolean',
			defaultStyle: { bgcolor: ORANGE, color: WHITE },
			options: [
				{ id: 'effect', type: 'dropdown', label: 'Effekt', default: CATALOG[0].id, choices: CATALOG.map((e) => ({ id: e.id, label: `${e.cat}: ${e.name}` })) },
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
			],
			callback: async (feedback, context) => {
				const o = feedback.options
				return self.activeFor(o.target, Number(await parse(context, o.id)) || 0).id === o.effect
			},
		},

		active_effect_image: {
			name: 'Bild des aktiven Effekts',
			description: 'Zeigt automatisch die Kachel des laufenden Effekts bzw. der laufenden Farbe.',
			type: 'advanced',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
			],
			callback: async (feedback, context) => {
				const o = feedback.options
				return activeImageStyle(self.activeFor(o.target, Number(await parse(context, o.id)) || 0))
			},
		},

		dimmer_level: {
			name: 'Helligkeit als Balken',
			description: 'Zeichnet die aktuelle Helligkeit als Balken, z. B. für den Drehregler am Stream Deck +.',
			type: 'advanced',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
			],
			callback: async (feedback, context) => {
				const o = feedback.options
				const id = Number(await parse(context, o.id)) || 0
				return levelBar(self.dimmerNow(o.target, id) / 65535)
			},
		},

		network_status: {
			name: 'App erreichbar (grün / rot)',
			description:
				'Grün: Die App antwortet und liefert die Geräteliste des Netzwerks. Rot: keine Verbindung zur App. ' +
				'Ob einzelne Geräte eingeschaltet sind, meldet die API derzeit nicht.',
			type: 'advanced',
			options: [],
			callback: () => {
				const s = self.networkStatusNow()
				return { bgcolor: s.level === 'ok' ? GREEN : RED, color: WHITE }
			},
		},

		color_active: {
			name: 'Farbe ist aktiv',
			type: 'boolean',
			defaultStyle: { bgcolor: ORANGE, color: WHITE },
			options: [
				{ id: 'color', type: 'dropdown', label: 'Farbe', default: COLORS[0].key, choices: COLORS.map((c) => ({ id: c.key, label: c.name })) },
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
			],
			callback: async (feedback, context) => {
				const o = feedback.options
				return self.activeFor(o.target, Number(await parse(context, o.id)) || 0).id === `color:${o.color}`
			},
		},
	})
}
