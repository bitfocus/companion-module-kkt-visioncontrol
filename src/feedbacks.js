const { combineRgb } = require('@companion-module/base')
const { CATALOG, CATALOG_BY_ID, COLORS } = require('./effects-data')
const { tile, overlay, icon } = require('./icons')
const { sceneChoices } = require('./scenes')

const BLACK = combineRgb(0, 0, 0)
const LOCAL_VARS = { local: true }

/**
 * Button style with the image of the active effect.
 * Catalog effect/color: its tile. App effect: effect color + motif layer.
 * Off: moon icon. Nothing active: {} (the button's base style remains).
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
	{ id: 'group', label: 'Group (GroupID)' },
	{ id: 'fixture', label: 'Fixture (RDMID)' },
]
const ORANGE = combineRgb(255, 122, 0)
const WHITE = combineRgb(255, 255, 255)
// Colors for the app's reachability
const GREEN = combineRgb(0, 153, 51)
const RED = combineRgb(204, 0, 0)

// Bar between icon (up to y 33) and value: filled orange (like the active frame), rest dark gray
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
	// Resolve variables in the button's context, incl. local variables
	const parse = (context, text) =>
		context && typeof context.parseVariablesInString === 'function'
			? context.parseVariablesInString(String(text ?? ''))
			: self.parseVariablesInString(String(text ?? ''))

	self.setFeedbackDefinitions({
		scene_active: {
			name: 'Scene / Sequence is active',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 153, 51),
				color: WHITE,
			},
			options: [
				{
					id: 'itemId',
					type: 'dropdown',
					label: 'Scene / Sequence',
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
			name: 'Connected to Vision Control',
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
			name: 'Catalog effect is active',
			description: 'True while this effect is running on the target (also with overridden values).',
			type: 'boolean',
			defaultStyle: { bgcolor: ORANGE, color: WHITE },
			options: [
				{ id: 'effect', type: 'dropdown', label: 'Effect', default: CATALOG[0].id, choices: CATALOG.map((e) => ({ id: e.id, label: `${e.cat}: ${e.name}` })) },
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
			],
			callback: async (feedback, context) => {
				const o = feedback.options
				return self.activeFor(o.target, Number(await parse(context, o.id)) || 0).id === o.effect
			},
		},

		active_effect_image: {
			name: 'Image of the active effect',
			description: 'Automatically shows the tile of the running effect or running color.',
			type: 'advanced',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
			],
			callback: async (feedback, context) => {
				const o = feedback.options
				return activeImageStyle(self.activeFor(o.target, Number(await parse(context, o.id)) || 0))
			},
		},

		dimmer_level: {
			name: 'Brightness as a bar',
			description: 'Draws the current brightness as a bar, e.g. for the rotary encoder on the Stream Deck +.',
			type: 'advanced',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
			],
			callback: async (feedback, context) => {
				const o = feedback.options
				const id = Number(await parse(context, o.id)) || 0
				return levelBar(self.dimmerNow(o.target, id) / 65535)
			},
		},

		network_status: {
			name: 'App reachable (green / red)',
			description:
				'Green: the app responds and provides the network device list. Red: no connection to the app. ' +
				'The API currently does not report whether individual devices are switched on.',
			type: 'advanced',
			options: [],
			callback: () => {
				const s = self.networkStatusNow()
				return { bgcolor: s.level === 'ok' ? GREEN : RED, color: WHITE }
			},
		},

		color_active: {
			name: 'Color is active',
			type: 'boolean',
			defaultStyle: { bgcolor: ORANGE, color: WHITE },
			options: [
				{ id: 'color', type: 'dropdown', label: 'Color', default: COLORS[0].key, choices: COLORS.map((c) => ({ id: c.key, label: c.name })) },
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
			],
			callback: async (feedback, context) => {
				const o = feedback.options
				return self.activeFor(o.target, Number(await parse(context, o.id)) || 0).id === `color:${o.color}`
			},
		},
	})
}
