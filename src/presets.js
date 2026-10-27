const { combineRgb } = require('@companion-module/base')
const { icon, tile } = require('./icons')
const { CATALOG, COLORS } = require('./effects-data')
const { labelText } = require('./labels')
const { sceneName, sceneFolder, isSequence } = require('./scenes')

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const ORANGE = combineRgb(255, 122, 0)

// Largest font size: tiles only have a narrow strip at the bottom
const TILE_MAX_FONT = 18
const GLYPH_MAX_FONT = 24
// Space for the text in px: below the icon (top 28 px from y 5) or on the tile strip
const GLYPH_TEXT_HEIGHT = 36
const TILE_TEXT_HEIGHT = 34

function textOn(r, g, b) {
	const luminance = 0.299 * r + 0.587 * g + 0.114 * b
	return luminance > 150 ? BLACK : WHITE
}

// Control button with app icon on top, text below (one of the three font sizes)
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

// Tile in app style; white text on a dark strip
function tileLook(text, tileId, fallbackRgb) {
	const png = tile(tileId)
	if (!png) return look(text, fallbackRgb, null)
	const lbl = labelText(text, TILE_MAX_FONT, TILE_TEXT_HEIGHT)
	return { text: lbl.text, size: lbl.size, color: WHITE, bgcolor: BLACK, png64: png, pngalignment: 'center:center', alignment: 'center:bottom' }
}

// Feedback style "active": tile with orange frame, otherwise orange fill
function activeStyle(tileId) {
	const png = tile(`${tileId}_active`)
	return png ? { png64: png } : { bgcolor: ORANGE, color: WHITE }
}

module.exports = function (self) {
	const presets = {}
	const GROUP = '0'
	const label = self.label || 'visioncontrol'

	// ---- Control --------------------------------------------------------------

	presets['blackout'] = {
		type: 'button',
		category: 'Control',
		name: 'Blackout (Group 0)',
		style: look('Blackout', [0, 0, 0], 'blackout'),
		steps: [{ down: [{ actionId: 'blackout', options: { target: 'group', group: GROUP, fade: 10 } }], up: [] }],
		feedbacks: [],
	}

	presets['full_on'] = {
		type: 'button',
		category: 'Control',
		name: 'Full On (white 100 %)',
		style: look('Full On', [255, 255, 255], 'full_on'),
		steps: [
			{
				down: [
					{ actionId: 'set_color', options: { target: 'group', group: GROUP, useColor: true, color: WHITE, useDimmer: true, dimmer: 100, fade: 5 } },
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['sound_trigger'] = {
		type: 'button',
		category: 'Control',
		name: 'Sound Trigger',
		style: look('Sound', [51, 51, 51], 'sound'),
		steps: [{ down: [{ actionId: 'sound_trigger', options: {} }], up: [] }],
		feedbacks: [],
	}

	// ---- Dimmer levels --------------------------------------------------------

	for (const pct of [0, 10, 25, 50, 75, 100]) {
		const shade = Math.round((pct / 100) * 255)
		presets[`dim_${pct}`] = {
			type: 'button',
			category: 'Dimmer',
			name: `Dimmer ${pct} %`,
			style: look(`${pct}%`, [shade, shade, shade], 'dimmer'),
			steps: [{ down: [{ actionId: 'set_dimmer', options: { target: 'group', group: GROUP, dimmer: pct, fade: 10 } }], up: [] }],
			feedbacks: [],
		}
	}

	// ---- Colors (tiles like "Color appearance") -------------------------------

	for (const c of COLORS) {
		const [r, g, b] = c.rgb
		presets[`color_${c.key}`] = {
			type: 'button',
			category: 'Colors',
			name: c.name,
			style: tileLook(c.name, `color_${c.key}`, c.rgb),
			steps: [
				{
					down: [
						{
							actionId: 'set_color',
							options: { target: 'group', group: GROUP, useColor: true, color: combineRgb(r, g, b), useDimmer: true, dimmer: 100, fade: 0 },
						},
					],
					up: [],
				},
			],
			feedbacks: [{ feedbackId: 'color_active', options: { color: c.key, target: 'group', group: GROUP }, style: activeStyle(`color_${c.key}`) }],
		}
	}

	// ---- All catalog effects (effects, pixel/matrix, gym) ---------------------

	for (const e of CATALOG) {
		presets[`fx_${e.id}`] = {
			type: 'button',
			category: e.cat,
			name: `${e.cat}: ${e.station ? `${e.station} ` : ''}${e.name}`,
			style: tileLook(e.label || e.name, e.id, e.colors[0]),
			steps: [
				{
					down: [
						{
							actionId: 'vision_effect',
							options: {
								target: 'group',
								group: GROUP,
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
			feedbacks: [{ feedbackId: 'effect_active', options: { effect: e.id, target: 'group', group: GROUP }, style: activeStyle(e.id) }],
		}
	}

	// ---- Running effect (adjust and display) ----------------------------------

	const ADJUST = [
		{ key: 'faster', name: 'Faster', icon: 'rabbit' },
		{ key: 'slower', name: 'Slower', icon: 'turtle' },
		{ key: 'brighter', name: 'Brighter', icon: 'full_on' },
		{ key: 'darker', name: 'Darker', icon: 'blackout' },
		{ key: 'range_up', name: 'Range +', icon: 'range' },
		{ key: 'range_down', name: 'Range −', icon: 'range' },
	]
	for (const a of ADJUST) {
		presets[`adjust_${a.key}`] = {
			type: 'button',
			category: 'Running effect',
			name: a.name,
			style: look(a.name, [40, 40, 40], a.icon),
			steps: [{ down: [{ actionId: 'adjust_effect', options: { target: 'group', group: GROUP, what: a.key, percent: 20, rangeStep: 5 } }], up: [] }],
			feedbacks: [],
		}
	}

	presets['active_info'] = {
		type: 'button',
		category: 'Running effect',
		name: 'Display: active effect',
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
		// Automatically takes on the tile of the running effect
		feedbacks: [{ feedbackId: 'active_effect_image', options: { target: 'group', group: GROUP } }],
	}

	presets['active_tempo'] = {
		type: 'button',
		category: 'Running effect',
		name: 'Display: speed and brightness',
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

	// ---- Rotary encoder (Stream Deck +) ---------------------------------------
	// Turning changes the brightness, pressing toggles blackout on/off.
	// The bar shows the brightness on the display above the encoder.

	presets['encoder_dimmer'] = {
		type: 'button',
		category: 'Rotary encoder (Stream Deck +)',
		name: 'Brightness: turn = brighter/darker, press = Blackout on/off',
		options: { rotaryActions: true },
		style: {
			text: `$(${label}:active_dimmer)`,
			size: '14',
			color: WHITE,
			bgcolor: BLACK, // black like the rest of the touch display
			png64: icon('dimmer', 'light'),
			pngalignment: 'center:top',
			alignment: 'center:bottom',
		},
		steps: [
			{
				down: [{ actionId: 'dimmer_toggle', options: { target: 'group', group: GROUP, fade: 0 } }],
				up: [],
				rotate_left: [{ actionId: 'dimmer_step', options: { target: 'group', group: GROUP, step: -5 } }],
				rotate_right: [{ actionId: 'dimmer_step', options: { target: 'group', group: GROUP, step: 5 } }],
			},
		],
		feedbacks: [{ feedbackId: 'dimmer_level', options: { target: 'group', group: GROUP } }],
	}

	presets['encoder_dimmer_fine'] = {
		...presets['encoder_dimmer'],
		name: 'Brightness fine (1 % per detent)',
		steps: [
			{
				down: [{ actionId: 'dimmer_toggle', options: { target: 'group', group: GROUP, fade: 0 } }],
				up: [],
				rotate_left: [{ actionId: 'dimmer_step', options: { target: 'group', group: GROUP, step: -1 } }],
				rotate_right: [{ actionId: 'dimmer_step', options: { target: 'group', group: GROUP, step: 1 } }],
			},
		],
	}

	// On the Stream Deck +, Companion puts the rotary encoders in row 4, the touch display
	// shows row 3. This button belongs above the encoder: it shows value and bar,
	// tap = Blackout on/off, vertical swipe = brighter/darker.
	presets['encoder_dimmer_display'] = {
		...presets['encoder_dimmer'],
		name: 'Brightness: display above the encoder (tap = Blackout, swipe = brighter/darker)',
	}

	// ---- Groups: automatically from the app -------------------------------------
	// One set per group: rotary encoder (also usable on the touch display or a key)
	// and brighter/darker keys. Texts are variables, so renames in the app follow.

	for (const g of Array.isArray(self.groups) ? self.groups : []) {
		const gid = String(g.id)
		const target = { target: 'group', group: gid }
		const levelText = `$(${label}:group_${gid}_short)
$(${label}:group_${gid}_dimmer)`
		const category = `Group: ${g.name}`
		presets[`group_${gid}_encoder`] = {
			type: 'button',
			category,
			name: `${g.name}: brightness (turn = brighter/darker, press = Blackout on/off)`,
			options: { rotaryActions: true },
			style: {
				text: levelText,
				size: '14',
				color: WHITE,
				bgcolor: BLACK,
				png64: icon('dimmer', 'light'),
				pngalignment: 'center:top',
				alignment: 'center:bottom',
			},
			steps: [
				{
					down: [{ actionId: 'dimmer_toggle', options: { ...target, fade: 0 } }],
					up: [],
					rotate_left: [{ actionId: 'dimmer_step', options: { ...target, step: -5 } }],
					rotate_right: [{ actionId: 'dimmer_step', options: { ...target, step: 5 } }],
				},
			],
			feedbacks: [{ feedbackId: 'dimmer_level', options: { ...target } }],
		}
		for (const step of [
			{ key: 'up', name: 'brighter', pct: 10, icon: 'full_on' },
			{ key: 'down', name: 'darker', pct: -10, icon: 'blackout' },
		]) {
			presets[`group_${gid}_dim_${step.key}`] = {
				type: 'button',
				category,
				name: `${g.name}: ${step.name} (${step.pct > 0 ? '+' : ''}${step.pct} %)`,
				style: { ...look('', [40, 40, 40], step.icon), text: levelText, size: '14' },
				steps: [{ down: [{ actionId: 'dimmer_step', options: { ...target, step: step.pct } }], up: [] }],
				feedbacks: [{ feedbackId: 'dimmer_level', options: { ...target } }],
			}
		}
	}

	// ---- Scenes: automatically from the app -------------------------------------
	// The button text is the scene's name variable, so that renames in
	// the app also reach buttons that are already placed.

	const ACTIVE = { bgcolor: combineRgb(0, 153, 51), color: WHITE }
	const scenes = Array.isArray(self.scenes) ? self.scenes : []

	for (const s of scenes) {
		const id = String(s.ItemId)
		const name = sceneName(s)
		const folder = sceneFolder(s)
		const seq = isSequence(s)
		const style = look(name, [30, 30, 30], seq ? 'sequence' : 'scene')
		// Wrapped name variable at a fixed size of 14, so that later
		// renames in the app also fit cleanly on the button
		style.text = `$(${label}:scene_${id}_label)`
		style.size = '14'
		presets[`scene_${id}`] = {
			type: 'button',
			category: folder ? `Scenes: ${folder}` : 'Scenes',
			name: `${seq ? 'Sequence' : 'Scene'}: ${name}`,
			style,
			steps: [{ down: [{ actionId: 'scene_toggle', options: { itemId: id } }], up: [] }],
			feedbacks: [{ feedbackId: 'scene_active', options: { itemId: id }, style: ACTIVE }],
		}
	}

	// No scenes in the app yet: example buttons with item ID
	for (const id of scenes.length ? [] : ['1', '2', '3', '4']) {
		presets[`scene_toggle_${id}`] = {
			type: 'button',
			category: 'Scenes',
			name: `Toggle scene ${id}`,
			style: look(`Scene ${id}`, [30, 30, 30], 'scene'),
			steps: [{ down: [{ actionId: 'scene_toggle', options: { itemId: id } }], up: [] }],
			feedbacks: [{ feedbackId: 'scene_active', options: { itemId: id }, style: ACTIVE }],
		}
	}

	if (!scenes.length) {
		presets['scene_on_example'] = {
			type: 'button',
			category: 'Scenes',
			name: 'Scene On (example ID 1)',
			style: look('Scene 1 On', [0, 102, 0], 'play'),
			steps: [{ down: [{ actionId: 'scene_on', options: { itemId: '1' } }], up: [] }],
			feedbacks: [{ feedbackId: 'scene_active', options: { itemId: '1' }, style: ACTIVE }],
		}

		presets['scene_off_example'] = {
			type: 'button',
			category: 'Scenes',
			name: 'Scene Off (example ID 1)',
			style: look('Scene 1 Off', [102, 0, 0], 'pause'),
			steps: [{ down: [{ actionId: 'scene_off', options: { itemId: '1' } }], up: [] }],
			feedbacks: [],
		}
	}

	// ---- Status ---------------------------------------------------------------

	presets['network_devices'] = {
		type: 'button',
		category: 'Status',
		name: 'Network devices and app reachable (green / red)',
		style: {
			text: `Network\n$(${label}:network_devices) devices`,
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
		name: 'Connection status',
		style: look('Vision', [40, 40, 40], 'status'),
		steps: [{ down: [], up: [] }],
		feedbacks: [{ feedbackId: 'connected', options: {}, style: { bgcolor: combineRgb(0, 102, 204), color: WHITE } }],
	}

	// Without an explicit setting, Companion 5 assumes a topbar and enlarges the
	// text by a factor of 2.1 instead of 1/0.6; words then break mid-word.
	for (const p of Object.values(presets)) {
		if (p && p.style && p.style.show_topbar === undefined) p.style.show_topbar = false
	}
	self.setPresetDefinitions(presets)
}
