const { combineRgb } = require('@companion-module/base')

module.exports = function (self) {
	const presets = {}

	presets['blackout'] = {
		type: 'button',
		category: 'Allgemein',
		name: 'Blackout (Gruppe 0)',
		style: { text: 'BLACK\nOUT', size: '18', color: combineRgb(255, 255, 255), bgcolor: combineRgb(0, 0, 0) },
		steps: [{ down: [{ actionId: 'blackout', options: { target: 'group', id: '0', fade: 10 } }], up: [] }],
		feedbacks: [],
	}

	presets['sound_trigger'] = {
		type: 'button',
		category: 'Allgemein',
		name: 'Sound Trigger',
		style: { text: 'SOUND', size: '18', color: combineRgb(255, 255, 255), bgcolor: combineRgb(51, 51, 51) },
		steps: [{ down: [{ actionId: 'sound_trigger', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['color_chase'] = {
		type: 'button',
		category: 'Allgemein',
		name: 'Effekt: Farbwechsel R-G-B (Gruppe 0)',
		style: { text: 'CHASE', size: '18', color: combineRgb(255, 255, 255), bgcolor: combineRgb(90, 0, 90) },
		steps: [
			{
				down: [
					{
						actionId: 'color_chase',
						options: {
							target: 'group',
							id: '0',
							c1: combineRgb(255, 0, 0),
							c2: combineRgb(0, 255, 0),
							c3: combineRgb(0, 0, 255),
							step: 8,
							fade: 8,
							speed: 128,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['status'] = {
		type: 'button',
		category: 'Status',
		name: 'Verbindungsstatus',
		style: { text: 'VISION', size: '14', color: combineRgb(255, 255, 255), bgcolor: combineRgb(40, 40, 40) },
		steps: [{ down: [], up: [] }],
		feedbacks: [{ feedbackId: 'connected', options: {} }],
	}

	self.setPresetDefinitions(presets)
}
