// Ersatz für die defekte Szenen-API (Vision Control 2.17.3 / 2.18.4):
// Übersetzt eine gespeicherte Szene aus den lokalen Szenendateien der App in
// Steuerbefehle für POST /Control.
//
// Aufbau einer gespeicherten Szene (CreativeScene): Groups[GroupID][Komponente],
// je Gruppe 56 Plätze, leer = nicht gesetzt. Belegt nach Abgleich mit GET /Control:
//   4      Master-Dimmer (StaticIQComponent, Value 0..65535)
//   37–39  Rot, Grün, Blau – fest (StaticIQComponent) oder als Effekt
//          (FxIQComponent: Schritte Item1 = Wert 0..255, Item2 = Stehzeit,
//          Item3 = Überblendzeit, dazu Effect/Trigger/Repeat/TimeMultiplier)
//   35     wird bewusst ignoriert: Startet die App selbst eine Szene, taucht der
//          Wert nicht im Programmer auf (geprüft mit "White Line": 35 = 85 %,
//          GET /Control zeigt nur Dimmer 100 % und den Farbeffekt).
// Andere Plätze sind noch nicht zugeordnet und werden übersprungen.

const DIMMER = 4
const RED = 37
const GREEN = 38
const BLUE = 39
const IGNORED = 35
const KNOWN = new Set([DIMMER, RED, GREEN, BLUE, IGNORED])

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

/** Rot/Grün/Blau-Komponenten zu einem RGB-Inhalt für POST /Control zusammenführen */
function rgbContent(r, g, b) {
	const chans = [r, g, b]
	if (!chans.some(Boolean)) return null
	const lead = chans.find(isFx)
	if (!lead) {
		const v = (c) => (c ? word(c.Value) : 0)
		return { Default: false, Value: { Value1: v(r), Value2: v(g), Value3: v(b) }, Fx: null }
	}
	const steps = Math.max(...chans.filter(isFx).map((c) => c.Scene.Scene.length))
	// Wert eines Kanals in Schritt i: Effekt-Schritt, sonst fester Wert (16 → 8 Bit)
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
			// Nie 0: dann bleibt der Effekt stehen
			TimeMultiplier: Math.max(1, byte(lead.TimeMultiplier)),
		},
	}
}

/**
 * @param {object} scene  CreativeScene aus IQIQCreativeScenes.json
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
		const dim = comps[DIMMER]
		if (dim && !isFx(dim)) content.MasterDimmer = { Default: false, Value: word(dim.Value), Fx: null }
		else if (dim) skipped.add(DIMMER)
		const rgb = rgbContent(comps[RED], comps[GREEN], comps[BLUE])
		if (rgb) content.RGB = rgb
		if (Object.keys(content).length) groups.push({ GroupID: gid, Content: content })
	})
	return { groups, fade: byte(scene && scene.Infade), skipped: [...skipped].sort((a, b) => a - b) }
}

/** Inhalt zum Ausschalten: Master-Dimmer der betroffenen Gruppen auf 0 */
function sceneOffControl(scene) {
	const { groups } = sceneToControl(scene)
	return {
		groups: groups.map((g) => ({ GroupID: g.GroupID, Content: { MasterDimmer: { Default: false, Value: 0, Fx: null } } })),
		fade: byte(scene && scene.Outfade),
	}
}

module.exports = { sceneToControl, sceneOffControl }
