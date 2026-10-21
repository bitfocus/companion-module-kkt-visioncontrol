const { combineRgb } = require('@companion-module/base')
const { icon, tile } = require('./icons')
const { CATALOG, COLORS } = require('./effects-data')
const { labelText } = require('./labels')
const { sceneName, sceneFolder, isSequence } = require('./scenes')

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const ORANGE = combineRgb(255, 122, 0)

// Größte Schriftstufe: Kacheln haben unten nur einen schmalen Streifen
const TILE_MAX_FONT = 18
const GLYPH_MAX_FONT = 24
// Platz für den Text in px: unter dem Symbol (oben 28 px ab y 5) bzw. auf dem Kachelstreifen
const GLYPH_TEXT_HEIGHT = 36
const TILE_TEXT_HEIGHT = 34

function textOn(r, g, b) {
	const luminance = 0.299 * r + 0.587 * g + 0.114 * b
	return luminance > 150 ? BLACK : WHITE
}

// Steuer-Taste mit App-Symbol oben, Text unten (eine der drei Schriftstufen)
function look(text, bgRgb, iconKey) {
	const [r, g, b] = bgRgb
	const color = textOn(r, g, b)
	const lbl = labelText(text, GLYPH_MAX_FONT, GLYPH_TEXT_HEIGHT)
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
	const lbl = labelText(text, TILE_MAX_FONT, TILE_TEXT_HEIGHT)
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
		// Übernimmt automatisch die Kachel des laufenden Effekts
		feedbacks: [{ feedbackId: 'active_effect_image', options: { target: 'group', id: GROUP } }],
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
			png64: icon('rabbit', 'light'),
			pngalignment: 'center:top',
			alignment: 'center:bottom',
		},
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	// ---- Drehregler (Stream Deck +) -------------------------------------------
	// Drehen ändert die Helligkeit, Drücken schaltet Blackout an/aus.
	// Der Balken zeigt die Helligkeit auf dem Display über dem Regler.

	presets['encoder_dimmer'] = {
		type: 'button',
		category: 'Drehregler (Stream Deck +)',
		name: 'Helligkeit: drehen = heller/dunkler, drücken = Blackout an/aus',
		options: { rotaryActions: true },
		style: {
			text: `$(${label}:active_dimmer)`,
			size: '14',
			color: WHITE,
			bgcolor: BLACK, // schwarz wie der Rest des Touch-Displays
			png64: icon('dimmer', 'light'),
			pngalignment: 'center:top',
			alignment: 'center:bottom',
		},
		steps: [
			{
				down: [{ actionId: 'dimmer_toggle', options: { target: 'group', id: GROUP, fade: 0 } }],
				up: [],
				rotate_left: [{ actionId: 'dimmer_step', options: { target: 'group', id: GROUP, step: -5 } }],
				rotate_right: [{ actionId: 'dimmer_step', options: { target: 'group', id: GROUP, step: 5 } }],
			},
		],
		feedbacks: [{ feedbackId: 'dimmer_level', options: { target: 'group', id: GROUP } }],
	}

	presets['encoder_dimmer_fine'] = {
		...presets['encoder_dimmer'],
		name: 'Helligkeit fein (1 % je Raste)',
		steps: [
			{
				down: [{ actionId: 'dimmer_toggle', options: { target: 'group', id: GROUP, fade: 0 } }],
				up: [],
				rotate_left: [{ actionId: 'dimmer_step', options: { target: 'group', id: GROUP, step: -1 } }],
				rotate_right: [{ actionId: 'dimmer_step', options: { target: 'group', id: GROUP, step: 1 } }],
			},
		],
	}

	// Companion legt beim Stream Deck + die Drehregler in Reihe 4, das Touch-Display
	// zeigt Reihe 3. Diese Taste gehört über den Regler: Sie zeigt Wert und Balken,
	// Tippen = Blackout an/aus, senkrecht Wischen = heller/dunkler.
	presets['encoder_dimmer_display'] = {
		...presets['encoder_dimmer'],
		name: 'Helligkeit: Display über dem Regler (tippen = Blackout, wischen = heller/dunkler)',
	}

	// ---- Szenen: automatisch aus der App ----------------------------------------
	// Der Tastentext ist die Namens-Variable der Szene, damit Umbenennungen in
	// der App auch bereits platzierte Tasten erreichen.

	const ACTIVE = { bgcolor: combineRgb(0, 153, 51), color: WHITE }
	const scenes = Array.isArray(self.scenes) ? self.scenes : []

	for (const s of scenes) {
		const id = String(s.ItemId)
		const name = sceneName(s)
		const folder = sceneFolder(s)
		const seq = isSequence(s)
		const style = look(name, [30, 30, 30], seq ? 'sequence' : 'scene')
		// Umbrochene Namens-Variable in fester Größe 14, damit auch spätere
		// Umbenennungen in der App sauber auf die Taste passen
		style.text = `$(${label}:scene_${id}_label)`
		style.size = '14'
		presets[`scene_${id}`] = {
			type: 'button',
			category: folder ? `Szenen: ${folder}` : 'Szenen',
			name: `${seq ? 'Sequenz' : 'Szene'}: ${name}`,
			style,
			steps: [{ down: [{ actionId: 'scene_toggle', options: { itemId: id } }], up: [] }],
			feedbacks: [{ feedbackId: 'scene_active', options: { itemId: id }, style: ACTIVE }],
		}
	}

	// Noch keine Szenen in der App: Beispieltasten mit Item-ID
	for (const id of scenes.length ? [] : ['1', '2', '3', '4']) {
		presets[`scene_toggle_${id}`] = {
			type: 'button',
			category: 'Szenen',
			name: `Szene ${id} umschalten`,
			style: look(`Szene ${id}`, [30, 30, 30], 'scene'),
			steps: [{ down: [{ actionId: 'scene_toggle', options: { itemId: id } }], up: [] }],
			feedbacks: [{ feedbackId: 'scene_active', options: { itemId: id }, style: ACTIVE }],
		}
	}

	if (!scenes.length) {
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
	}

	// ---- Status ---------------------------------------------------------------

	presets['network_devices'] = {
		type: 'button',
		category: 'Status',
		name: 'Netzwerk-Geräte und App erreichbar (grün / rot)',
		style: {
			text: `Netzwerk\n$(${label}:network_devices) Geräte`,
			size: '14',
			color: WHITE,
			bgcolor: combineRgb(40, 40, 40),
			png64: icon('status', 'light'),
			pngalignment: 'center:top',
			alignment: 'center:bottom',
		},
		steps: [{ down: [], up: [] }],
		feedbacks: [{ feedbackId: 'network_status', options: {} }],
	}

	presets['status'] = {
		type: 'button',
		category: 'Status',
		name: 'Verbindungsstatus',
		style: look('Vision', [40, 40, 40], 'status'),
		steps: [{ down: [], up: [] }],
		feedbacks: [{ feedbackId: 'connected', options: {}, style: { bgcolor: combineRgb(0, 102, 204), color: WHITE } }],
	}

	// Ohne ausdrückliche Angabe rechnet Companion 5 mit Topbar und vergrößert den
	// Text um den Faktor 2,1 statt 1/0,6; dann brechen Wörter mitten im Wort um.
	for (const p of Object.values(presets)) {
		if (p && p.style && p.style.show_topbar === undefined) p.style.show_topbar = false
	}
	self.setPresetDefinitions(presets)
}
