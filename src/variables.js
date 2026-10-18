module.exports = function (self) {
	self.setVariableDefinitions([
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
	])
}
