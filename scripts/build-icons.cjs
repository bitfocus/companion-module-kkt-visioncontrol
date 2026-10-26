#!/usr/bin/env node
/*
 * Generates the module's complete icon pack from a shared
 * glyph library (scripts/iconpack/glyphs.cjs). No installed app
 * required, runs on Windows, macOS and Linux.
 *
 *   node scripts/build-icons.cjs              generate SVG, render PNG, bundle
 *   node scripts/build-icons.cjs --svg <dir>  only write SVG sources to <dir>
 *   node scripts/build-icons.cjs --bundle     only bundle ./icons/*.png
 *
 * Output:
 *   icons/<name>-light.png / -dark.png   control icons as a full button 72 × 72: icon
 *                                        28 px at the top, below free for text (white / near black)
 *   icons/tile_<id>.png / _active.png    effect and color tiles 72 × 72
 *   icons/overlay_fx<n>.png              transparent motif layers 72 × 72
 *   src/icons.generated.json             everything bundled as Base64
 */
const fs = require('fs')
const path = require('path')
const { CONTROL, MOTIF } = require('./iconpack/glyphs.cjs')
const { CATALOG, COLORS, EFFECT_MOTIF, motifFor } = require('../src/effects-data')
const { labelText } = require('../src/labels')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'icons')
const BUNDLE = path.join(ROOT, 'src', 'icons.generated.json')

// ---- Design tokens ----------------------------------------------------------
const TILE = 72 // Tile size (Companion button)
const GLYPH = 32 // Glyph size on the tile and as control icon (same stroke width)
const RADIUS = 12 // Corner radius of the tile
const INK_LIGHT = '#FFFFFF'
const INK_DARK = '#111111'
const ACTIVE = '#FF7A00' // "Active" frame (Veranstaltungstechnik König orange)
const BAND_ALPHA = 0.45 // Text strip at the bottom
const TILE_MAX_FONT = 18 // as in src/presets.js
const TILE_TEXT_HEIGHT = 34 // Space for the text on the tile, as in src/presets.js
// Control icon on the button. Companion 5 scales images to the full button
// ("fit"), so the icon already sits in its place within a 72 px area.
const BUTTON_GLYPH = 28
const BUTTON_GLYPH_Y = 5

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
const mix = ([r, g, b], f) => [r, g, b].map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)))
const luminance = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b

// Ink based on the brightness of the area behind the glyph (middle of the gradient)
function inkFor(colors) {
	const avg = colors.reduce((s, c) => s + luminance(c), 0) / colors.length
	return avg > 165 ? INK_DARK : INK_LIGHT
}

// Place a glyph from the 24 grid at position/size; white ink gets
// a soft shadow of the same shape so it still reads on yellow.
function placeGlyph(draw, ink, x, y, size) {
	const s = size / 24
	const shadow = ink === INK_LIGHT ? `<g transform="translate(${x} ${y + 1.2}) scale(${s})" opacity="0.28">${draw('#000000')}</g>` : ''
	return `${shadow}<g transform="translate(${x} ${y}) scale(${s})">${draw(ink)}</g>`
}

function svgDoc(size, body) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`
}

// Control icon as a full button 72 × 72, transparent, icon centered at the top
function controlSvg(key, ink) {
	const s = BUTTON_GLYPH / 24
	const x = (TILE - BUTTON_GLYPH) / 2
	return svgDoc(TILE, `<g transform="translate(${x} ${BUTTON_GLYPH_Y}) scale(${s})">${CONTROL[key](ink)}</g>`)
}

// Tile: effect colors as a gradient, glyph centered in the upper field, text strip at the bottom
function tileSvg(colors, motif, { lines = 1, active = false } = {}) {
	const stops = colors.length === 1 ? [mix(colors[0], 0.3), colors[0], mix(colors[0], -0.3)] : colors
	const stopTags = stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${hex(c)}"/>`).join('')
	const band = lines > 1 ? 34 : 22
	const field = TILE - band
	const gy = Math.max(3, (field - GLYPH) / 2)
	const glyph = motif ? placeGlyph(MOTIF[motif], inkFor(colors), (TILE - GLYPH) / 2, gy, GLYPH) : ''
	const frame = active ? `<rect x="1.75" y="1.75" width="${TILE - 3.5}" height="${TILE - 3.5}" rx="${RADIUS - 1.5}" fill="none" stroke="${ACTIVE}" stroke-width="3.5"/>` : ''
	return svgDoc(
		TILE,
		`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">${stopTags}</linearGradient><clipPath id="r"><rect width="${TILE}" height="${TILE}" rx="${RADIUS}"/></clipPath></defs>` +
			`<g clip-path="url(#r)"><rect width="${TILE}" height="${TILE}" fill="url(#g)"/>${glyph}` +
			`<rect x="0" y="${field}" width="${TILE}" height="${band}" fill="#000000" fill-opacity="${BAND_ALPHA}"/>${frame}</g>`,
	)
}

// Motif layer without background (Companion sets the color), same position as on the tile
function overlaySvg(motif) {
	const field = TILE - 22
	const glyph = motif ? placeGlyph(MOTIF[motif], INK_LIGHT, (TILE - GLYPH) / 2, (field - GLYPH) / 2, GLYPH) : ''
	return svgDoc(TILE, `${glyph}<rect x="0" y="${field}" width="${TILE}" height="22" fill="#000000" fill-opacity="${BAND_ALPHA}"/>`)
}

// All graphics of the pack: file name -> SVG
function buildAll() {
	const out = {}
	for (const key of Object.keys(CONTROL)) {
		out[`${key}-light`] = controlSvg(key, INK_LIGHT)
		out[`${key}-dark`] = controlSvg(key, INK_DARK)
	}
	for (const e of CATALOG) {
		const motif = motifFor(e) || 'cycle'
		const lines = labelText(e.name, TILE_MAX_FONT, TILE_TEXT_HEIGHT).lineCount
		out[`tile_${e.id}`] = tileSvg(e.colors, motif, { lines })
		out[`tile_${e.id}_active`] = tileSvg(e.colors, motif, { lines, active: true })
	}
	for (const c of COLORS) {
		const lines = labelText(c.name, TILE_MAX_FONT, TILE_TEXT_HEIGHT).lineCount
		out[`tile_color_${c.key}`] = tileSvg([c.rgb], 'drop', { lines })
		out[`tile_color_${c.key}_active`] = tileSvg([c.rgb], 'drop', { lines, active: true })
	}
	for (const [type, motif] of Object.entries(EFFECT_MOTIF)) {
		out[`overlay_fx${type}`] = overlaySvg(motif || 'cycle')
	}
	return out
}

function bundle() {
	const data = {}
	for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).sort()) {
		data[f.replace(/\.png$/, '')] = fs.readFileSync(path.join(OUT, f)).toString('base64')
	}
	fs.writeFileSync(BUNDLE, JSON.stringify(data))
	console.log(`${Object.keys(data).length} graphics bundled into ${path.relative(ROOT, BUNDLE)}`)
}

function main() {
	const args = process.argv.slice(2)
	if (args[0] === '--bundle') return bundle()

	const all = buildAll()
	if (args[0] === '--svg') {
		const dir = path.resolve(args[1] || path.join(ROOT, 'icons-svg'))
		fs.mkdirSync(dir, { recursive: true })
		for (const [name, svg] of Object.entries(all)) fs.writeFileSync(path.join(dir, `${name}.svg`), svg)
		console.log(`${Object.keys(all).length} SVG sources in ${dir}`)
		return
	}

	const { Resvg } = require('@resvg/resvg-js')
	fs.mkdirSync(OUT, { recursive: true })
	for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f))
	for (const [name, svg] of Object.entries(all)) {
		const size = TILE
		const png = new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: false } }).render().asPng()
		fs.writeFileSync(path.join(OUT, `${name}.png`), png)
	}
	console.log(`${Object.keys(all).length} graphics rendered to icons/`)
	bundle()
}

main()
