const { combineRgb } = require('@companion-module/base')

module.exports = function (self) {
	self.setFeedbackDefinitions({
		scene_active: {
			name: 'Szene / Sequenz ist aktiv',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 153, 51),
				color: combineRgb(255, 255, 255),
			},
			options: [{ id: 'itemId', type: 'textinput', label: 'Item-ID', default: '' }],
			callback: (feedback) => {
				return !!self.sceneActive[String(feedback.options.itemId).trim()]
			},
		},

		connected: {
			name: 'Mit Vision Control verbunden',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 102, 204),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: () => {
				return !!self.connected
			},
		},
	})
}
