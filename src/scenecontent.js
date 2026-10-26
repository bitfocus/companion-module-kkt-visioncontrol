// Fallback for the broken scene API (Vision Control 2.17.3 / 2.18.4):
// Translates a saved scene from the app's local scene files into
// control commands for POST /Control.
//
// Structure of a saved scene (CreativeScene): Groups[GroupID][component],
// 56 slots per group, empty = not set. Mapped after comparing with GET /Control:
//   4      Master dimmer (StaticIQComponent, Value 0..65535)
//   37–39  Red, Green, Blue – static (StaticIQComponent) or as an effect
//          (FxIQComponent: steps Item1 = value 0..255, Item2 = stay time,
//          Item3 = fade time, plus Effect/Trigger/Repeat/TimeMultiplier)
//   35     replaces the dimmer only if slot 4 is missing. Without either, the
//          app sets the dimmer to 100 %. Compared with starting the scene in the app
//          (GET /Control): "White Line" (4 = 100 %, 35 = 85 %) → 100 %,
//          "Red Dot" (only 35 = 100 %) → 100 %, "Test 35" (both 100 %) → 100 %.
// Other slots are not mapped yet and are skipped.

const DIMMER = 4
const RED = 37
const GREEN = 38
const BLUE = 39
const DIMMER_FALLBACK = 35
const DIM_FULL = 65535
const KNOWN = new Set([DIMMER, RED, GREEN, BLUE, DIMMER_FALLBACK])

const { fingerprintOfFx } = require('./fx')

const byte = (v) => Math.max(0, Math.min(255, Math.round(Number(v) || 0)))
const word = (v) => Math.max(0, Math.min(65535, Math.round(Number(v) || 0)))
const isFx = (c) => !!(c && c.Scene && Array.isArray(c.Scene.Scene))

function trigger(t = {}) {
	const a = t.Amplitude || {}
	return {
		Start: Number(t.Start) || 0,
		Jump: Number(t.Jump) || 0,
		Pos: !!t.Pos,
		Minimum: byte(t.Minimum),
		Maximum: byte(t.Maximum),
		Amplitude: { Treshold: word(a.Treshold), EQStart: byte(a.EQStart), EQLength: byte(a.EQLength) },
		adaptBPMTime: !!t.adaptBPMTime,
	}
}

/** Merge red/green/blue components into one RGB content for POST /Control */
function rgbContent(r, g, b) {
	const chans = [r, g, b]
	if (!chans.some(Boolean)) return null
	const lead = chans.find(isFx)
	if (!lead) {
		const v = (c) => (c ? word(c.Value) : 0)
		return { Default: false, Value: { Value1: v(r), Value2: v(g), Value3: v(b) }, Fx: null }
	}
	const steps = Math.max(...chans.filter(isFx).map((c) => c.Scene.Scene.length))
	// Value of a channel in step i: effect step, otherwise static value (16 → 8 bit)
	const val = (c, i) => {
		if (isFx(c)) {
			const s = c.Scene.Scene[i] || c.Scene.Scene[c.Scene.Scene.length - 1]
			return byte(s && s.Item1)
		}
		return c ? byte(word(c.Value) / 257) : 0
	}
	const FxScenes = []
	for (let i = 0; i < steps; i++) {
		const timing = lead.Scene.Scene[i] || lead.Scene.Scene[lead.Scene.Scene.length - 1] || {}
		FxScenes.push({ Value1: val(r, i), Value2: val(g, i), Value3: val(b, i), StayTime: byte(timing.Item2), FadeTime: byte(timing.Item3) })
	}
	const e = lead.Effect || {}
	return {
		Default: false,
		Value: { Value1: 0, Value2: 0, Value3: 0 },
		Fx: {
			FxScenes,
			Effect: {
				Value: Number(e.Value) || 0,
				GeometrieType: Number(e.GeometrieType) || 0,
				Bounce: !!e.Bounce,
				Reverse: !!(e.reverse ?? e.Reverse),
				Range: byte(e.Range),
				Variation: byte(e.Variation),
			},
			Trigger: trigger(lead.Trigger),
			Repeat: byte(lead.Repeat ?? 255),
			// Never 0: the effect would freeze
			TimeMultiplier: Math.max(1, byte(lead.TimeMultiplier)),
		},
	}
}

/**
 * @param {object} scene  CreativeScene from IQIQCreativeScenes.json
 * @returns {{ groups: {GroupID:number, Content:object}[], fade: number, skipped: number[] }}
 */
function sceneToControl(scene) {
	const groups = []
	const skipped = new Set()
	;(scene && Array.isArray(scene.Groups) ? scene.Groups : []).forEach((comps, gid) => {
		if (!Array.isArray(comps)) return
		comps.forEach((c, idx) => {
			if (c && !KNOWN.has(idx)) skipped.add(idx)
		})
		const content = {}
		const rgb = rgbContent(comps[RED], comps[GREEN], comps[BLUE])
		if (rgb) content.RGB = rgb
		// Dimmer like the app: slot 4, otherwise slot 35, otherwise full
		const dim = comps[DIMMER] || comps[DIMMER_FALLBACK]
		if (dim && isFx(dim)) skipped.add(comps[DIMMER] ? DIMMER : DIMMER_FALLBACK)
		else if (dim) content.MasterDimmer = { Default: false, Value: word(dim.Value), Fx: null }
		else if (rgb) content.MasterDimmer = { Default: false, Value: DIM_FULL, Fx: null }
		if (Object.keys(content).length) groups.push({ GroupID: gid, Content: content })
	})
	return { groups, fade: byte(scene && scene.Infade), skipped: [...skipped].sort((a, b) => a - b) }
}

/** Content for switching off: master dimmer of the affected groups to 0 */
function sceneOffControl(scene) {
	const { groups } = sceneToControl(scene)
	return {
		groups: groups.map((g) => ({ GroupID: g.GroupID, Content: { MasterDimmer: { Default: false, Value: 0, Fx: null } } })),
		fade: byte(scene && scene.Outfade),
	}
}

/** Comparison key for color/effect; speed and dimmer do not count */
function colorKey(rgb) {
	if (!rgb) return null
	if (rgb.Fx) return 'fx|' + fingerprintOfFx(rgb.Fx)
	const v = rgb.Value
	return v ? `static|${word(v.Value1)},${word(v.Value2)},${word(v.Value3)}` : null
}

/**
 * Is this scene currently running? True if all groups of the scene have exactly its
 * color or its color effect in the programmer (GET /Control). Brightness and
 * speed may differ, e.g. after using the rotary encoder.
 */
function sceneMatches(scene, programmer) {
	if (!scene || !programmer) return false
	const { groups } = sceneToControl(scene)
	const withColor = groups.filter((g) => g.Content.RGB)
	if (!withColor.length) return false
	return withColor.every((g) => {
		const cur = (programmer.Groups || []).find((x) => Number(x.GroupID) === g.GroupID)
		const key = colorKey(cur && cur.Content && cur.Content.RGB)
		return key !== null && key === colorKey(g.Content.RGB)
	})
}

module.exports = { sceneToControl, sceneOffControl, sceneMatches }
