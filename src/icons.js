const fs = require('fs')
const path = require('path')

// Grafiken für die Presets: Symbole (scripts/import-icons.ps1) und Kacheln im
// App-Stil (scripts/build-icons.cjs). Bevorzugt aus src/icons.generated.json,
// damit sie im gebauten Companion-Paket enthalten sind; sonst aus ./icons.
let BUNDLE = {}
try {
	BUNDLE = require('./icons.generated.json')
} catch {
	BUNDLE = {}
}
const ICON_DIR = path.join(__dirname, '..', 'icons')
const cache = new Map()

function load(name) {
	if (cache.has(name)) return cache.get(name)
	let data = BUNDLE[name]
	if (!data) {
		try {
			data = fs.readFileSync(path.join(ICON_DIR, `${name}.png`)).toString('base64')
		} catch {
			data = undefined
		}
	}
	cache.set(name, data)
	return data
}

/**
 * Symbol als Base64-PNG (für style.png64) oder undefined.
 * @param {string} key      Symbolname, z. B. 'scene'
 * @param {'light'|'dark'} variant  'light' = weiße Glyphe, 'dark' = schwarze Glyphe
 */
function icon(key, variant = 'light') {
	return load(`${key}-${variant}`)
}

/** 72×72-Kachel im App-Stil (Farbverlauf + Motiv) oder undefined. */
function tile(id) {
	return load(`tile_${id}`)
}

module.exports = { icon, tile }
