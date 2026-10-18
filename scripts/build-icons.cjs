#!/usr/bin/env node
/*
 * Erzeugt Kachelbilder im Stil der Vision Control App (Farbverlauf der
 * Effektfarben + Original-Motiv) für alle Katalog-Effekte und Farb-Presets.
 *
 * Die Motive liest das Skript aus der installierten App (IQ_Maui.dll), rendert
 * sie nach ./icons und bündelt danach alle PNGs aus ./icons (Kacheln und
 * Symbole aus import-icons.ps1) in src/icons.generated.json, damit sie auch im
 * gebauten Companion-Paket enthalten sind.
 *
 *   node scripts/build-icons.cjs [Pfad-zum-App-Ordner]
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const { Resvg } = require('@resvg/resvg-js')
const { CATALOG, COLORS, MOTIFS, motifFor } = require('../src/effects-data')
const { labelText } = require('../src/labels')

// Größte Schriftstufe auf Kacheln (der Streifen unten ist niedrig)
const TILE_MAX_FONT = 18
const ACTIVE_COLOR = '#FF7A00'

const OUT = path.join(__dirname, '..', 'icons')
const SIZE = 72

function findAppDir() {
	if (process.argv[2]) return process.argv[2]
	const cmd = 'powershell -NoProfile -Command "(Get-AppxPackage | Where-Object { $_.Name -like \'*VisionControl*\' } | Select-Object -First 1).InstallLocation"'
	const dir = execSync(cmd, { encoding: 'utf8' }).trim()
	if (!dir) throw new Error('Vision Control App nicht gefunden. Pfad als Argument angeben.')
	return dir
}

// Eingebettete SVGs in derselben Reihenfolge wie beim Analysieren extrahieren
function extractSvgs(dll) {
	const buf = fs.readFileSync(dll)
	const list = []
	for (const enc of ['utf8', 'utf16le']) {
		const open = Buffer.from('<svg', enc)
		const close = Buffer.from('</svg>', enc)
		let p = 0
		while ((p = buf.indexOf(open, p)) !== -1) {
			const e = buf.indexOf(close, p)
			if (e === -1 || e - p > 400000) {
				p += open.length
				continue
			}
			list.push(buf.subarray(p, e + close.length).toString(enc))
			p = e + close.length
		}
	}
	return list
}

function resolveMotifs(svgs) {
	const byHash = new Map(svgs.map((s, i) => [crypto.createHash('sha1').update(s).digest('hex').slice(0, 12), i]))
	const out = {}
	for (const [name, [hash, fallback]] of Object.entries(MOTIFS)) {
		const idx = byHash.has(hash) ? byHash.get(hash) : fallback
		out[name] = svgs[idx]
		if (!byHash.has(hash)) console.warn(`Motiv ${name}: Fingerabdruck nicht gefunden, nutze Position ${fallback}`)
	}
	return out
}

// Motiv-SVG als verschachteltes <svg> an Position/Größe setzen
function nest(svg, x, y, size) {
	const open = svg.match(/<svg\b[^>]*>/)[0]
	// Vorhandene Positions-/Skalierungsattribute entfernen, sonst doppelte Attribute
	let tag = open.replace(/\s(width|height|x|y|preserveAspectRatio)="[^"]*"/g, '')
	tag = tag.replace(/^<svg/, `<svg x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"`)
	return svg.replace(open, tag)
}

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
const mix = ([r, g, b], f) => [r, g, b].map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)))

/**
 * @param {number[][]} colors
 * @param {string|null} motifSvg
 * @param {{ lines?: number, active?: boolean }} opts  lines = Zeilen der Beschriftung
 */
function tileSvg(colors, motifSvg, opts = {}) {
	const stops = colors.length === 1 ? [mix(colors[0], 0.35), colors[0], mix(colors[0], -0.35)] : colors
	const stopTags = stops.map((c, i) => `<stop offset="${stops.length === 1 ? 0 : i / (stops.length - 1)}" stop-color="${hex(c)}"/>`).join('')
	const band = (opts.lines || 1) > 1 ? 34 : 22
	const avail = SIZE - band - 6
	const size = Math.min(40, avail)
	const motif = motifSvg ? nest(motifSvg, (SIZE - size) / 2, 4 + (avail - size) / 2, size) : ''
	const frame = opts.active ? `<rect x="1.75" y="1.75" width="${SIZE - 3.5}" height="${SIZE - 3.5}" rx="10.5" fill="none" stroke="${ACTIVE_COLOR}" stroke-width="3.5"/>` : ''
	return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">${stopTags}</linearGradient>
<clipPath id="r"><rect width="${SIZE}" height="${SIZE}" rx="12"/></clipPath>
</defs>
<g clip-path="url(#r)">
<rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
${motif}
<rect x="0" y="${SIZE - band}" width="${SIZE}" height="${band}" fill="#000" fill-opacity="0.45"/>
${frame}
</g>
</svg>`
}

function render(svg, file) {
	const png = new Resvg(svg, { fitTo: { mode: 'width', value: SIZE }, font: { loadSystemFonts: false } }).render().asPng()
	fs.writeFileSync(file, png)
}

function main() {
	const appDir = findAppDir()
	const motifs = resolveMotifs(extractSvgs(path.join(appDir, 'IQ_Maui.dll')))
	fs.mkdirSync(OUT, { recursive: true })
	let n = 0
	for (const e of CATALOG) {
		const m = motifFor(e)
		const lines = labelText(e.name, TILE_MAX_FONT).lineCount
		for (const active of [false, true]) {
			render(tileSvg(e.colors, m ? motifs[m] : null, { lines, active }), path.join(OUT, `tile_${e.id}${active ? '_active' : ''}.png`))
			n++
		}
	}
	for (const c of COLORS) {
		const lines = labelText(c.name, TILE_MAX_FONT).lineCount
		for (const active of [false, true]) {
			render(tileSvg([c.rgb], null, { lines, active }), path.join(OUT, `tile_color_${c.key}${active ? '_active' : ''}.png`))
			n++
		}
	}
	console.log(`${n} Kacheln erzeugt in ${OUT}`)

	// Alle PNGs aus ./icons als Base64 in den Quellcode bündeln
	const bundle = {}
	for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).sort()) {
		bundle[f.replace(/\.png$/, '')] = fs.readFileSync(path.join(OUT, f)).toString('base64')
	}
	const target = path.join(__dirname, '..', 'src', 'icons.generated.json')
	fs.writeFileSync(target, JSON.stringify(bundle))
	console.log(`${Object.keys(bundle).length} Grafiken gebündelt in ${target}`)
}

main()
