const { combineRgb } = require('@companion-module/base')
const { icon, tile } = require('./icons')
const { CATALOG, COLORS } = require('./effects-data')

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)

// Schriftgröße wie bei normalen Companion-Buttons: automatisch.
const SIZE = 'auto'

function textOn(r, g, b) {
	const luminance = 0.299 * r + 0.587 * g + 0.114 * b
	return luminance > 150 ? BLACK : WHITE
}

// Stil mit App-Symbol (Glyphe oben, Text unten) für Steuer-Tasten.
function look(text, bgRgb, iconKey) {
	const [r, g, b] = bgRgb
	const color = textOn(r, g, b)
	const style = { text, size: SIZE, color, bgcolor: combineRgb(r, g, b) }
	const png = iconKey ? icon(iconKey, color === BLACK ? 'dark' : 'light') : undefined
	if (png) {
		style.png64 = png
		style.pngalignment = 'center:top'
		style.alignment = 'center:bottom'
	}
	return style
}

// Stil mit Kachel im App-Stil (Farbverlauf + Motiv), Text weiß auf dunklem Streifen.
// Fällt ohne Kachel auf einen einfarbigen Button zurück.
function tileLook(text, tileId, fallbackRgb) {
	const png = tile(tileId)
	if (!png) return look(text, fallbackRgb, null)
	return { text, size: SIZE, color: WHITE, bgcolor: BLACK, png64: png, pngalignment: 'center:center', alignment: 'center:bottom' }
}

module.exports = function (self) {
	const presets = {}
	const GROUP = '0'

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
			feedbacks: [],
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
					down: [{ actionId: 'vision_effect', options: { target: 'group', id: GROUP, effect: e.id, overrideDimmer: false, dimmer: 100 } }],
					up: [],
				},
			],
			feedbacks: [],
		}
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
