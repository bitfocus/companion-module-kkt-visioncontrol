/*
 * Vision Control Icon Pack: alle Glyphen in einer visuellen Sprache.
 *
 * Regeln (gelten für jede Glyphe):
 *   - Raster 24 × 24, Motiv im Feld 2..22 (2 Einheiten Rand)
 *   - Linie 2 Einheiten, runde Enden und Ecken (stroke-linecap/-linejoin round)
 *   - Flächen nur einfarbig in derselben Tinte wie die Linie, keine Verläufe
 *   - eine Tinte pro Glyphe (weiß auf dunkel, fast schwarz auf hell)
 *   - Ecken an Rechtecken rx 1–2, Kreise und Bögen statt Freihand
 *
 * Jede Glyphe ist eine Funktion (ink) => SVG-Fragment im 24er-Raster.
 */

const S = 2 // Linienstärke im 24er-Raster

const line = (d, ink, extra = '') => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`
const fill = (d, ink) => `<path d="${d}" fill="${ink}"/>`
const circle = (cx, cy, r, ink) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ink}" stroke-width="${S}"/>`
const dot = (cx, cy, r, ink) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ink}"/>`
const rect = (x, y, w, h, rx, ink) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${ink}" stroke-width="${S}" stroke-linejoin="round"/>`
const box = (x, y, w, h, rx, ink) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${ink}"/>`
const rot = (deg, inner) => `<g transform="rotate(${deg} 12 12)">${inner}</g>`

// Vierzackiger Funke (gefüllt), Mittelpunkt x/y, Halbmesser s
const sparkle = (x, y, s, ink) =>
	fill(`M${x} ${y - s}Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y}Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s}Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y}Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z`, ink)

// Tachobogen mit Zeiger (für schneller / langsamer)
const gauge = (tx, ty, ink) =>
	line('M4 17a8 8 0 1 1 16 0', ink) + line('M12 9V7.5M7.2 11.2 6.2 10.2M16.8 11.2l1-1', ink) + line(`M12 17L${tx} ${ty}`, ink) + dot(12, 17, 1.8, ink)

const snake = (ink) => line('M2.5 12c1.6-4.4 3.8-4.4 5.4 0s3.8 4.4 5.4 0 3.8-4.4 5.4 0c.6 1.6 1.3 2.6 2.3 3', ink)
const rain = (ink) => line('M8 3.5 6 8M14 3.5 12 8M20 3.5 18 8M11 10.5 9 15M17 10.5 15 15M8 17.5l-1.2 3M14 17.5l-1.2 3', ink)
const chess = (ink) => rect(3.5, 3.5, 17, 17, 2, ink) + box(3.5, 3.5, 5.67, 5.67, 1, ink) + box(14.83, 3.5, 5.67, 5.67, 1, ink) + box(9.17, 9.17, 5.67, 5.67, 1, ink) + box(3.5, 14.83, 5.67, 5.67, 1, ink) + box(14.83, 14.83, 5.67, 5.67, 1, ink)
const stars = (ink) => sparkle(10, 11.5, 7, ink) + sparkle(18, 5.5, 3, ink) + sparkle(18.5, 18, 2.6, ink)
const rings = (ink) => circle(12, 12, 9, ink) + circle(12, 12, 5.2, ink) + dot(12, 12, 2, ink)
const chevrons = (ink) => line('M5 6l6 6-6 6M12.5 6l6 6-6 6', ink)

// ---- Steuer-Symbole (Tasten mit Symbol oben, Text unten) --------------------
const CONTROL = {
	blackout: (k) => line('M19.5 14.2A8 8 0 1 1 9.8 4.5a6.4 6.4 0 0 0 9.7 9.7Z', k),
	full_on: (k) => circle(12, 12, 4, k) + line('M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8', k),
	sound: (k) => line('M3.5 9.5h3l5-4v13l-5-4h-3Z', k) + line('M15 9.2a4 4 0 0 1 0 5.6M17.8 6.5a8 8 0 0 1 0 11', k),
	dimmer: (k) => line('M6 3.5v17M12 3.5v17M18 3.5v17', k) + box(3.5, 13, 5, 3, 1.2, k) + box(9.5, 6, 5, 3, 1.2, k) + box(15.5, 10, 5, 3, 1.2, k),
	color: (k) => line('M12 3.2c3.6 4.3 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.4-6.3 6-10.6Z', k),
	chase: (k) => circle(12, 8, 4.5, k) + circle(8, 15, 4.5, k) + circle(16, 15, 4.5, k),
	pixel: (k) =>
		[
			[4, 4, 1], [10, 4, 0], [16, 4, 1],
			[4, 10, 0], [10, 10, 1], [16, 10, 1],
			[4, 16, 1], [10, 16, 1], [16, 16, 0],
		]
			.map(([x, y, f]) => (f ? box(x, y, 4, 4, 1, k) : rect(x + 0.5, y + 0.5, 3, 3, 0.8, k)))
			.join(''),
	circle: rings,
	wall: (k) => rect(3, 5, 18, 14, 1.5, k) + line('M3 9.7h18M3 14.3h18M12 5v4.7M7.5 9.7v4.6M16.5 9.7v4.6M12 14.3V19', k),
	snake,
	rain,
	noise: stars,
	chess,
	arrow: (k) => line('M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5', k),
	scene: (k) => line('M12 3.5l8.5 4.5-8.5 4.5L3.5 8Z', k) + line('M3.5 12.2 12 16.7l8.5-4.5M3.5 16.2 12 20.7l8.5-4.5', k),
	play: (k) => line('M8 5.2v13.6L19 12Z', k),
	pause: (k) => box(6, 5, 4, 14, 1.2, k) + box(14, 5, 4, 14, 1.2, k),
	status: (k) => line('M3.2 9.2a12.5 12.5 0 0 1 17.6 0M6.3 12.4a8 8 0 0 1 11.4 0M9.4 15.5a3.6 3.6 0 0 1 5.2 0', k) + dot(12, 19, 1.6, k),
	rabbit: (k) => gauge(17.4, 11.2, k),
	turtle: (k) => gauge(6.6, 11.2, k),
	range: (k) => line('M3.5 5v14M20.5 5v14M7.5 12h9M10.5 9l-3 3 3 3M13.5 9l3 3-3 3', k),
	info: (k) => circle(12, 12, 9, k) + line('M12 11v6', k) + dot(12, 7.6, 1.4, k),
	sequence: (k) => rect(2.5, 7, 7, 10, 1.5, k) + rect(14.5, 7, 7, 10, 1.5, k) + line('M10.8 12h2.4M12 10.3l1.7 1.7-1.7 1.7', k),
}

// ---- Effekt-Motive (Kacheln und Motiv-Ebenen) ----------------------------------
// Namen wie in src/effects-data.js (MOTIFS / EFFECT_MOTIF). 'cycle' steht für
// Farbfolgen ohne Muster (EffectType 0), 'drop' für einfarbige Farb-Kacheln.
const MOTIF = {
	cycle: (k) => line('M19.4 9A8 8 0 0 0 5.2 7.6M4.6 15a8 8 0 0 0 14.2 1.4', k) + line('M5 3.8v4h4M19 20.2v-4h-4', k),
	drop: CONTROL.color,
	wheel: (k) => circle(12, 12, 9, k) + circle(12, 12, 2.6, k) + line('M12 9.4V3M12 14.6V21M9.75 10.7 4.2 7.5M14.25 13.3l5.55 3.2M9.75 13.3 4.2 16.5M14.25 10.7l5.55-3.2', k),
	splitV: (k) => rect(3.5, 3.5, 17, 17, 2, k) + fill('M5.5 3.5H12v17H5.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z', k),
	splitH: (k) => rect(3.5, 3.5, 17, 17, 2, k) + fill('M3.5 5.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2V12h-17Z', k),
	bricksCol: (k) => rect(8, 2.5, 8, 19, 1.5, k) + line('M8 7.25h8M8 12h8M8 16.75h8M12 7.25V12M12 16.75v4.75', k),
	bricksRow: (k) => rect(2.5, 8, 19, 8, 1.5, k) + line('M7.25 8v8M12 8v8M16.75 8v8M2.5 12h4.75M12 12h4.75', k),
	bricksRows: (k) => rect(2.5, 5, 19, 14, 1.5, k) + line('M2.5 12h19M8.8 5v7M15.2 5v7M5.6 12v7M12 12v7M18.4 12v7', k),
	bricksCols: (k) => rect(5, 2.5, 14, 19, 1.5, k) + line('M12 2.5v19M5 8.8h7M5 15.2h7M12 5.6h7M12 12h7M12 18.4h7', k),
	arrowRight: chevrons,
	arrowUp: (k) => rot(-90, chevrons(k)),
	arrow45: (k) => line('M9 5h10v10M5 9h10v10', k),
	arrow135: (k) => `<g transform="translate(24 0) scale(-1 1)">${line('M9 5h10v10M5 9h10v10', k)}</g>`,
	square: (k) => rect(3, 3, 18, 18, 2, k) + rect(7.5, 7.5, 9, 9, 1.5, k) + box(10.5, 10.5, 3, 3, 0.8, k),
	rings,
	stars,
	snakeRight: snake,
	snakeUp: (k) => rot(-90, snake(k)),
	barsV: rain,
	barsH: (k) => rot(90, rain(k)),
	chess,
	bricksDiag1: (k) => rect(14, 15, 7, 5, 1.2, k) + rect(8.5, 9.5, 7, 5, 1.2, k) + rect(3, 4, 7, 5, 1.2, k),
	bricksDiag2: (k) => rect(3, 15, 7, 5, 1.2, k) + rect(8.5, 9.5, 7, 5, 1.2, k) + rect(14, 4, 7, 5, 1.2, k),
	police: (k) => line('M7 16.5v-4.5a5 5 0 0 1 10 0v4.5', k) + box(4.5, 16.5, 15, 4, 1.2, k) + line('M12 2.5v2M4.6 5.6l1.4 1.4M19.4 5.6 18 7M2.5 11.5h2M19.5 11.5h2', k),
}

module.exports = { CONTROL, MOTIF, STROKE: S }
