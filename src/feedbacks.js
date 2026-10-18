const { combineRgb } = require('@companion-module/base')
const { CATALOG, CATALOG_BY_ID, COLORS } = require('./effects-data')
const { tile, overlay, icon } = require('./icons')

const BLACK = combineRgb(0, 0, 0)

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

module.exports = UpdateFeedbacks
module.exports.activeImageStyle = activeImageStyle

function UpdateFeedbacks(self) {
	self.setFeedbackDefinitions({
		scene_active: {
			name: 'Szene / Sequenz ist aktiv',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 153, 51),
				color: WHITE,
			},
			options: [{ id: 'itemId', type: 'textinput', label: 'Item-ID', default: '' }],
			callback: (feedback) => {
				return !!self.sceneActive[String(feedback.options.itemId).trim()]
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
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0' },
			],
			callback: (feedback) => {
				const o = feedback.options
				return self.activeFor(o.target, Number(o.id) || 0).id === o.effect
			},
		},

		active_effect_image: {
			name: 'Bild des aktiven Effekts',
			description: 'Zeigt automatisch die Kachel des laufenden Effekts bzw. der laufenden Farbe.',
			type: 'advanced',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0' },
			],
			callback: (feedback) => {
				const o = feedback.options
				return activeImageStyle(self.activeFor(o.target, Number(o.id) || 0))
			},
		},

		color_active: {
			name: 'Farbe ist aktiv',
			type: 'boolean',
			defaultStyle: { bgcolor: ORANGE, color: WHITE },
			options: [
				{ id: 'color', type: 'dropdown', label: 'Farbe', default: COLORS[0].key, choices: COLORS.map((c) => ({ id: c.key, label: c.name })) },
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0' },
			],
			callback: (feedback) => {
				const o = feedback.options
				return self.activeFor(o.target, Number(o.id) || 0).id === `color:${o.color}`
			},
		},
	})
}
