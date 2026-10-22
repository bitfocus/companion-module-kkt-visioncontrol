// Rückfall für Szenennamen: In Vision Control 2.17.3 und 2.18.4 antwortet GET /Scenes mit
// HTTP 500 (auch wenn Szenen existieren). Läuft Companion auf demselben PC wie
// die App, lesen wir Namen und IDs aus den lokalen Szenendateien der App.
// Gelesen werden nur die Szenendateien, keine Netzwerk-/Passwortdaten.

const fs = require('fs')
const os = require('os')
const path = require('path')

const FILES = ['IQIQCreativeScenes.json', 'IQIQCreativeScenesNetwork.json']

// Companion startet Module mit reduzierter Umgebung, LOCALAPPDATA fehlt dort.
// Daher zusätzlich über das Benutzerprofil suchen (os.homedir() fragt Windows direkt).
function packageBases() {
	const roots = [process.env.LOCALAPPDATA]
	try {
		roots.push(path.join(os.homedir(), 'AppData', 'Local'))
	} catch {
		// kein Benutzerprofil ermittelbar
	}
	if (process.env.USERPROFILE) roots.push(path.join(process.env.USERPROFILE, 'AppData', 'Local'))
	return [...new Set(roots.filter(Boolean).map((r) => path.join(r, 'Packages')))]
}

function findLocalStateDirs() {
	for (const base of packageBases()) {
		if (!fs.existsSync(base)) continue
		try {
			const dirs = fs
				.readdirSync(base)
				.filter((d) => /^KnzlerTechnologies\.VisionControl_/i.test(d))
				.map((d) => path.join(base, d, 'LocalState'))
				.filter((d) => fs.existsSync(d))
			if (dirs.length) return dirs
		} catch {
			// nächster Kandidat
		}
	}
	return []
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
					// detail: gespeicherte Werte, um die laufende Szene am Programmer zu erkennen
					out.set(s.ID, { ItemId: s.ID, Path: String(s.Name || `Szene ${s.ID}`), Type: 'Scene', Active: false, source: 'local', detail: s })
				}
			}
		}
	}
	return [...out.values()].sort((a, b) => a.ItemId - b.ItemId)
}

/** Gespeicherte Szene (CreativeScene) mit allen Werten, oder null */
function readLocalSceneDetail(id) {
	for (const dir of findLocalStateDirs()) {
		for (const file of FILES) {
			const full = path.join(dir, file)
			if (!fs.existsSync(full)) continue
			try {
				const data = JSON.parse(fs.readFileSync(full, 'utf8'))
				const hit = ((data && data.Scenes) || []).find((it) => it && it.CreativeScene && String(it.CreativeScene.ID) === String(id))
				if (hit) return hit.CreativeScene
			} catch {
				// nächste Datei
			}
		}
	}
	return null
}

/**
 * Beobachtet die Szenendateien der App und ruft onChange (entprellt) auf,
 * sobald die App eine Szene anlegt, umbenennt oder löscht.
 * @returns {() => void} beendet die Beobachtung
 */
function watchLocalScenes(onChange, debounceMs = 200) {
	let timer = null
	const watchers = []
	for (const dir of findLocalStateDirs()) {
		try {
			watchers.push(
				fs.watch(dir, (_event, file) => {
					if (file && !FILES.includes(String(file))) return
					if (timer) clearTimeout(timer)
					timer = setTimeout(() => {
						timer = null
						onChange()
					}, debounceMs)
				}),
			)
		} catch {
			// ohne Beobachtung bleibt die normale Abfrage
		}
	}
	return () => {
		if (timer) clearTimeout(timer)
		for (const w of watchers) w.close()
	}
}

module.exports = { readLocalScenes, readLocalSceneDetail, watchLocalScenes }
