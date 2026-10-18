const { combineRgb } = require('@companion-module/base')
const { icon, tile } = require('./icons')
const { CATALOG, COLORS } = require('./effects-data')
const { labelText } = require('./labels')

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const ORANGE = combineRgb(255, 122, 0)

// Größte Schriftstufe: Kacheln haben unten nur einen schmalen Streifen
const TILE_MAX_FONT = 18
const GLYPH_MAX_FONT = 24

function textOn(r, g, b) {
	const luminance = 0.299 * r + 0.587 * g + 0.114 * b
	return luminance > 150 ? BLACK : WHITE
}

// Steuer-Taste mit App-Symbol oben, Text unten (eine der drei Schriftstufen)
function look(text, bgRgb, iconKey) {
	const [r, g, b] = bgRgb
	const color = textOn(r, g, b)
	const lbl = labelText(text, GLYPH_MAX_FONT)
	const style = { text: lbl.text, size: lbl.size, color, bgcolor: combineRgb(r, g, b) }
	const png = iconKey ? icon(iconKey, color === BLACK ? 'dark' : 'light') : undefined
	if (png) {
		style.png64 = png
		style.pngalignment = 'center:top'
		style.alignment = 'center:bottom'
	}
	return style
}

// Kachel im App-Stil; Text weiß auf dunklem Streifen
function tileLook(text, tileId, fallbackRgb) {
	const png = tile(tileId)
	if (!png) return look(text, fallbackRgb, null)
	const lbl = labelText(text, TILE_MAX_FONT)
	return { text: lbl.text, size: lbl.size, color: WHITE, bgcolor: BLACK, png64: png, pngalignment: 'center:center', alignment: 'center:bottom' }
}

// Feedback-Stil "aktiv": Kachel mit orangem Rahmen, sonst orange Fläche
function activeStyle(tileId) {
	const png = tile(`${tileId}_active`)
	return png ? { png64: png } : { bgcolor: ORANGE, color: WHITE }
}

module.exports = function (self) {
	const presets = {}
	const GROUP = '0'
	const label = self.label || 'visioncontrol'

	// ---- Steuerung ------------------------------------------------------------

	presets['blackout'] = {
		type: 'button',
		category: 'Steuerung',
		name: 'Blackout (Gruppe 0)',
		style: look('Blackout', [0, 0, 0], 'blackout'),
		steps: [{ down: [{ actionId: 'blackout', options: { target: 'group', id: GROUP, fade: 10 } }], up: [] }],
		feedbacks: [],
	}

	presets['full_on'] = {
		type: 'button',
		category: 'Steuerung',
		name: 'Full On (weiß 100 %)',
		style: look('Full On', [255, 255, 255], 'full_on'),
		steps: [
			{
				down: [
					{ actionId: 'set_color', options: { target: 'group', id: GROUP, useColor: true, color: WHITE, useDimmer: true, dimmer: 100, fade: 5 } },
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['sound_trigger'] = {
		type: 'button',
		category: 'Steuerung',
		name: 'Sound Trigger',
		style: look('Sound', [51, 51, 51], 'sound'),
		steps: [{ down: [{ actionId: 'sound_trigger', options: {} }], up: [] }],
		feedbacks: [],
	}

	// ---- Dimmerstufen ---------------------------------------------------------

	for (const pct of [0, 10, 25, 50, 75, 100]) {
		const shade = Math.round((pct / 100) * 255)
		presets[`dim_${pct}`] = {
			type: 'button',
			category: 'Dimmer',
			name: `Dimmer ${pct} %`,
			style: look(`${pct}%`, [shade, shade, shade], 'dimmer'),
			steps: [{ down: [{ actionId: 'set_dimmer', options: { target: 'group', id: GROUP, dimmer: pct, fade: 10 } }], up: [] }],
			feedbacks: [],
		}
	}

	// ---- Farben (Kacheln wie "Farbe Erscheinungsbild") -----------------------

	for (const c of COLORS) {
		const [r, g, b] = c.rgb
		presets[`color_${c.key}`] = {
			type: 'button',
			category: 'Farben',
			name: c.name,
			style: tileLook(c.name, `color_${c.key}`, c.rgb),
			steps: [
				{
					down: [
						{
							actionId: 'set_color',
							options: { target: 'group', id: GROUP, useColor: true, color: combineRgb(r, g, b), useDimmer: true, dimmer: 100, fade: 0 },
						},
					],
					up: [],
				},
			],
			feedbacks: [{ feedbackId: 'color_active', options: { color: c.key, target: 'group', id: GROUP }, style: activeStyle(`color_${c.key}`) }],
		}
	}

	// ---- Alle Katalog-Effekte (Effekte, Pixel/Matrix, Fitnessstudio) ----------

	for (const e of CATALOG) {
		presets[`fx_${e.id}`] = {
			type: 'button',
			category: e.cat,
			name: `${e.cat}: ${e.name}`,
			style: tileLook(e.name, e.id, e.colors[0]),
			steps: [
				{
					down: [
						{
							actionId: 'vision_effect',
							options: {
								target: 'group',
								id: GROUP,
								effect: e.id,
								overrideDimmer: false,
								dimmer: 100,
								overrideTiming: false,
								sec: 1.2,
								soft: 80,
								overrideRange: false,
								range: 10,
								overrideColors: false,
								c1: combineRgb(255, 0, 0),
								c2: combineRgb(0, 0, 255),
								useC3: false,
								c3: combineRgb(0, 255, 0),
								reverse: false,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [{ feedbackId: 'effect_active', options: { effect: e.id, target: 'group', id: GROUP }, style: activeStyle(e.id) }],
		}
	}

	// ---- Laufender Effekt (anpassen und anzeigen) -----------------------------

	const ADJUST = [
		{ key: 'faster', name: 'Schneller', icon: 'rabbit' },
		{ key: 'slower', name: 'Langsamer', icon: 'turtle' },
		{ key: 'brighter', name: 'Heller', icon: 'full_on' },
		{ key: 'darker', name: 'Dunkler', icon: 'blackout' },
		{ key: 'range_up', name: 'Range +', icon: 'range' },
		{ key: 'range_down', name: 'Range −', icon: 'range' },
	]
	for (const a of ADJUST) {
		presets[`adjust_${a.key}`] = {
			type: 'button',
			category: 'Laufender Effekt',
			name: a.name,
			style: look(a.name, [40, 40, 40], a.icon),
			steps: [{ down: [{ actionId: 'adjust_effect', options: { target: 'group', id: GROUP, what: a.key, percent: 20, rangeStep: 5 } }], up: [] }],
			feedbacks: [],
		}
	}

	presets['active_info'] = {
		type: 'button',
		category: 'Laufender Effekt',
		name: 'Anzeige: aktiver Effekt',
		style: {
			text: `$(${label}:active_effect)`,
			size: '14',
			color: WHITE,
			bgcolor: combineRgb(40, 40, 40),
			png64: icon('info', 'light'),
			pngalignment: 'center:top',
			alignment: 'center:bottom',
		},
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['active_tempo'] = {
		type: 'button',
		category: 'Laufender Effekt',
		name: 'Anzeige: Tempo und Helligkeit',
		style: {
			text: `$(${label}:active_seconds)\n$(${label}:active_dimmer)`,
			size: '14',
			color: WHITE,
			bgcolor: combineRgb(40, 40, 40),
		},
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	// ---- Szenen (Beispiele, Item-ID anpassen) ---------------------------------

	const ACTIVE = { bgcolor: combineRgb(0, 153, 51), color: WHITE }

	for (const id of ['1', '2', '3', '4']) {
		presets[`scene_toggle_${id}`] = {
			type: 'button',
			category: 'Szenen',
			name: `Szene ${id} umschalten`,
			style: look(`Szene ${id}`, [30, 30, 30], 'scene'),
			steps: [{ down: [{ actionId: 'scene_toggle', options: { itemId: id } }], up: [] }],
			feedbacks: [{ feedbackId: 'scene_active', options: { itemId: id }, style: ACTIVE }],
		}
	}

	presets['scene_on_example'] = {
		type: 'button',
		category: 'Szenen',
		name: 'Szene An (Beispiel ID 1)',
		style: look('Szene 1 An', [0, 102, 0], 'play'),
		steps: [{ down: [{ actionId: 'scene_on', options: { itemId: '1' } }], up: [] }],
		feedbacks: [{ feedbackId: 'scene_active', options: { itemId: '1' }, style: ACTIVE }],
	}

	presets['scene_off_example'] = {
		type: 'button',
		category: 'Szenen',
		name: 'Szene Aus (Beispiel ID 1)',
		style: look('Szene 1 Aus', [102, 0, 0], 'pause'),
		steps: [{ down: [{ actionId: 'scene_off', options: { itemId: '1' } }], up: [] }],
		feedbacks: [],
	}

	// ---- Status ---------------------------------------------------------------

	presets['status'] = {
		type: 'button',
		category: 'Status',
		name: 'Verbindungsstatus',
		style: look('Vision', [40, 40, 40], 'status'),
		steps: [{ down: [], up: [] }],
		feedbacks: [{ feedbackId: 'connected', options: {}, style: { bgcolor: combineRgb(0, 102, 204), color: WHITE } }],
	}

	self.setPresetDefinitions(presets)
}
