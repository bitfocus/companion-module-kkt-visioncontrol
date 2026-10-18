const { combineRgb } = require('@companion-module/base')
const { CATALOG, COLORS } = require('./effects-data')

const TARGETS = [
	{ id: 'group', label: 'Gruppe (GroupID)' },
	{ id: 'fixture', label: 'Fixture (RDMID)' },
]
const ORANGE = combineRgb(255, 122, 0)
const WHITE = combineRgb(255, 255, 255)

module.exports = function (self) {
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
