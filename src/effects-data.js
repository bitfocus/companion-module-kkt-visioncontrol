// Zentraler Effekt-Katalog. Aus ihm entstehen die Steuerbefehle (src/fx.js),
// die Companion-Presets (src/presets.js) und die Kachelbilder
// (scripts/build-icons.cjs). Farben sind 8-bit (0..255).
//
// sec:      Sekunden pro Farbschritt, soft: Anteil Überblendung (0..1).
//           src/fx.js rechnet das in StayTime/FadeTime/TimeMultiplier um.
// range:    Verteilung über die Pixel; Muster-Effekte nutzen standardmäßig 10.
//
// effect:   EffectType   0 Farbfolge, 1 Kreis, 2/3 Teilung, 4-7 Wand, 8-11 Pfeil,
//                        12 Quadrat, 13 Ringe, 14 Rauschen, 15/16 Schlange,
//                        17/18 Regen, 19 Schach, 20 Pixel
// geometry: 0 Gerät, 1 Einzeln (Geräte-Pixel), 2 Pixel / Matrix
// trigger:  start/jump 0 NONE, 1 TAP, 2 BEAT, 3 PULSE

// Motiv-Namen der Effekt-Kacheln. Gezeichnet werden sie im Icon Pack
// (scripts/iconpack/glyphs.cjs, Tabelle MOTIF). Die Werte sind die
// Fingerabdrücke der ursprünglichen App-Motive und werden nicht mehr benötigt.
const MOTIFS = {
	arrow135: ['0a25ecbd7d73', 5],
	arrow45: ['2d3161c929bf', 6],
	arrowRight: ['f64b09b2af33', 7],
	arrowUp: ['b965bfddc030', 8],
	chess: ['b3ea9cfdaa55', 9],
	rings: ['703b2f3b55c9', 10],
	police: ['b79ef8c08d97', 12],
	barsH: ['b3170672efcf', 13],
	barsV: ['1480eef9a902', 14],
	snakeUp: ['5257cd6ef8c7', 15],
	snakeRight: ['fd6fbf76cf9d', 16],
	splitV: ['b15ddaa16f04', 17],
	splitH: ['b0ee2e1a1c69', 18],
	square: ['8278b3b17b41', 19],
	stars: ['36d80912d678', 20],
	bricksDiag1: ['71434dd1dead', 21],
	bricksDiag2: ['e1ca31f9d2b1', 22],
	bricksCol: ['269618c2436c', 23],
	bricksCols: ['06b54ac579f4', 24],
	bricksRows: ['304fbae49a54', 25],
	bricksRow: ['774656460165', 26],
	wheel: ['b7108fc45890', 27],
}

// Standard-Motiv je Effekttyp (wie in der App)
const EFFECT_MOTIF = {
	0: null,
	1: 'wheel',
	2: 'splitV',
	3: 'splitH',
	4: 'bricksCol',
	5: 'bricksRow',
	6: 'bricksRows',
	7: 'bricksCols',
	8: 'arrowRight',
	9: 'arrowUp',
	10: 'arrow45',
	11: 'arrow135',
	12: 'square',
	13: 'rings',
	14: 'stars',
	15: 'snakeUp',
	16: 'snakeRight',
	17: 'barsV',
	18: 'barsH',
	19: 'chess',
	20: 'bricksDiag2',
}

const BEAT = { start: 2, adaptBpm: true }
const BASS_PULSE = { start: 3, min: 0, max: 255, threshold: 2500, eqStart: 0, eqLength: 6 }

const R = [255, 0, 0], G = [0, 255, 0], B = [0, 0, 255], W = [255, 255, 255], K = [0, 0, 0]
const M = [255, 0, 255], C = [0, 255, 255], Y = [255, 255, 0], O = [255, 120, 0]

const CATALOG = [
	// ---- Farbfolgen ----------------------------------------------------------
	{ id: 'rgb_slow', cat: 'Effekte', name: 'RGB langsam', effect: 0, colors: [R, G, B], sec: 4, soft: 0.8 },
	{ id: 'rgb', cat: 'Effekte', name: 'RGB mittel', effect: 0, colors: [R, G, B], sec: 1.5, soft: 0.6 },
	{ id: 'rgb_fast', cat: 'Effekte', name: 'RGB schnell', effect: 0, colors: [R, G, B], sec: 0.4, soft: 0.3 },
	{ id: 'party', cat: 'Effekte', name: 'Party', effect: 0, colors: [R, M, C], sec: 0.3, soft: 0.2 },
	{ id: 'abendrot', cat: 'Effekte', name: 'Abendrot', effect: 0, colors: [O, [255, 0, 60], [180, 0, 120]], sec: 6, soft: 0.9 },
	{ id: 'ozean', cat: 'Effekte', name: 'Ozean', effect: 0, colors: [[0, 80, 255], [0, 200, 200], [0, 120, 180]], sec: 5, soft: 0.9 },
	{ id: 'polizei', cat: 'Effekte', name: 'Polizei', effect: 0, motif: 'police', colors: [B, K, R, K], sec: 0.15, soft: 0 },

	// ---- Matrix-Pixel (über alle Pixel aller Geräte) ---------------------------
	{ id: 'mx_pixel', cat: 'Matrix-Pixel', name: 'Pixel', effect: 20, geometry: 2, colors: [R, B], sec: 0.6, soft: 0.5 },
	{ id: 'mx_snake', cat: 'Matrix-Pixel', name: 'Schlange', effect: 16, geometry: 2, colors: [G, K], sec: 0.8, soft: 0.7 },
	{ id: 'mx_rain', cat: 'Matrix-Pixel', name: 'Regen', effect: 17, geometry: 2, colors: [[0, 120, 255], K], sec: 0.8, soft: 0.7 },
	{ id: 'mx_noise', cat: 'Matrix-Pixel', name: 'Rauschen', effect: 14, geometry: 2, colors: [W, [0, 0, 60]], sec: 0.5, soft: 0.5 },
	{ id: 'mx_chess', cat: 'Matrix-Pixel', name: 'Schach', effect: 19, geometry: 2, colors: [W, K], sec: 1, soft: 0.3 },
	{ id: 'mx_wall', cat: 'Matrix-Pixel', name: 'Wand', effect: 4, geometry: 2, colors: [R, Y, G, C, B, M], sec: 1.2, soft: 0.85 },
	{ id: 'mx_circle', cat: 'Matrix-Pixel', name: 'Ringe', effect: 13, geometry: 2, colors: [M, C], sec: 1.2, soft: 0.85 },

	// ---- Geräte-Pixel (jedes Gerät über seine eigenen Pixel) -------------------
	{ id: 'dv_pixel', cat: 'Geräte-Pixel', name: 'Pixel', effect: 20, geometry: 1, colors: [R, B], sec: 0.6, soft: 0.5 },
	{ id: 'dv_snake', cat: 'Geräte-Pixel', name: 'Schlange', effect: 16, geometry: 1, colors: [G, K], sec: 0.8, soft: 0.7 },
	{ id: 'dv_rain', cat: 'Geräte-Pixel', name: 'Regen', effect: 17, geometry: 1, colors: [[0, 120, 255], K], sec: 0.8, soft: 0.7 },
	{ id: 'dv_noise', cat: 'Geräte-Pixel', name: 'Rauschen', effect: 14, geometry: 1, colors: [W, [0, 0, 60]], sec: 0.5, soft: 0.5 },
	{ id: 'dv_wall', cat: 'Geräte-Pixel', name: 'Wand', effect: 4, geometry: 1, colors: [R, Y, G, C, B, M], sec: 1.2, soft: 0.85 },

	// ---- Geräte-Muster (ganze Fixtures als Zellen) ----------------------------
	{ id: 'fx_circle', cat: 'Geräte-Muster', name: 'Rad', effect: 1, geometry: 0, colors: [R, B], sec: 1, soft: 0.6 },
	{ id: 'fx_wall', cat: 'Geräte-Muster', name: 'Wand', effect: 4, geometry: 0, colors: [O, [255, 0, 60]], sec: 1, soft: 0.6 },
	{ id: 'fx_arrow', cat: 'Geräte-Muster', name: 'Pfeil', effect: 8, geometry: 0, colors: [C, K], sec: 0.6, soft: 0.4 },
	{ id: 'fx_chess', cat: 'Geräte-Muster', name: 'Schach', effect: 19, geometry: 0, colors: [W, K], sec: 1, soft: 0.3 },

	// ---- Fitnessstudio: Bereiche (Grundstimmung) -------------------------------
	{ id: 'fit_empfang', cat: 'Fitness: Bereiche', name: 'Empfang', effect: 0, colors: [[0, 170, 160], [0, 90, 120], [170, 220, 255]], sec: 8, soft: 0.95, dimmer: 80 },
	{ id: 'fit_cardio', cat: 'Fitness: Bereiche', name: 'Cardio', effect: 18, geometry: 2, colors: [[255, 110, 0], [255, 30, 30], [255, 170, 0]], sec: 0.8, soft: 0.7, dimmer: 90 },
	{ id: 'fit_kraft', cat: 'Fitness: Bereiche', name: 'Kraft', effect: 5, geometry: 2, colors: [[200, 0, 0], [80, 0, 0], [30, 40, 90]], sec: 2, soft: 0.8, dimmer: 85 },
	{ id: 'fit_functional', cat: 'Fitness: Bereiche', name: 'Athletik', effect: 8, geometry: 2, colors: [[255, 200, 0], [255, 100, 0], K], sec: 0.6, soft: 0.5, dimmer: 90 },
	{ id: 'fit_stretching', cat: 'Fitness: Bereiche', name: 'Stretch', effect: 0, colors: [[150, 110, 255], [0, 190, 180], [255, 140, 200]], sec: 7, soft: 0.95, dimmer: 60 },
	{ id: 'fit_wellness', cat: 'Fitness: Bereiche', name: 'Wellness', effect: 0, colors: [[255, 180, 110], [255, 140, 40], [255, 200, 160]], sec: 9, soft: 0.95, dimmer: 55 },

	// ---- Fitnessstudio: Kurse (Energie-Verlauf einer Stunde) -------------------
	{ id: 'fit_warmup', cat: 'Fitness: Kurse', name: 'Warm-up', effect: 16, geometry: 2, colors: [[255, 150, 0], [255, 90, 0], [255, 50, 40]], sec: 1.5, soft: 0.8, dimmer: 85 },
	{ id: 'fit_spinning', cat: 'Fitness: Kurse', name: 'Spinning', effect: 13, geometry: 2, colors: [[255, 0, 200], [0, 220, 255], [40, 60, 255]], sec: 0.5, soft: 0.3, dimmer: 100, trigger: BEAT },
	{ id: 'fit_hiit', cat: 'Fitness: Kurse', name: 'HIIT', effect: 2, geometry: 2, colors: [R, W], sec: 0.25, soft: 0, dimmer: 100 },
	{ id: 'fit_power', cat: 'Fitness: Kurse', name: 'Power Beat', effect: 20, geometry: 2, colors: [[255, 20, 0], O, W], sec: 0.3, soft: 0.2, dimmer: 100, trigger: BASS_PULSE },
	{ id: 'fit_dance', cat: 'Fitness: Kurse', name: 'Dance', effect: 14, geometry: 2, colors: [R, M, C, Y], sec: 0.4, soft: 0.3, dimmer: 100, trigger: BEAT },
	{ id: 'fit_pause', cat: 'Fitness: Kurse', name: 'Pause', effect: 0, colors: [[60, 120, 255], [150, 200, 255]], sec: 6, soft: 0.95, dimmer: 50 },
	{ id: 'fit_cooldown', cat: 'Fitness: Kurse', name: 'Cool-down', effect: 17, geometry: 2, colors: [[0, 90, 255], [0, 200, 255], [0, 150, 140]], sec: 2.5, soft: 0.9, dimmer: 70 },
	{ id: 'fit_yoga', cat: 'Fitness: Kurse', name: 'Yoga', effect: 0, colors: [[60, 40, 160], [150, 110, 255], [0, 140, 150]], sec: 12, soft: 0.97, dimmer: 45 },
	{ id: 'fit_finish', cat: 'Fitness: Kurse', name: 'Finish', effect: 9, geometry: 2, colors: [[0, 255, 80], W, [0, 255, 80]], sec: 0.4, soft: 0.3, dimmer: 100 },
]

// Einfarbige Kacheln für die Farb-Presets
const COLORS = [
	{ key: 'red', name: 'Rot', rgb: [255, 0, 0] },
	{ key: 'green', name: 'Grün', rgb: [0, 255, 0] },
	{ key: 'blue', name: 'Blau', rgb: [0, 0, 255] },
	{ key: 'white', name: 'Weiß', rgb: [255, 255, 255] },
	{ key: 'warm', name: 'Warmweiß', rgb: [255, 170, 80] },
	{ key: 'amber', name: 'Amber', rgb: [255, 120, 0] },
	{ key: 'cyan', name: 'Cyan', rgb: [0, 255, 255] },
	{ key: 'magenta', name: 'Magenta', rgb: [255, 0, 255] },
	{ key: 'yellow', name: 'Gelb', rgb: [255, 255, 0] },
	{ key: 'pink', name: 'Pink', rgb: [255, 80, 160] },
]

const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((e) => [e.id, e]))

function motifFor(entry) {
	if (entry.motif !== undefined) return entry.motif
	return EFFECT_MOTIF[entry.effect] ?? null
}

module.exports = { CATALOG, CATALOG_BY_ID, COLORS, MOTIFS, EFFECT_MOTIF, motifFor }
