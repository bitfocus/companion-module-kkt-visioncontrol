#!/usr/bin/env node
/*
 * Erzeugt das komplette Icon Pack des Moduls aus einer gemeinsamen
 * Glyphen-Bibliothek (scripts/iconpack/glyphs.cjs). Keine installierte App
 * nötig, läuft auf Windows, macOS und Linux.
 *
 *   node scripts/build-icons.cjs              SVG erzeugen, PNG rendern, bündeln
 *   node scripts/build-icons.cjs --svg <dir>  nur SVG-Quellen nach <dir> schreiben
 *   node scripts/build-icons.cjs --bundle     nur ./icons/*.png bündeln
 *
 * Ergebnis:
 *   icons/<name>-light.png / -dark.png   Steuer-Symbole 32 × 32 (weiß / fast schwarz)
 *   icons/tile_<id>.png / _active.png    Effekt- und Farbkacheln 72 × 72
 *   icons/overlay_fx<n>.png              durchsichtige Motiv-Ebenen 72 × 72
 *   src/icons.generated.json             alles als Base64 gebündelt
 */
const fs = require('fs')
const path = require('path')
const { CONTROL, MOTIF } = require('./iconpack/glyphs.cjs')
const { CATALOG, COLORS, EFFECT_MOTIF, motifFor } = require('../src/effects-data')
const { labelText } = require('../src/labels')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'icons')
const BUNDLE = path.join(ROOT, 'src', 'icons.generated.json')

// ---- Design-Tokens ----------------------------------------------------------
const TILE = 72 // Kachelgröße (Companion-Taste)
const GLYPH = 32 // Glyphengröße auf Kachel und als Steuer-Symbol (gleiche Strichstärke)
const RADIUS = 12 // Eckenradius der Kachel
const INK_LIGHT = '#FFFFFF'
const INK_DARK = '#111111'
const ACTIVE = '#FF7A00' // Rahmen "aktiv" (Veranstaltungstechnik König Orange)
const BAND_ALPHA = 0.45 // Schriftstreifen unten
const TILE_MAX_FONT = 18 // wie src/presets.js

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
const mix = ([r, g, b], f) => [r, g, b].map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)))
const luminance = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b

// Tinte nach der Helligkeit der Fläche hinter der Glyphe (Mitte des Verlaufs)
function inkFor(colors) {
	const avg = colors.reduce((s, c) => s + luminance(c), 0) / colors.length
	return avg > 165 ? INK_DARK : INK_LIGHT
}

// Glyphe aus dem 24er-Raster an Position/Größe setzen; weiße Tinte bekommt
// einen weichen Schatten in derselben Form, damit sie auch auf Gelb trägt.
function placeGlyph(draw, ink, x, y, size) {
	const s = size / 24
	const shadow = ink === INK_LIGHT ? `<g transform="translate(${x} ${y + 1.2}) scale(${s})" opacity="0.28">${draw('#000000')}</g>` : ''
	return `${shadow}<g transform="translate(${x} ${y}) scale(${s})">${draw(ink)}</g>`
}

function svgDoc(size, body) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`
}

// Steuer-Symbol 32 × 32, durchsichtig
function controlSvg(key, ink) {
	const s = GLYPH / 24
	return svgDoc(GLYPH, `<g transform="scale(${s})">${CONTROL[key](ink)}</g>`)
}

// Kachel: Effektfarben als Verlauf, Glyphe mittig im oberen Feld, Schriftstreifen unten
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

// Motiv-Ebene ohne Hintergrund (Farbe setzt Companion), gleiche Lage wie auf der Kachel
function overlaySvg(motif) {
	const field = TILE - 22
	const glyph = motif ? placeGlyph(MOTIF[motif], INK_LIGHT, (TILE - GLYPH) / 2, (field - GLYPH) / 2, GLYPH) : ''
	return svgDoc(TILE, `${glyph}<rect x="0" y="${field}" width="${TILE}" height="22" fill="#000000" fill-opacity="${BAND_ALPHA}"/>`)
}

// Alle Grafiken des Packs: Dateiname -> SVG
function buildAll() {
	const out = {}
	for (const key of Object.keys(CONTROL)) {
		out[`${key}-light`] = controlSvg(key, INK_LIGHT)
		out[`${key}-dark`] = controlSvg(key, INK_DARK)
	}
	for (const e of CATALOG) {
		const motif = motifFor(e) || 'cycle'
		const lines = labelText(e.name, TILE_MAX_FONT).lineCount
		out[`tile_${e.id}`] = tileSvg(e.colors, motif, { lines })
		out[`tile_${e.id}_active`] = tileSvg(e.colors, motif, { lines, active: true })
	}
	for (const c of COLORS) {
		const lines = labelText(c.name, TILE_MAX_FONT).lineCount
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
	console.log(`${Object.keys(data).length} Grafiken gebündelt in ${path.relative(ROOT, BUNDLE)}`)
}

function main() {
	const args = process.argv.slice(2)
	if (args[0] === '--bundle') return bundle()

	const all = buildAll()
	if (args[0] === '--svg') {
		const dir = path.resolve(args[1] || path.join(ROOT, 'icons-svg'))
		fs.mkdirSync(dir, { recursive: true })
		for (const [name, svg] of Object.entries(all)) fs.writeFileSync(path.join(dir, `${name}.svg`), svg)
		console.log(`${Object.keys(all).length} SVG-Quellen in ${dir}`)
		return
	}

	const { Resvg } = require('@resvg/resvg-js')
	fs.mkdirSync(OUT, { recursive: true })
	for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f))
	for (const [name, svg] of Object.entries(all)) {
		const size = name.endsWith('-light') || name.endsWith('-dark') ? GLYPH : TILE
		const png = new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: false } }).render().asPng()
		fs.writeFileSync(path.join(OUT, `${name}.png`), png)
	}
	console.log(`${Object.keys(all).length} Grafiken gerendert in icons/`)
	bundle()
}

main()
