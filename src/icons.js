const fs = require('fs')
const path = require('path')

// Graphics for the presets from the icon pack (scripts/build-icons.cjs):
// control icons, effect and color tiles, motif layers. Preferably from src/icons.generated.json,
// so they are included in the built Companion package; otherwise from ./icons.
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
 * Icon as base64 PNG (for style.png64) or undefined.
 * @param {string} key      icon name, e.g. 'scene'
 * @param {'light'|'dark'} variant  'light' = white glyph, 'dark' = black glyph
 */
function icon(key, variant = 'light') {
	return load(`${key}-${variant}`)
}

/** 72×72 tile (color gradient + glyph of the effect pattern) or undefined. */
function tile(id) {
	return load(`tile_${id}`)
}

/** Transparent motif layer for an effect type (0..20), for effects without a catalog tile. */
function overlay(effectType) {
	return load(`overlay_fx${Number(effectType) || 0}`)
}

module.exports = { icon, tile, overlay }
