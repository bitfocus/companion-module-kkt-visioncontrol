/*
 * Vision Control Icon Pack: all glyphs in one visual language.
 *
 * Rules (apply to every glyph):
 *   - Grid 24 × 24, motif in the field 2..22 (2 units margin)
 *   - Line 2 units, round ends and corners (stroke-linecap/-linejoin round)
 *   - Fills only single-color in the same ink as the line, no gradients
 *   - one ink per glyph (white on dark, near black on light)
 *   - Corners on rectangles rx 1–2, circles and arcs instead of freehand
 *
 * Each glyph is a function (ink) => SVG fragment in the 24 grid.
 */

const S = 2 // Stroke width in the 24 grid

const line = (d, ink, extra = '') => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${S}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`
const fill = (d, ink) => `<path d="${d}" fill="${ink}"/>`
const circle = (cx, cy, r, ink) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ink}" stroke-width="${S}"/>`
const dot = (cx, cy, r, ink) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ink}"/>`
const rect = (x, y, w, h, rx, ink) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${ink}" stroke-width="${S}" stroke-linejoin="round"/>`
const box = (x, y, w, h, rx, ink) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${ink}"/>`
const rot = (deg, inner) => `<g transform="rotate(${deg} 12 12)">${inner}</g>`

// Four-pointed sparkle (filled), center x/y, radius s
const sparkle = (x, y, s, ink) =>
	fill(`M${x} ${y - s}Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y}Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s}Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y}Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z`, ink)

// Speedometer arc with needle (for faster / slower)
const gauge = (tx, ty, ink) =>
	line('M4 17a8 8 0 1 1 16 0', ink) + line('M12 9V7.5M7.2 11.2 6.2 10.2M16.8 11.2l1-1', ink) + line(`M12 17L${tx} ${ty}`, ink) + dot(12, 17, 1.8, ink)

const snake = (ink) => line('M2.5 12c1.6-4.4 3.8-4.4 5.4 0s3.8 4.4 5.4 0 3.8-4.4 5.4 0c.6 1.6 1.3 2.6 2.3 3', ink)
const rain = (ink) => line('M8 3.5 6 8M14 3.5 12 8M20 3.5 18 8M11 10.5 9 15M17 10.5 15 15M8 17.5l-1.2 3M14 17.5l-1.2 3', ink)
const chess = (ink) => rect(3.5, 3.5, 17, 17, 2, ink) + box(3.5, 3.5, 5.67, 5.67, 1, ink) + box(14.83, 3.5, 5.67, 5.67, 1, ink) + box(9.17, 9.17, 5.67, 5.67, 1, ink) + box(3.5, 14.83, 5.67, 5.67, 1, ink) + box(14.83, 14.83, 5.67, 5.67, 1, ink)
const stars = (ink) => sparkle(10, 11.5, 7, ink) + sparkle(18, 5.5, 3, ink) + sparkle(18.5, 18, 2.6, ink)
const rings = (ink) => circle(12, 12, 9, ink) + circle(12, 12, 5.2, ink) + dot(12, 12, 2, ink)
const chevrons = (ink) => line('M5 6l6 6-6 6M12.5 6l6 6-6 6', ink)

// ---- Control icons (buttons with icon on top, text below) -------------------
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

// ---- Effect motifs (tiles and motif layers) ------------------------------------
// Names as in src/effects-data.js (MOTIFS / EFFECT_MOTIF). 'cycle' stands for
// color cycles without a pattern (EffectType 0), 'drop' for single-color tiles.
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

	// ---- Hyrox (race and the eight stations) -----------------------------------
	// Start: stopwatch
	hxStart: (k) => circle(12, 13.5, 7.5, k) + line('M10 3h4M12 3v3M18 7.5l1.5-1.5M12 13.5V9.5M12 13.5l2.8 2', k),
	// Run: runner in stride
	hxRun: (k) => dot(15.5, 4.2, 2.2, k) + line('M14 8.5 11 14M11 14l3.5 2.5-1 4.5M11 14l-3 2.5H4.5M13.8 8.8l3.4 3 2.8-.8M13.8 8.8 9.5 8.5 7.5 11', k),
	// Roxzone: transition zone, the arrow passes through the gate
	hxRoxzone: (k) => line('M6 4.5H4.5v15H6M18 4.5h1.5v15H18', k) + line('M3 12h16M15 8l4 4-4 4', k),
	// Finish: checkered flag
	hxFinish: (k) =>
		line('M5 21V3.5', k) +
		rect(5, 4, 14, 10, 1, k) +
		box(5, 4, 3.5, 3.33, 0.5, k) + box(12, 4, 3.5, 3.33, 0.5, k) +
		box(8.5, 7.33, 3.5, 3.33, 0.5, k) + box(15.5, 7.33, 3.5, 3.33, 0.5, k) +
		box(5, 10.67, 3.5, 3.33, 0.5, k) + box(12, 10.67, 3.5, 3.33, 0.5, k),
	// SkiErg: two handles pulled down from the top
	hxSkiErg: (k) => line('M4 3.5h16M8 3.5v7M16 3.5v7', k) + box(6.5, 10.5, 3, 5, 1.2, k) + box(14.5, 10.5, 3, 5, 1.2, k) + line('M9.5 18.5 12 21l2.5-2.5', k),
	// Sled Push: sled with two upright poles, pushed forward
	hxSledPush: (k) => line('M7 13V6.5M11.5 13V6.5', k) + rect(4.5, 13, 11, 4.5, 1, k) + line('M3 20.5h14a2.5 2.5 0 0 0 2.5-2.5', k) + line('M15 6.5h6M18.5 4 21 6.5 18.5 9', k),
	// Sled Pull: sled pulled back on a rope
	hxSledPull: (k) => rect(11, 13, 9, 4.5, 1, k) + line('M11 15.25H5.5M4 12.5v5.5', k) + line('M9 20.5h11a2 2 0 0 0 1.5-2', k) + line('M10 7H3.5M6 4.5 3.5 7 6 9.5', k),
	// Burpee Broad Jump: jump arc over the ground, take-off and landing
	hxBurpee: (k) => line('M4.5 17C6 7 14 5 19.5 13', k) + line('M19.8 9.2 19.5 13l-3.6-1', k) + line('M2.5 20.5h19', k) + dot(4.5, 17.5, 1.6, k) + dot(19.5, 17.5, 1.6, k),
	// Rowing: oar over the water
	hxRow: (k) => line('M4.5 4.5 15 15', k) + box(13.2, 13.2, 5.5, 3.2, 1.2, k).replace('/>', ' transform="rotate(45 15.95 14.8)"/>') + line('M3 19.5c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0', k),
	// Farmers Carry: one kettlebell in each hand
	hxFarmers: (k) => circle(6.5, 15.5, 4, k) + line('M4.3 12.2V9.5a2.2 2.2 0 0 1 4.4 0v2.7', k) + circle(17.5, 15.5, 4, k) + line('M15.3 12.2V9.5a2.2 2.2 0 0 1 4.4 0v2.7', k),
	// Sandbag Lunges: sandbag with carry handle and straps
	hxSandbag: (k) => rect(2.5, 9, 19, 10, 5, k) + line('M8.5 9V7.5a3.5 3.5 0 0 1 7 0V9M8.5 9v10M15.5 9v10', k),
	// Wall Balls: ball thrown to the target
	hxWallBall: (k) => circle(17, 7, 4, k) + dot(17, 7, 1.4, k) + circle(6.5, 17, 4, k) + line('M2.9 15.6c2.3 1 4.9 1 7.2 0M6.5 13c-1.2 2.6-1.2 5.4 0 8', k) + line('M9.5 12.5c1.5-2.5 3-4 5-4.5', k, ' stroke-dasharray="1.5 2.5"'),
}

module.exports = { CONTROL, MOTIF, STROKE: S }
