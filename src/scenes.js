// Szenen und Sequenzen aus GET /Scenes: [{ ItemId, Path, Type, Active }]
// Path ist der Ordnerpfad der Szenen-Seite inkl. Name, z. B. "Fitness/Spinning".

function splitPath(path) {
	const parts = String(path || '')
		.split(/[\\/]/)
		.map((s) => s.trim())
		.filter(Boolean)
	const name = parts.pop() || ''
	return { name, folder: parts.join(' / ') }
}

function isSequence(scene) {
	const t = scene && scene.Type
	return t === 'Sequence' || t === 1
}

/** Anzeigename einer Szene (letzter Pfadteil), Rückfall auf die ID */
function sceneName(scene) {
	return splitPath(scene && scene.Path).name || `Szene ${scene && scene.ItemId}`
}

function sceneFolder(scene) {
	return splitPath(scene && scene.Path).folder
}

/** Auswahlliste für Dropdowns */
function sceneChoices(scenes) {
	if (!Array.isArray(scenes) || scenes.length === 0) return [{ id: '', label: '(keine Szenen in der App gefunden)' }]
	return scenes.map((s) => {
		const folder = sceneFolder(s)
		const kind = isSequence(s) ? ' · Sequenz' : ''
		return { id: String(s.ItemId), label: `${sceneName(s)}${folder ? ` (${folder})` : ''}${kind}` }
	})
}

/** Kurzer Vergleichsschlüssel: ändert sich bei neuen, gelöschten, umbenannten oder verschobenen Szenen */
function scenesSignature(scenes) {
	return (scenes || []).map((s) => `${s.ItemId}:${s.Path}:${s.Type}`).join('|')
}

module.exports = { sceneName, sceneFolder, sceneChoices, scenesSignature, isSequence }
