const { combineRgb } = require('@companion-module/base')
const { CATALOG, CATALOG_BY_ID } = require('./effects-data')
const { buildEffectContent } = require('./fx')
const { sceneChoices } = require('./scenes')

const CATALOG_CHOICES = CATALOG.map((e) => ({ id: e.id, label: `${e.cat}: ${e.name}` }))

// Textfelder bieten auch lokale Variablen der Taste an ($(local:…), $(this:…))
const LOCAL_VARS = { local: true }

// Zeitangaben in verständlichen Einheiten. Hinweis: Der rohe TimeMultiplier der
// API ist ein Zeitfaktor (höher = langsamer, 0 = steht); src/fx.js rechnet um.
const TIMING_OPTIONS = (sec, softPct) => [
	{ id: 'sec', type: 'number', label: 'Sekunden pro Farbschritt', default: sec, min: 0.05, max: 120, step: 0.05 },
	{ id: 'soft', type: 'number', label: 'Weichheit % (Anteil Überblendung)', default: softPct, min: 0, max: 100 },
]

// Feld nur zeigen, wenn die Checkbox gesetzt ist (neue und ältere Companion-Versionen)
function visibleIf(checkboxId) {
	return {
		isVisibleExpression: `$(options:${checkboxId})`,
		isVisible: new Function('options', `return !!options['${checkboxId}']`),
	}
}

// Neue Tasten liefern sec/soft; ältere Tasten noch step/fade/speed.
function timingFrom(o) {
	if (o.sec !== undefined && o.sec !== null && o.sec !== '') return { sec: Number(o.sec), soft: (Number(o.soft) || 0) / 100 }
	return { step: o.step, fade: o.fade, speed: o.speed }
}

// FxComponentTrigger-Enum
const TRIGGERS = [
	{ id: 0, label: 'Keiner (läuft frei)' },
	{ id: 1, label: 'Tap' },
	{ id: 2, label: 'Beat (Musik-Takt)' },
	{ id: 3, label: 'Pulse (Lautstärke / Frequenzband)' },
]

// Companion colorpicker liefert 24-bit RGB (0xRRGGBB).
function splitRgb(value) {
	const v = Number(value) || 0
	return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff }
}
// 8-bit (0..255) -> 16-bit (0..65535) der Vision-API
const scale16 = (x) => Math.round((x / 255) * 65535)
// Prozent (0..100) -> 16-bit (0..65535)
const pct16 = (p) => Math.round((Math.max(0, Math.min(100, p)) / 100) * 65535)

const TARGETS = [
	{ id: 'group', label: 'Gruppe (GroupID)' },
	{ id: 'fixture', label: 'Fixture (RDMID)' },
]

// EffectType-Enum (als Zahl an die API senden)
const EFFECTS = [
	{ id: 0, label: 'Kein Muster (nur Farbfolge)' },
	{ id: 1, label: 'Kreis' },
	{ id: 2, label: 'Teilung 2 rechts' },
	{ id: 3, label: 'Teilung 2 hoch' },
	{ id: 4, label: 'Wand rechts' },
	{ id: 5, label: 'Wand hoch' },
	{ id: 6, label: 'Wand Split horizontal' },
	{ id: 7, label: 'Wand Split vertikal' },
	{ id: 8, label: 'Pfeil rechts' },
	{ id: 9, label: 'Pfeil hoch' },
	{ id: 10, label: 'Pfeil 45°' },
	{ id: 11, label: 'Pfeil 135°' },
	{ id: 12, label: 'Quadrat außen' },
	{ id: 13, label: 'Kreis außen' },
	{ id: 14, label: 'Rauschen' },
	{ id: 15, label: 'Schlange hoch' },
	{ id: 16, label: 'Schlange rechts' },
	{ id: 17, label: 'Regen hoch' },
	{ id: 18, label: 'Regen rechts' },
	{ id: 19, label: 'Schach' },
	{ id: 20, label: 'Pixel' },
]

// EffectGeometrie-Enum: bestimmt, worüber sich der Effekt verteilt.
const GEOMETRY = [
	{ id: 0, label: 'Gerät (ganze Fixtures)' },
	{ id: 1, label: 'Einzeln' },
	{ id: 2, label: 'Pixel / Matrix' },
]

module.exports = function (self) {
	// Variablen im Kontext der Taste auflösen, inkl. lokaler Variablen
	// ($(local:…), $(this:…)). Ältere Companion-Versionen ohne Kontext: global.
	const parse = (context, text) =>
		context && typeof context.parseVariablesInString === 'function'
			? context.parseVariablesInString(String(text ?? ''))
			: self.parseVariablesInString(String(text ?? ''))

	// Szenen aus der App als Auswahl; eigene Item-ID oder Variable bleibt möglich
	const sceneList = sceneChoices(self.scenes)
	const sceneOption = () => ({
		id: 'itemId',
		type: 'dropdown',
		label: 'Szene / Sequenz',
		default: sceneList[0].id,
		choices: sceneList,
		allowCustom: true,
		tooltip: 'Szenen aus der Vision Control App. Eigene Item-ID oder Variable ist ebenfalls möglich, auch lokal, z. B. $(local:szene).',
	})
	const sceneId = async (raw, context) => {
		const id = String(await parse(context, String(raw ?? ''))).trim()
		if (!id) throw new Error('Keine Szene gewählt')
		return id
	}

	self.setActionDefinitions({
		scene_on: {
			name: 'Szene / Sequenz: An',
			options: [sceneOption()],
			callback: async (event, context) => {
				const id = await sceneId(event.options.itemId, context)
				await self.switchScene(id, true)
			},
		},

		scene_off: {
			name: 'Szene / Sequenz: Aus',
			options: [sceneOption()],
			callback: async (event, context) => {
				const id = await sceneId(event.options.itemId, context)
				await self.switchScene(id, false)
			},
		},

		scene_toggle: {
			name: 'Szene / Sequenz: Umschalten',
			options: [sceneOption()],
			callback: async (event, context) => {
				const id = await sceneId(event.options.itemId, context)
				const isOn = !!self.sceneActive[String(id)]
				await self.switchScene(id, !isOn)
				// Lokalen Status sofort umschalten, damit schnelle Mehrfachklicks
				// nicht am Abfrage-Intervall hängen; das nächste Polling korrigiert.
				self.sceneActive[String(id)] = !isOn
				self.checkFeedbacks('scene_active')
			},
		},

		set_color: {
			name: 'Farbe & Dimmer setzen',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'useColor', type: 'checkbox', label: 'Farbe setzen', default: true },
				{ id: 'color', type: 'colorpicker', label: 'Farbe', default: combineRgb(255, 0, 0) },
				{ id: 'useDimmer', type: 'checkbox', label: 'Dimmer setzen', default: true },
				{ id: 'dimmer', type: 'number', label: 'Dimmer %', default: 100, min: 0, max: 100 },
				{ id: 'fade', type: 'number', label: 'Überblendung (0=sofort … 255=max, keine Sekunden)', default: 0, min: 0, max: 255 },
			],
			callback: async (event, context) => {
				const id = Number(await parse(context, event.options.id))
				const content = {}
				if (event.options.useDimmer) {
					content.MasterDimmer = { Default: false, Value: pct16(event.options.dimmer), Fx: null }
				}
				if (event.options.useColor) {
					const { r, g, b } = splitRgb(event.options.color)
					content.RGB = {
						Default: false,
						Value: { Value1: scale16(r), Value2: scale16(g), Value3: scale16(b) },
						Fx: null,
					}
				}
				if (content.MasterDimmer) self.noteDimmer(event.options.target, id, content.MasterDimmer.Value)
				await self.setControl(event.options.target, id, content, event.options.fade)
			},
		},

		set_dimmer: {
			name: 'Dimmer setzen',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'dimmer', type: 'number', label: 'Dimmer %', default: 100, min: 0, max: 100 },
				{ id: 'fade', type: 'number', label: 'Überblendung (0=sofort … 255=max, keine Sekunden)', default: 10, min: 0, max: 255 },
			],
			callback: async (event, context) => {
				const id = Number(await parse(context, event.options.id))
				const content = { MasterDimmer: { Default: false, Value: pct16(event.options.dimmer), Fx: null } }
				self.noteDimmer(event.options.target, id, content.MasterDimmer.Value)
				await self.setControl(event.options.target, id, content, event.options.fade)
			},
		},

		blackout: {
			name: 'Blackout (Dimmer 0)',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'fade', type: 'number', label: 'Überblendung (0=sofort … 255=max, keine Sekunden)', default: 10, min: 0, max: 255 },
			],
			callback: async (event, context) => {
				const id = Number(await parse(context, event.options.id))
				self.noteDimmer(event.options.target, id, 0)
				await self.setControl(event.options.target, id, { MasterDimmer: { Default: false, Value: 0, Fx: null } }, event.options.fade)
			},
		},

		dimmer_step: {
			name: 'Helligkeit schrittweise (Drehregler)',
			description: 'Für Drehregler, z. B. Stream Deck +: links drehen = negativer Schritt, rechts = positiver. Schnelles Drehen wird zusammengefasst.',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'step', type: 'number', label: 'Schritt in Prozentpunkten (negativ = dunkler)', default: 5, min: -100, max: 100 },
			],
			callback: async (event, context) => {
				const id = Number(await parse(context, event.options.id))
				await self.stepDimmer(event.options.target, id, Number(event.options.step) || 0)
			},
		},

		dimmer_toggle: {
			name: 'Blackout an/aus (Helligkeit merken)',
			description: 'Schaltet auf 0 und beim nächsten Mal zurück auf die Helligkeit davor.',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'fade', type: 'number', label: 'Überblendung (0=sofort … 255=max, keine Sekunden)', default: 0, min: 0, max: 255 },
			],
			callback: async (event, context) => {
				const id = Number(await parse(context, event.options.id))
				await self.toggleBlackout(event.options.target, id, event.options.fade)
			},
		},

		color_chase: {
			name: 'Effekt: Farbwechsel (RGB-Fx)',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'c1', type: 'colorpicker', label: 'Farbe 1', default: combineRgb(255, 0, 0) },
				{ id: 'c2', type: 'colorpicker', label: 'Farbe 2', default: combineRgb(0, 255, 0) },
				{ id: 'c3', type: 'colorpicker', label: 'Farbe 3', default: combineRgb(0, 0, 255) },
				...TIMING_OPTIONS(1.5, 60),
			],
			callback: async (event, context) => {
				const o = event.options
				const id = Number(await parse(context, o.id))
				const rgb = (c) => {
					const { r, g, b } = splitRgb(c)
					return [r, g, b]
				}
				const content = buildEffectContent({ colors: [rgb(o.c1), rgb(o.c2), rgb(o.c3)], effect: 0, geometry: 0, ...timingFrom(o) })
				await self.setControl(o.target, id, content, 0)
			},
		},

		rgb_effect: {
			name: 'Effekt: Muster & Geometrie (Pixel / Matrix)',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'effect', type: 'dropdown', label: 'Muster', default: 20, choices: EFFECTS },
				{ id: 'geometry', type: 'dropdown', label: 'Geometrie', default: 2, choices: GEOMETRY },
				{ id: 'c1', type: 'colorpicker', label: 'Farbe 1', default: combineRgb(255, 0, 0) },
				{ id: 'c2', type: 'colorpicker', label: 'Farbe 2', default: combineRgb(0, 0, 255) },
				{ id: 'useC3', type: 'checkbox', label: 'Dritte Farbe verwenden', default: false },
				{ id: 'c3', type: 'colorpicker', label: 'Farbe 3', default: combineRgb(0, 255, 0) },
				...TIMING_OPTIONS(1.2, 85),
				{ id: 'range', type: 'number', label: 'Verteilung über die Pixel / Range (0 = alle gleich, App-Standard 10)', default: 10, min: 0, max: 255 },
				{ id: 'variation', type: 'number', label: 'Variation (0..255)', default: 0, min: 0, max: 255 },
				{ id: 'bounce', type: 'checkbox', label: 'Bounce (hin und zurück)', default: false },
				{ id: 'reverse', type: 'checkbox', label: 'Rückwärts', default: false },
				{ id: 'trigger', type: 'dropdown', label: 'Auslöser', default: 0, choices: TRIGGERS },
				{ id: 'adaptBpm', type: 'checkbox', label: 'An BPM anpassen (bei Beat)', default: true },
				{ id: 'threshold', type: 'number', label: 'Pulse: Pegelschwelle (0..65535)', default: 2500, min: 0, max: 65535 },
				{ id: 'eqStart', type: 'number', label: 'Pulse: Frequenzband Start (0..255)', default: 0, min: 0, max: 255 },
				{ id: 'eqLength', type: 'number', label: 'Pulse: Frequenzband Breite (0..255)', default: 6, min: 0, max: 255 },
				{ id: 'dimmer', type: 'number', label: 'Helligkeit %', default: 100, min: 0, max: 100 },
			],
			callback: async (event, context) => {
				const o = event.options
				const id = Number(await parse(context, o.id))
				const rgb = (c) => {
					const { r, g, b } = splitRgb(c)
					return [r, g, b]
				}
				const colors = [rgb(o.c1), rgb(o.c2)]
				if (o.useC3) colors.push(rgb(o.c3))
				const trig = Number(o.trigger) || 0
				const content = buildEffectContent({
					colors,
					effect: o.effect,
					geometry: o.geometry,
					...timingFrom(o),
					range: o.range,
					variation: o.variation,
					bounce: o.bounce,
					reverse: o.reverse,
					dimmer: o.dimmer ?? 100,
					trigger:
						trig === 3
							? { start: 3, min: 0, max: 255, threshold: o.threshold, eqStart: o.eqStart, eqLength: o.eqLength }
							: { start: trig, adaptBpm: trig === 2 && o.adaptBpm },
				})
				await self.setControl(o.target, id, content, 0)
			},
		},

		vision_effect: {
			name: 'Effekt aus Katalog (inkl. Fitnessstudio)',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{ id: 'effect', type: 'dropdown', label: 'Effekt', default: CATALOG[0].id, choices: CATALOG_CHOICES },
				{ id: 'overrideDimmer', type: 'checkbox', label: 'Helligkeit überschreiben', default: false },
				{ id: 'dimmer', type: 'number', label: 'Helligkeit %', default: 100, min: 0, max: 100, ...visibleIf('overrideDimmer') },
				{ id: 'overrideTiming', type: 'checkbox', label: 'Tempo überschreiben', default: false },
				{ id: 'sec', type: 'number', label: 'Sekunden pro Farbschritt', default: 1.2, min: 0.05, max: 120, step: 0.05, ...visibleIf('overrideTiming') },
				{ id: 'soft', type: 'number', label: 'Weichheit % (Anteil Überblendung)', default: 80, min: 0, max: 100, ...visibleIf('overrideTiming') },
				{ id: 'overrideRange', type: 'checkbox', label: 'Range überschreiben (nur Muster)', default: false },
				{ id: 'range', type: 'number', label: 'Range (0 = alle Pixel gleich, Standard 10)', default: 10, min: 0, max: 255, ...visibleIf('overrideRange') },
				{ id: 'overrideColors', type: 'checkbox', label: 'Farben überschreiben', default: false },
				{ id: 'c1', type: 'colorpicker', label: 'Farbe 1', default: combineRgb(255, 0, 0), ...visibleIf('overrideColors') },
				{ id: 'c2', type: 'colorpicker', label: 'Farbe 2', default: combineRgb(0, 0, 255), ...visibleIf('overrideColors') },
				{ id: 'useC3', type: 'checkbox', label: 'Dritte Farbe verwenden', default: false, ...visibleIf('overrideColors') },
				{ id: 'c3', type: 'colorpicker', label: 'Farbe 3', default: combineRgb(0, 255, 0), ...visibleIf('overrideColors') },
				{ id: 'reverse', type: 'checkbox', label: 'Richtung umkehren', default: false },
			],
			callback: async (event, context) => {
				const o = event.options
				const base = CATALOG_BY_ID[o.effect]
				if (!base) throw new Error(`Unbekannter Katalog-Effekt: ${o.effect}`)
				const id = Number(await parse(context, o.id))
				const entry = { ...base }
				if (o.overrideDimmer) entry.dimmer = o.dimmer
				if (o.overrideTiming) Object.assign(entry, { sec: Number(o.sec), soft: (Number(o.soft) || 0) / 100 })
				if (o.overrideRange) entry.range = o.range
				if (o.overrideColors) {
					const rgb = (c) => {
						const { r, g, b } = splitRgb(c)
						return [r, g, b]
					}
					entry.colors = [rgb(o.c1), rgb(o.c2)]
					if (o.useC3) entry.colors.push(rgb(o.c3))
				}
				if (o.reverse) entry.reverse = true
				const content = buildEffectContent(entry)
				await self.setControl(o.target, id, content, 0)
				self.markSent(o.target, id, base.id, entry)
			},
		},

		adjust_effect: {
			name: 'Laufenden Effekt anpassen (Tempo, Helligkeit, Range)',
			options: [
				{ id: 'target', type: 'dropdown', label: 'Ziel', default: 'group', choices: TARGETS },
				{ id: 'id', type: 'textinput', label: 'GroupID / RDMID', default: '0', useVariables: LOCAL_VARS },
				{
					id: 'what',
					type: 'dropdown',
					label: 'Änderung',
					default: 'faster',
					choices: [
						{ id: 'faster', label: 'Schneller' },
						{ id: 'slower', label: 'Langsamer' },
						{ id: 'brighter', label: 'Heller' },
						{ id: 'darker', label: 'Dunkler' },
						{ id: 'range_up', label: 'Range erhöhen (breiter verteilt)' },
						{ id: 'range_down', label: 'Range verringern' },
					],
				},
				{ id: 'percent', type: 'number', label: 'Schritt in % (Tempo / Helligkeit)', default: 20, min: 1, max: 100 },
				{ id: 'rangeStep', type: 'number', label: 'Schritt Range-Punkte', default: 5, min: 1, max: 100 },
			],
			callback: async (event, context) => {
				const o = event.options
				const id = Number(await parse(context, o.id))
				await self.adjustActive(o.target, id, o.what, Number(o.percent) || 20, Number(o.rangeStep) || 5)
			},
		},

		sound_trigger: {
			name: 'Sound Control: Trigger',
			options: [],
			callback: async () => {
				await self.expectHandled(await self.http('POST', '/SoundControl/Trigger'), 'Sound-Trigger')
			},
		},
	})
}
