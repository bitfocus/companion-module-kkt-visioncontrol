// Fallback for scene names: in Vision Control 2.17.3 and 2.18.4, GET /Scenes responds with
// HTTP 500 (even if scenes exist). If Companion runs on the same PC as
// the app, we read names and IDs from the app's local scene files.
// Only the scene files are read, no network/password data.

const fs = require('fs')
const os = require('os')
const path = require('path')

const FILES = ['IQIQCreativeScenes.json', 'IQIQCreativeScenesNetwork.json']

// Companion starts modules with a reduced environment, LOCALAPPDATA is missing there.
// So also search via the user profile (os.homedir() asks Windows directly).
function packageBases() {
	const roots = [process.env.LOCALAPPDATA]
	try {
		roots.push(path.join(os.homedir(), 'AppData', 'Local'))
	} catch {
		// no user profile could be determined
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
			// next candidate
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
					// detail: saved values, used to recognize the running scene in the programmer
					out.set(s.ID, { ItemId: s.ID, Path: String(s.Name || `Scene ${s.ID}`), Type: 'Scene', Active: false, source: 'local', detail: s })
				}
			}
		}
	}
	return [...out.values()].sort((a, b) => a.ItemId - b.ItemId)
}

/** Saved scene (CreativeScene) with all values, or null */
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
				// next file
			}
		}
	}
	return null
}

/**
 * Watches the app's scene files and calls onChange (debounced)
 * as soon as the app creates, renames or deletes a scene.
 * @returns {() => void} stops watching
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
			// without watching, the normal poll remains
		}
	}
	return () => {
		if (timer) clearTimeout(timer)
		for (const w of watchers) w.close()
	}
}

module.exports = { readLocalScenes, readLocalSceneDetail, watchLocalScenes }
