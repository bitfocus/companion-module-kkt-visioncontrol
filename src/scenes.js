// Scenes and sequences from GET /Scenes: [{ ItemId, Path, Type, Active }]
// Path is the folder path on the scenes page incl. name, e.g. "Fitness/Spinning".

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

/** Display name of a scene (last path part), falling back to the ID */
function sceneName(scene) {
	return splitPath(scene && scene.Path).name || `Scene ${scene && scene.ItemId}`
}

function sceneFolder(scene) {
	return splitPath(scene && scene.Path).folder
}

/** Choice list for dropdowns */
function sceneChoices(scenes) {
	if (!Array.isArray(scenes) || scenes.length === 0) return [{ id: '', label: '(no scenes found in the app)' }]
	return scenes.map((s) => {
		const folder = sceneFolder(s)
		const kind = isSequence(s) ? ' · Sequence' : ''
		return { id: String(s.ItemId), label: `${sceneName(s)}${folder ? ` (${folder})` : ''}${kind}` }
	})
}

/** Short comparison key: changes with new, deleted, renamed or moved scenes */
function scenesSignature(scenes) {
	return (scenes || []).map((s) => `${s.ItemId}:${s.Path}:${s.Type}`).join('|')
}

module.exports = { sceneName, sceneFolder, sceneChoices, scenesSignature, isSequence }
