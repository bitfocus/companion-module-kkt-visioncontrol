// Builds ProgrammerContent for an RGB effect from a catalog or
// user entry. Enums are sent as numbers (the API requires this).
//
// Timing model (measured with a camera): duration per color step
//   ≈ (StayTime + FadeTime) × TimeMultiplier × 10 ms.
// A higher TimeMultiplier is therefore SLOWER, 0 freezes the effect.
//
// Range spreads pattern effects across the pixels. At 0 all pixels share the same
// phase (looks like a simple color cycle). The app templates use 10.

const UNIT_MS = 10
const DEFAULT_RANGE = 10

const pct16 = (p) => Math.round((Math.max(0, Math.min(100, Number(p))) / 100) * 65535)
const byte = (v, d = 0) => Math.max(0, Math.min(255, Math.round(Number(v ?? d) || 0)))

/**
 * Converts seconds per color step and softness (0..1 = fade share)
 * into StayTime, FadeTime and TimeMultiplier.
 */
function timing(sec, soft = 0.5) {
	const s = Math.max(0.02, Number(sec) || 1)
	const f = Math.max(0, Math.min(1, Number(soft) || 0))
	let tm = s < 1 ? 5 : 10
	let total = Math.round((s * 1000) / (UNIT_MS * tm))
	while (total > 510 && tm < 255) {
		tm = Math.min(255, tm * 2)
		total = Math.round((s * 1000) / (UNIT_MS * tm))
	}
	total = Math.max(1, Math.min(510, total))
	let fade = Math.round(total * f)
	let stay = total - fade
	if (fade > 255) {
		stay += fade - 255
		fade = 255
	}
	if (stay > 255) {
		fade = Math.min(255, fade + stay - 255)
		stay = 255
	}
	return { step: stay, fade, speed: tm }
}

/**
 * @param {object} e  { colors:[[r,g,b],...], effect, geometry, sec, soft
 *                      (or step, fade, speed), range, variation, bounce,
 *                      reverse, dimmer, trigger:{...} }
 */
function buildEffectContent(e) {
	const t = e.trigger || {}
	const tm = e.sec !== undefined ? timing(e.sec, e.soft) : { step: e.step, fade: e.fade, speed: e.speed }
	const isPattern = Number(e.effect) > 0
	return {
		MasterDimmer: { Default: false, Value: pct16(e.dimmer ?? 100), Fx: null },
		RGB: {
			Default: false,
			Value: { Value1: 0, Value2: 0, Value3: 0 },
			Fx: {
				FxScenes: e.colors.map(([r, g, b]) => ({
					Value1: byte(r),
					Value2: byte(g),
					Value3: byte(b),
					StayTime: byte(tm.step, 6),
					FadeTime: byte(tm.fade, 6),
				})),
				Effect: {
					Value: Number(e.effect) || 0,
					GeometrieType: Number(e.geometry) || 0,
					Bounce: !!e.bounce,
					Reverse: !!e.reverse,
					Range: byte(e.range ?? (isPattern ? DEFAULT_RANGE : 0)),
					Variation: byte(e.variation),
				},
				Trigger: {
					Start: Number(t.start) || 0,
					Jump: Number(t.jump) || 0,
					Pos: !!t.pos,
					Minimum: byte(t.min),
					Maximum: byte(t.max),
					Amplitude: {
						Treshold: Math.max(0, Math.min(65535, Math.round(Number(t.threshold) || 0))),
						EQStart: byte(t.eqStart),
						EQLength: byte(t.eqLength),
					},
					adaptBPMTime: !!t.adaptBpm,
				},
				Repeat: 255,
				// Never 0: that would freeze the effect
				TimeMultiplier: Math.max(1, byte(tm.speed, 10)),
			},
		},
	}
}

// ---- Readback and recognition ----------------------------------------------
// GET /Control returns enums as names; to send them again the API needs numbers.

const EFFECT_NAMES = [
	'NONE', 'CIRCLE', 'DIV2_RIGHT', 'DIV2_UP', 'WALL_RIGHT', 'WALL_UP', 'WALL_SPLIT_HORIZONTAL', 'WALL_SPLIT_VERTICAL',
	'ARROW_RIGHT', 'ARROW_UP', 'ARROW_ANGLE_45', 'ARROW_ANGLE_135', 'QUADRAT_OUTER', 'CIRCLE_OUTER', 'NOISE',
	'SNAKE_UP', 'SNAKE_RIGHT', 'RAIN_UP', 'RAIN_RIGHT', 'CHESS', 'PIXEL',
]
const GEOMETRY_NAMES = ['FIXTURE', 'SINGLE', 'PIXEL']
const TRIGGER_NAMES = ['NONE', 'TAP', 'BEAT', 'PULSE']

function enumIndex(value, names, prefix) {
	if (typeof value === 'number') return value
	const i = names.indexOf(String(value || '').replace(prefix, ''))
	return i < 0 ? 0 : i
}

/** Converts a read-back Fx object into a sendable form (enums as numbers). */
function fxFromReadback(fx) {
	if (!fx) return null
	const t = fx.Trigger || {}
	const a = t.Amplitude || {}
	return {
		FxScenes: (fx.FxScenes || []).map((s) => ({
			Value1: byte(s.Value1), Value2: byte(s.Value2), Value3: byte(s.Value3),
			StayTime: byte(s.StayTime), FadeTime: byte(s.FadeTime),
		})),
		Effect: {
			Value: enumIndex(fx.Effect && fx.Effect.Value, EFFECT_NAMES, 'EFFECT_TYPE_'),
			GeometrieType: enumIndex(fx.Effect && fx.Effect.GeometrieType, GEOMETRY_NAMES, 'GEOMETRIE_TYPE_'),
			Bounce: !!(fx.Effect && fx.Effect.Bounce),
			Reverse: !!(fx.Effect && fx.Effect.Reverse),
			Range: byte(fx.Effect && fx.Effect.Range),
			Variation: byte(fx.Effect && fx.Effect.Variation),
		},
		Trigger: {
			Start: enumIndex(t.Start, TRIGGER_NAMES, ''),
			Jump: enumIndex(t.Jump, TRIGGER_NAMES, ''),
			Pos: !!t.Pos,
			Minimum: byte(t.Minimum),
			Maximum: byte(t.Maximum),
			Amplitude: { Treshold: Math.max(0, Math.min(65535, Number(a.Treshold) || 0)), EQStart: byte(a.EQStart), EQLength: byte(a.EQLength) },
			adaptBPMTime: !!t.adaptBPMTime,
		},
		Repeat: byte(fx.Repeat, 255),
		TimeMultiplier: Math.max(1, byte(fx.TimeMultiplier, 10)),
	}
}

/** Fingerprint of an effect: pattern, geometry and color sequence. */
function fingerprint(effect, geometry, colors) {
	return `${Number(effect) || 0}|${Number(geometry) || 0}|${colors.map((c) => c.join(',')).join(';')}`
}

function fingerprintOfFx(fx) {
	const f = fxFromReadback(fx)
	return fingerprint(f.Effect.Value, f.Effect.GeometrieType, f.FxScenes.map((s) => [s.Value1, s.Value2, s.Value3]))
}

/** Estimated seconds per color step (first step) according to the timing model. */
function secondsOfFx(fx) {
	const f = fxFromReadback(fx)
	const s = f.FxScenes[0]
	if (!s) return 0
	return ((s.StayTime + s.FadeTime) * f.TimeMultiplier * UNIT_MS) / 1000
}

module.exports = { buildEffectContent, timing, pct16, DEFAULT_RANGE, fxFromReadback, fingerprint, fingerprintOfFx, secondsOfFx, EFFECT_NAMES }
