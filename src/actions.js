const { combineRgb } = require('@companion-module/base')
const { CATALOG, CATALOG_BY_ID } = require('./effects-data')
const { buildEffectContent } = require('./fx')
const { sceneChoices } = require('./scenes')

const CATALOG_CHOICES = CATALOG.map((e) => ({ id: e.id, label: `${e.cat}: ${e.name}` }))

// Text fields also offer the button's local variables ($(local:…), $(this:…))
const LOCAL_VARS = { local: true }

// Timing in understandable units. Note: the API's raw TimeMultiplier is a
// time factor (higher = slower, 0 = stopped); src/fx.js converts it.
const TIMING_OPTIONS = (sec, softPct) => [
	{ id: 'sec', type: 'number', label: 'Seconds per color step', default: sec, min: 0.05, max: 120, step: 0.05 },
	{ id: 'soft', type: 'number', label: 'Softness % (share of fade)', default: softPct, min: 0, max: 100 },
]

// Only show the field when the checkbox is set (newer and older Companion versions)
function visibleIf(checkboxId) {
	return {
		isVisibleExpression: `$(options:${checkboxId})`,
		isVisible: new Function('options', `return !!options['${checkboxId}']`),
	}
}

// New buttons provide sec/soft; older buttons still step/fade/speed.
function timingFrom(o) {
	if (o.sec !== undefined && o.sec !== null && o.sec !== '') return { sec: Number(o.sec), soft: (Number(o.soft) || 0) / 100 }
	return { step: o.step, fade: o.fade, speed: o.speed }
}

// FxComponentTrigger-Enum
const TRIGGERS = [
	{ id: 0, label: 'None (runs free)' },
	{ id: 1, label: 'Tap' },
	{ id: 2, label: 'Beat (music beat)' },
	{ id: 3, label: 'Pulse (volume / frequency band)' },
]

// Companion colorpicker provides 24-bit RGB (0xRRGGBB).
function splitRgb(value) {
	const v = Number(value) || 0
	return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff }
}
// 8-bit (0..255) -> 16-bit (0..65535) of the Vision API
const scale16 = (x) => Math.round((x / 255) * 65535)
// Percent (0..100) -> 16-bit (0..65535)
const pct16 = (p) => Math.round((Math.max(0, Math.min(100, p)) / 100) * 65535)

const TARGETS = [
	{ id: 'group', label: 'Group (GroupID)' },
	{ id: 'fixture', label: 'Fixture (RDMID)' },
]

// EffectType enum (sent to the API as a number)
const EFFECTS = [
	{ id: 0, label: 'No pattern (color cycle only)' },
	{ id: 1, label: 'Circle' },
	{ id: 2, label: 'Split 2 right' },
	{ id: 3, label: 'Split 2 up' },
	{ id: 4, label: 'Wall right' },
	{ id: 5, label: 'Wall up' },
	{ id: 6, label: 'Wall split horizontal' },
	{ id: 7, label: 'Wall split vertical' },
	{ id: 8, label: 'Arrow right' },
	{ id: 9, label: 'Arrow up' },
	{ id: 10, label: 'Arrow 45°' },
	{ id: 11, label: 'Arrow 135°' },
	{ id: 12, label: 'Square outward' },
	{ id: 13, label: 'Circle outward' },
	{ id: 14, label: 'Noise' },
	{ id: 15, label: 'Snake up' },
	{ id: 16, label: 'Snake right' },
	{ id: 17, label: 'Rain up' },
	{ id: 18, label: 'Rain right' },
	{ id: 19, label: 'Chess' },
	{ id: 20, label: 'Pixels' },
]

// EffectGeometrie enum: determines what the effect is spread across.
const GEOMETRY = [
	{ id: 0, label: 'Device (whole fixtures)' },
	{ id: 1, label: 'Individual' },
	{ id: 2, label: 'Pixel / Matrix' },
]

module.exports = function (self) {
	// Resolve variables in the button's context, incl. local variables
	// ($(local:…), $(this:…)). Older Companion versions without context: global.
	const parse = (context, text) =>
		context && typeof context.parseVariablesInString === 'function'
			? context.parseVariablesInString(String(text ?? ''))
			: self.parseVariablesInString(String(text ?? ''))

	// Scenes from the app as choices; a custom item ID or variable is still possible
	const sceneList = sceneChoices(self.scenes)
	const sceneOption = () => ({
		id: 'itemId',
		type: 'dropdown',
		label: 'Scene / Sequence',
		default: sceneList[0].id,
		choices: sceneList,
		allowCustom: true,
		tooltip: 'Scenes from the Vision Control app. A custom item ID or variable is also possible, including local ones, e.g. $(local:scene).',
	})
	const sceneId = async (raw, context) => {
		const id = String(await parse(context, String(raw ?? ''))).trim()
		if (!id) throw new Error('No scene selected')
		return id
	}

	self.setActionDefinitions({
		scene_on: {
			name: 'Scene / Sequence: On',
			options: [sceneOption()],
			callback: async (event, context) => {
				const id = await sceneId(event.options.itemId, context)
				await self.switchScene(id, true)
			},
		},

		scene_off: {
			name: 'Scene / Sequence: Off',
			options: [sceneOption()],
			callback: async (event, context) => {
				const id = await sceneId(event.options.itemId, context)
				await self.switchScene(id, false)
			},
		},

		scene_toggle: {
			name: 'Scene / Sequence: Toggle',
			options: [sceneOption()],
			callback: async (event, context) => {
				const id = await sceneId(event.options.itemId, context)
				const isOn = !!self.sceneActive[String(id)]
				await self.switchScene(id, !isOn)
				// Toggle the local state right away so fast repeated clicks do not
				// wait for the poll interval; the next poll corrects it.
				self.sceneActive[String(id)] = !isOn
				self.checkFeedbacks('scene_active')
			},
		},

		set_color: {
			name: 'Set color & dimmer',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'useColor', type: 'checkbox', label: 'Set color', default: true },
				{ id: 'color', type: 'colorpicker', label: 'Color', default: combineRgb(255, 0, 0) },
				{ id: 'useDimmer', type: 'checkbox', label: 'Set dimmer', default: true },
				{ id: 'dimmer', type: 'number', label: 'Dimmer %', default: 100, min: 0, max: 100 },
				{ id: 'fade', type: 'number', label: 'Fade (0 = instant … 255 = max, not seconds)', default: 0, min: 0, max: 255 },
			],
			callback: async (event, context) => {
				const id = Number(await parse(context, event.options.id))
				const content = {}
				if (event.options.useDimmer) {
					content.MasterDimmer = { Default: false, Value: pct16(event.options.dimmer), Fx: null }
				}
				if (event.options.useColor) {
					const { r, g, b } = splitRgb(event.options.color)
					content.RGB = {
						Default: false,
						Value: { Value1: scale16(r), Value2: scale16(g), Value3: scale16(b) },
						Fx: null,
					}
				}
				if (content.MasterDimmer) self.noteDimmer(event.options.target, id, content.MasterDimmer.Value)
				await self.setControl(event.options.target, id, content, event.options.fade)
			},
		},

		set_dimmer: {
			name: 'Set dimmer',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'dimmer', type: 'number', label: 'Dimmer %', default: 100, min: 0, max: 100 },
				{ id: 'fade', type: 'number', label: 'Fade (0 = instant … 255 = max, not seconds)', default: 10, min: 0, max: 255 },
			],
			callback: async (event, context) => {
				const id = Number(await parse(context, event.options.id))
				const content = { MasterDimmer: { Default: false, Value: pct16(event.options.dimmer), Fx: null } }
				self.noteDimmer(event.options.target, id, content.MasterDimmer.Value)
				await self.setControl(event.options.target, id, content, event.options.fade)
			},
		},

		blackout: {
			name: 'Blackout (Dimmer 0)',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'fade', type: 'number', label: 'Fade (0 = instant … 255 = max, not seconds)', default: 10, min: 0, max: 255 },
			],
			callback: async (event, context) => {
				const id = Number(await parse(context, event.options.id))
				self.noteDimmer(event.options.target, id, 0)
				await self.setControl(event.options.target, id, { MasterDimmer: { Default: false, Value: 0, Fx: null } }, event.options.fade)
			},
		},

		dimmer_step: {
			name: 'Brightness step by step (rotary encoder)',
			description: 'For rotary encoders, e.g. Stream Deck +: turn left = negative step, right = positive. Fast turning is combined.',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'step', type: 'number', label: 'Step in percentage points (negative = darker)', default: 5, min: -100, max: 100 },
			],
			callback: async (event, context) => {
				const id = Number(await parse(context, event.options.id))
				await self.stepDimmer(event.options.target, id, Number(event.options.step) || 0)
			},
		},

		dimmer_toggle: {
			name: 'Blackout on/off (remember brightness)',
			description: 'Switches to 0 and, the next time, back to the previous brightness.',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'fade', type: 'number', label: 'Fade (0 = instant … 255 = max, not seconds)', default: 0, min: 0, max: 255 },
			],
			callback: async (event, context) => {
				const id = Number(await parse(context, event.options.id))
				await self.toggleBlackout(event.options.target, id, event.options.fade)
			},
		},

		color_chase: {
			name: 'Effect: Color change (RGB Fx)',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'c1', type: 'colorpicker', label: 'Color 1', default: combineRgb(255, 0, 0) },
				{ id: 'c2', type: 'colorpicker', label: 'Color 2', default: combineRgb(0, 255, 0) },
				{ id: 'c3', type: 'colorpicker', label: 'Color 3', default: combineRgb(0, 0, 255) },
				...TIMING_OPTIONS(1.5, 60),
			],
			callback: async (event, context) => {
				const o = event.options
				const id = Number(await parse(context, o.id))
				const rgb = (c) => {
					const { r, g, b } = splitRgb(c)
					return [r, g, b]
				}
				const content = buildEffectContent({ colors: [rgb(o.c1), rgb(o.c2), rgb(o.c3)], effect: 0, geometry: 0, ...timingFrom(o) })
				await self.setControl(o.target, id, content, 0)
			},
		},

		rgb_effect: {
			name: 'Effect: Pattern & Geometry (Pixel / Matrix)',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'effect', type: 'dropdown', label: 'Pattern', default: 20, choices: EFFECTS },
				{ id: 'geometry', type: 'dropdown', label: 'Geometry', default: 2, choices: GEOMETRY },
				{ id: 'c1', type: 'colorpicker', label: 'Color 1', default: combineRgb(255, 0, 0) },
				{ id: 'c2', type: 'colorpicker', label: 'Color 2', default: combineRgb(0, 0, 255) },
				{ id: 'useC3', type: 'checkbox', label: 'Use third color', default: false },
				{ id: 'c3', type: 'colorpicker', label: 'Color 3', default: combineRgb(0, 255, 0) },
				...TIMING_OPTIONS(1.2, 85),
				{ id: 'range', type: 'number', label: 'Spread across the pixels / Range (0 = all the same, app default 10)', default: 10, min: 0, max: 255 },
				{ id: 'variation', type: 'number', label: 'Variation (0..255)', default: 0, min: 0, max: 255 },
				{ id: 'bounce', type: 'checkbox', label: 'Bounce (back and forth)', default: false },
				{ id: 'reverse', type: 'checkbox', label: 'Reverse', default: false },
				{ id: 'trigger', type: 'dropdown', label: 'Trigger', default: 0, choices: TRIGGERS },
				{ id: 'adaptBpm', type: 'checkbox', label: 'Adapt to BPM (with Beat)', default: true },
				{ id: 'threshold', type: 'number', label: 'Pulse: level threshold (0..65535)', default: 2500, min: 0, max: 65535 },
				{ id: 'eqStart', type: 'number', label: 'Pulse: frequency band start (0..255)', default: 0, min: 0, max: 255 },
				{ id: 'eqLength', type: 'number', label: 'Pulse: frequency band width (0..255)', default: 6, min: 0, max: 255 },
				{ id: 'dimmer', type: 'number', label: 'Brightness %', default: 100, min: 0, max: 100 },
			],
			callback: async (event, context) => {
				const o = event.options
				const id = Number(await parse(context, o.id))
				const rgb = (c) => {
					const { r, g, b } = splitRgb(c)
					return [r, g, b]
				}
				const colors = [rgb(o.c1), rgb(o.c2)]
				if (o.useC3) colors.push(rgb(o.c3))
				const trig = Number(o.trigger) || 0
				const content = buildEffectContent({
					colors,
					effect: o.effect,
					geometry: o.geometry,
					...timingFrom(o),
					range: o.range,
					variation: o.variation,
					bounce: o.bounce,
					reverse: o.reverse,
					dimmer: o.dimmer ?? 100,
					trigger:
						trig === 3
							? { start: 3, min: 0, max: 255, threshold: o.threshold, eqStart: o.eqStart, eqLength: o.eqLength }
							: { start: trig, adaptBpm: trig === 2 && o.adaptBpm },
				})
				await self.setControl(o.target, id, content, 0)
			},
		},

		vision_effect: {
			name: 'Effect from catalog (incl. fitness studio)',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'effect', type: 'dropdown', label: 'Effect', default: CATALOG[0].id, choices: CATALOG_CHOICES },
				{ id: 'overrideDimmer', type: 'checkbox', label: 'Override brightness', default: false },
				{ id: 'dimmer', type: 'number', label: 'Brightness %', default: 100, min: 0, max: 100, ...visibleIf('overrideDimmer') },
				{ id: 'overrideTiming', type: 'checkbox', label: 'Override speed', default: false },
				{ id: 'sec', type: 'number', label: 'Seconds per color step', default: 1.2, min: 0.05, max: 120, step: 0.05, ...visibleIf('overrideTiming') },
				{ id: 'soft', type: 'number', label: 'Softness % (share of fade)', default: 80, min: 0, max: 100, ...visibleIf('overrideTiming') },
				{ id: 'overrideRange', type: 'checkbox', label: 'Override range (patterns only)', default: false },
				{ id: 'range', type: 'number', label: 'Range (0 = all pixels the same, default 10)', default: 10, min: 0, max: 255, ...visibleIf('overrideRange') },
				{ id: 'overrideColors', type: 'checkbox', label: 'Override colors', default: false },
				{ id: 'c1', type: 'colorpicker', label: 'Color 1', default: combineRgb(255, 0, 0), ...visibleIf('overrideColors') },
				{ id: 'c2', type: 'colorpicker', label: 'Color 2', default: combineRgb(0, 0, 255), ...visibleIf('overrideColors') },
				{ id: 'useC3', type: 'checkbox', label: 'Use third color', default: false, ...visibleIf('overrideColors') },
				{ id: 'c3', type: 'colorpicker', label: 'Color 3', default: combineRgb(0, 255, 0), ...visibleIf('overrideColors') },
				{ id: 'reverse', type: 'checkbox', label: 'Reverse direction', default: false },
			],
			callback: async (event, context) => {
				const o = event.options
				const base = CATALOG_BY_ID[o.effect]
				if (!base) throw new Error(`Unknown catalog effect: ${o.effect}`)
				const id = Number(await parse(context, o.id))
				const entry = { ...base }
				if (o.overrideDimmer) entry.dimmer = o.dimmer
				if (o.overrideTiming) Object.assign(entry, { sec: Number(o.sec), soft: (Number(o.soft) || 0) / 100 })
				if (o.overrideRange) entry.range = o.range
				if (o.overrideColors) {
					const rgb = (c) => {
						const { r, g, b } = splitRgb(c)
						return [r, g, b]
					}
					entry.colors = [rgb(o.c1), rgb(o.c2)]
					if (o.useC3) entry.colors.push(rgb(o.c3))
				}
				if (o.reverse) entry.reverse = true
				const content = buildEffectContent(entry)
				await self.setControl(o.target, id, content, 0)
				self.markSent(o.target, id, base.id, entry)
			},
		},

		adjust_effect: {
			name: 'Adjust running effect (speed, brightness, range)',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{
					id: 'what',
					type: 'dropdown',
					label: 'Change',
					default: 'faster',
					choices: [
						{ id: 'faster', label: 'Faster' },
						{ id: 'slower', label: 'Slower' },
						{ id: 'brighter', label: 'Brighter' },
						{ id: 'darker', label: 'Darker' },
						{ id: 'range_up', label: 'Increase range (spread wider)' },
						{ id: 'range_down', label: 'Decrease range' },
					],
				},
				{ id: 'percent', type: 'number', label: 'Step in % (speed / brightness)', default: 20, min: 1, max: 100 },
				{ id: 'rangeStep', type: 'number', label: 'Step in range points', default: 5, min: 1, max: 100 },
			],
			callback: async (event, context) => {
				const o = event.options
				const id = Number(await parse(context, o.id))
				await self.adjustActive(o.target, id, o.what, Number(o.percent) || 20, Number(o.rangeStep) || 5)
			},
		},

		sound_trigger: {
			name: 'Sound Control: Trigger',
			options: [],
			callback: async () => {
				await self.expectHandled(await self.http('POST', '/SoundControl/Trigger'), 'Sound trigger')
			},
		},
	})
}
