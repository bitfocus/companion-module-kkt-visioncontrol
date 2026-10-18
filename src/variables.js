module.exports = function (self) {
	self.setVariableDefinitions([
		{ variableId: 'connection', name: 'Verbindungsstatus (connected/disconnected)' },
		{ variableId: 'network_name', name: 'Netzwerkname' },
		{ variableId: 'network_id', name: 'Netzwerk-ID' },
		{ variableId: 'scene_count', name: 'Anzahl Szenen/Sequenzen' },
	])
}
