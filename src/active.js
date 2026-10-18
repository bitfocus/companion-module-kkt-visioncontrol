// Erkennt den aktiven Effekt aus dem zurückgelesenen Programmer (GET /Control)
// und berechnet Anpassungen (Tempo, Helligkeit, Range) des laufenden Effekts.
// Reine Funktionen ohne Companion-Abhängigkeit, damit sie testbar sind.

const { CATALOG, CATALOG_BY_ID, COLORS } = require('./effects-data')
const { fingerprint, fingerprintOfFx, fxFromReadback, secondsOfFx } = require('./fx')

const CATALOG_BY_FP = new Map(CATALOG.map((e) => [fingerprint(e.effect, e.geometry || 0, e.colors), e.id]))

/** Inhalt (Content) einer Gruppe bzw. eines Fixtures aus GET /Control */
function findContent(programmer, target, id) {
	if (!programmer) return null
	const list = target === 'fixture' ? programmer.Fixtures : programmer.Groups
	const key = target === 'fixture' ? 'RDMID' : 'GroupID'
	const hit = (list || []).find((x) => Number(x[key]) === Number(id))
	return hit ? hit.Content : null
}

/** Fingerabdruck eines vom Modul gesendeten Eintrags */
function fingerprintOfEntry(entry) {
	return fingerprint(entry.effect, entry.geometry || 0, entry.colors)
}

/**
 * Beschreibt, was gerade läuft.
 * @param {object|null} content   Content aus GET /Control
 * @param {{id:string, fp:string}|undefined} lastSent  zuletzt vom Modul gesendet
 */
function describeActive(content, lastSent) {
	const out = { id: null, name: 'Nichts aktiv', category: '', seconds: null, dimmerPct: null, range: null }
	if (!content) return out
	const dim = content.MasterDimmer && typeof content.MasterDimmer.Value === 'number' ? content.MasterDimmer.Value : null
	if (dim !== null) out.dimmerPct = Math.round((dim / 65535) * 100)

	const rgb = content.RGB || {}
	if (rgb.Fx) {
		const fp = fingerprintOfFx(rgb.Fx)
		const id = lastSent && lastSent.fp === fp ? lastSent.id : CATALOG_BY_FP.get(fp)
		const entry = id ? CATALOG_BY_ID[id] : null
		out.id = entry ? entry.id : 'custom'
		out.name = entry ? entry.name : 'App / Benutzerdefiniert'
		out.category = entry ? entry.cat : 'App'
		out.seconds = Math.round(secondsOfFx(rgb.Fx) * 100) / 100
		out.range = fxFromReadback(rgb.Fx).Effect.Range
	} else if (rgb.Value && typeof rgb.Value.Value1 === 'number') {
		const v = [rgb.Value.Value1, rgb.Value.Value2, rgb.Value.Value3]
		const col = COLORS.find((c) => c.rgb.every((x, i) => Math.abs(x * 257 - v[i]) <= 400))
		out.id = col ? `color:${col.key}` : 'color'
		out.name = col ? `Farbe ${col.name}` : 'Farbe'
		out.category = 'Farben'
	}
	if (out.dimmerPct === 0) {
		out.id = 'off'
		out.name = 'Aus'
	}
	return out
}

/**
 * Berechnet einen Teil-Content zum Anpassen des laufenden Effekts.
 * @returns {object|null} Content für POST /Control oder null, wenn nicht möglich
 */
function adjustContent(content, what, percent = 20, rangeStep = 5) {
	if (!content) return null
	const p = Math.max(0.01, Math.min(1, percent / 100))

	if (what === 'brighter' || what === 'darker') {
		const cur = content.MasterDimmer && typeof content.MasterDimmer.Value === 'number' ? content.MasterDimmer.Value : 65535
		const delta = Math.round(p * 65535) * (what === 'brighter' ? 1 : -1)
		const value = Math.max(0, Math.min(65535, cur + delta))
		return { MasterDimmer: { Default: false, Value: value, Fx: null } }
	}

	const fxRead = content.RGB && content.RGB.Fx
	if (!fxRead) return null
	const fx = fxFromReadback(fxRead)

	if (what === 'faster' || what === 'slower') {
		const factor = what === 'faster' ? 1 - p : 1 + p
		let tm = Math.round(fx.TimeMultiplier * factor)
		if (tm === fx.TimeMultiplier) tm += what === 'faster' ? -1 : 1
		if (tm >= 1 && tm <= 255) {
			fx.TimeMultiplier = tm
		} else {
			// Zeitfaktor am Anschlag: stattdessen die Schrittzeiten skalieren
			fx.TimeMultiplier = Math.max(1, Math.min(255, tm))
			for (const s of fx.FxScenes) {
				s.StayTime = Math.max(0, Math.min(255, Math.round(s.StayTime * factor)))
				s.FadeTime = Math.max(0, Math.min(255, Math.round(s.FadeTime * factor)))
				if (s.StayTime + s.FadeTime === 0) s.StayTime = 1
			}
		}
	} else if (what === 'range_up' || what === 'range_down') {
		const d = what === 'range_up' ? rangeStep : -rangeStep
		fx.Effect.Range = Math.max(0, Math.min(255, fx.Effect.Range + d))
	} else {
		return null
	}
	return { RGB: { Default: false, Value: { Value1: 0, Value2: 0, Value3: 0 }, Fx: fx } }
}

module.exports = { findContent, describeActive, adjustContent, fingerprintOfEntry }
