// Rückfall für Szenennamen: In Vision Control 2.17.3 antwortet GET /Scenes mit
// HTTP 500 (auch wenn Szenen existieren). Läuft Companion auf demselben PC wie
// die App, lesen wir Namen und IDs aus den lokalen Szenendateien der App.
// Gelesen werden nur die Szenendateien, keine Netzwerk-/Passwortdaten.

const fs = require('fs')
const path = require('path')

const FILES = ['IQIQCreativeScenes.json', 'IQIQCreativeScenesNetwork.json']

function findLocalStateDirs() {
	const base = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Packages') : null
	if (!base || !fs.existsSync(base)) return []
	try {
		return fs
			.readdirSync(base)
			.filter((d) => /^KnzlerTechnologies\.VisionControl_/i.test(d))
			.map((d) => path.join(base, d, 'LocalState'))
			.filter((d) => fs.existsSync(d))
	} catch {
		return []
	}
}

/**
 * @returns {{ ItemId: number, Path: string, Type: string, Active: boolean, source: string }[]}
 */
function readLocalScenes() {
	const out = new Map()
	for (const dir of findLocalStateDirs()) {
		for (const file of FILES) {
			const full = path.join(dir, file)
			if (!fs.existsSync(full)) continue
			let data
			try {
				data = JSON.parse(fs.readFileSync(full, 'utf8'))
			} catch {
				continue
			}
			for (const item of (data && data.Scenes) || []) {
				const s = item && item.CreativeScene
				if (!s || s.ID === undefined) continue
				if (!out.has(s.ID)) {
					out.set(s.ID, { ItemId: s.ID, Path: String(s.Name || `Szene ${s.ID}`), Type: 'Scene', Active: false, source: 'local' })
				}
			}
		}
	}
	return [...out.values()].sort((a, b) => a.ItemId - b.ItemId)
}

module.exports = { readLocalScenes }
