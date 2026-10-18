const { sceneName } = require('./scenes')

module.exports = function (self) {
	const defs = [
		{ variableId: 'connection', name: 'Verbindungsstatus (connected/disconnected)' },
		{ variableId: 'network_name', name: 'Netzwerkname' },
		{ variableId: 'network_id', name: 'Netzwerk-ID' },
		{ variableId: 'scene_count', name: 'Anzahl Szenen/Sequenzen' },
		{ variableId: 'active_effect', name: 'Aktiver Effekt (Name) der Status-Gruppe' },
		{ variableId: 'active_effect_id', name: 'Aktiver Effekt (Katalog-ID, custom, color:… oder off)' },
		{ variableId: 'active_category', name: 'Kategorie des aktiven Effekts' },
		{ variableId: 'active_seconds', name: 'Sekunden pro Farbschritt des aktiven Effekts' },
		{ variableId: 'active_dimmer', name: 'Helligkeit der Status-Gruppe' },
		{ variableId: 'active_range', name: 'Range des aktiven Effekts' },
	]
	// Pro Szene: Name aus der App und Aktiv-Status (folgen Umbenennungen automatisch)
	for (const s of self.scenes || []) {
		defs.push({ variableId: `scene_${s.ItemId}_name`, name: `Szene ${s.ItemId}: Name (${sceneName(s)})` })
		defs.push({ variableId: `scene_${s.ItemId}_active`, name: `Szene ${s.ItemId}: aktiv (true/false)` })
	}
	self.setVariableDefinitions(defs)
}
