const { combineRgb } = require('@companion-module/base')

// Companion colorpicker liefert 24-bit RGB (0xRRGGBB).
function splitRgb(value) {
	const v = Number(value) || 0
	return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff }
}
// 8-bit (0..255) -> 16-bit (0..65535) der Vision-API
const scale16 = (x) => Math.round((x / 255) * 65535)

const TARGETS = [
	{ id: 'group', label: 'Gruppe (GroupID)' },
	{ id: 'fixture', label: 'Fixture (RDMID)' },
]

module.exports = function (self) {
	self.setActionDefinitions({
		scene_on: {
			name: 'Szene / Sequenz: An',
			options: [{ id: 'itemId', type: 'textinput', label: 'Item-ID', default: '', useVariables: true }],
			callback: async (event) => {
				const id = await self.parseVariablesInString(event.options.itemId)
				await self.http('POST', `/Scenes/${encodeURIComponent(id.trim())}/On`)
			},
		},

		scene_off: {
			name: 'Szene / Sequenz: Aus',
			options: [{ id: 'itemId', type: 'textinput', label: 'Item-ID', default: '', useVariables: true }],
			callback: async (event) => {
				const id = await self.parseVariablesInString(event.options.itemId)
				await self.http('POST', `/Scenes/${encodeURIComponent(id.trim())}/Off`)
			},
		},

		scene_toggle: {
			name: 'Szene / Sequenz: Umschalten',
			options: [{ id: 'itemId', type: 'textinput', label: 'Item-ID', default: '', useVariables: true }],
			callback: async (event) => {
				const id = (await self.parseVariablesInString(event.options.itemId)).trim()
				const isOn = !!self.sceneActive[String(id)]
				await self.http('POST', `/Scenes/${encodeURIComponent(id)}/${isOn ? 'Off' : 'On'}`)
			},
		},

		set_color: {
			name: 'Farbe & Dimmer setzen',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: true },
				{ id: 'useColor', type: 'checkbox', label: 'Farbe setzen', default: true },
				{ id: 'color', type: 'colorpicker', label: 'Farbe', default: combineRgb(255, 0, 0) },
				{ id: 'useDimmer', type: 'checkbox', label: 'Dimmer setzen', default: true },
				{ id: 'dimmer', type: 'number', label: 'Dimmer %', default: 100, min: 0, max: 100 },
				{ id: 'fade', type: 'number', label: 'Überblendung (0..255)', default: 0, min: 0, max: 255 },
			],
			callback: async (event) => {
				const id = Number(await self.parseVariablesInString(event.options.id))
				const content = {}
				if (event.options.useDimmer) {
					content.MasterDimmer = { Default: false, Value: scale16(Math.round((event.options.dimmer / 100) * 255)), Fx: null }
				}
				if (event.options.useColor) {
					const { r, g, b } = splitRgb(event.options.color)
					content.RGB = {
						Default: false,
						Value: { Value1: scale16(r), Value2: scale16(g), Value3: scale16(b) },
						Fx: null,
					}
				}
				await self.setControl(event.options.target, id, content, event.options.fade)
			},
		},

		set_dimmer: {
			name: 'Dimmer setzen',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: true },
				{ id: 'dimmer', type: 'number', label: 'Dimmer %', default: 100, min: 0, max: 100 },
				{ id: 'fade', type: 'number', label: 'Überblendung (0..255)', default: 10, min: 0, max: 255 },
			],
			callback: async (event) => {
				const id = Number(await self.parseVariablesInString(event.options.id))
				const content = { MasterDimmer: { Default: false, Value: scale16(Math.round((event.options.dimmer / 100) * 255)), Fx: null } }
				await self.setControl(event.options.target, id, content, event.options.fade)
			},
		},

		blackout: {
			name: 'Blackout (Dimmer 0)',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: true },
				{ id: 'fade', type: 'number', label: 'Überblendung (0..255)', default: 10, min: 0, max: 255 },
			],
			callback: async (event) => {
				const id = Number(await self.parseVariablesInString(event.options.id))
				await self.setControl(event.options.target, id, { MasterDimmer: { Default: false, Value: 0, Fx: null } }, event.options.fade)
			},
		},

		color_chase: {
			name: 'Effekt: Farbwechsel (RGB-Fx)',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: true },
				{ id: 'c1', type: 'colorpicker', label: 'Farbe 1', default: combineRgb(255, 0, 0) },
				{ id: 'c2', type: 'colorpicker', label: 'Farbe 2', default: combineRgb(0, 255, 0) },
				{ id: 'c3', type: 'colorpicker', label: 'Farbe 3', default: combineRgb(0, 0, 255) },
				{ id: 'step', type: 'number', label: 'Haltezeit je Schritt (0..255)', default: 8, min: 0, max: 255 },
				{ id: 'fade', type: 'number', label: 'Überblendung je Schritt (0..255)', default: 8, min: 0, max: 255 },
				{ id: 'speed', type: 'number', label: 'Tempo (TimeMultiplier 0..255)', default: 128, min: 0, max: 255 },
			],
			callback: async (event) => {
				const id = Number(await self.parseVariablesInString(event.options.id))
				// FxScenes nutzen 8-bit-Farbwerte (0..255)
				const fxScene = (color) => {
					const { r, g, b } = splitRgb(color)
					return { Value1: r, Value2: g, Value3: b, StayTime: event.options.step, FadeTime: event.options.fade }
				}
				const content = {
					MasterDimmer: { Default: false, Value: 65535, Fx: null },
					RGB: {
						Default: false,
						Value: { Value1: 0, Value2: 0, Value3: 0 },
						Fx: {
							FxScenes: [fxScene(event.options.c1), fxScene(event.options.c2), fxScene(event.options.c3)],
							// Enums als Zahl: EffectType NONE=0, Geometrie FIXTURE=0, Trigger NONE=0
							Effect: { Value: 0, GeometrieType: 0, Bounce: false, Reverse: false, Range: 0, Variation: 0 },
							Trigger: { Start: 0, Jump: 0, Pos: false, Minimum: 0, Maximum: 0, Amplitude: { Treshold: 0, EQStart: 0, EQLength: 0 }, adaptBPMTime: false },
							Repeat: 255,
							TimeMultiplier: event.options.speed,
						},
					},
				}
				await self.setControl(event.options.target, id, content, 0)
			},
		},

		sound_trigger: {
			name: 'Sound Control: Trigger',
			options: [],
			callback: async () => {
				await self.http('POST', '/SoundControl/Trigger')
			},
		},
	})
}
