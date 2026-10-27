const { sceneName } = require('./scenes')

module.exports = function (self) {
	const defs = [
		{ variableId: 'connection', name: 'Connection status (connected/disconnected)' },
		{ variableId: 'network_name', name: 'Network name' },
		{ variableId: 'network_id', name: 'Network ID' },
		{ variableId: 'scene_count', name: 'Number of scenes/sequences' },
		{ variableId: 'active_effect', name: 'Active effect (name) of the status group' },
		{ variableId: 'active_effect_id', name: 'Active effect (catalog ID, custom, color:… or off)' },
		{ variableId: 'active_category', name: 'Category of the active effect' },
		{ variableId: 'active_seconds', name: 'Seconds per color step of the active effect' },
		{ variableId: 'active_dimmer', name: 'Brightness of the status group' },
		{ variableId: 'active_range', name: 'Range of the active effect' },
		{ variableId: 'network_devices', name: 'Devices in the network (count, including switched-off ones)' },
		{ variableId: 'network_device_names', name: 'Devices in the network (names with end of serial number)' },
		{ variableId: 'app_reachable', name: 'App reachable (yes/no)' },
		{ variableId: 'group_count', name: 'Number of groups' },
	]
	// Per scene: name from the app and active state (automatically follow renames)
	for (const s of self.scenes || []) {
		defs.push({ variableId: `scene_${s.ItemId}_name`, name: `Scene ${s.ItemId}: Name (${sceneName(s)})` })
		defs.push({ variableId: `scene_${s.ItemId}_label`, name: `Scene ${s.ItemId}: Name for buttons (wrapped, size 14)` })
		defs.push({ variableId: `scene_${s.ItemId}_active`, name: `Scene ${s.ItemId}: active (true/false)` })
	}
	// Per group: name, brightness and running effect
	for (const g of self.groups || []) {
		defs.push({ variableId: `group_${g.id}_name`, name: `Group ${g.id}: Name (${g.name})` })
		defs.push({ variableId: `group_${g.id}_short`, name: `Group ${g.id}: Name for buttons (one line, size 14)` })
		defs.push({ variableId: `group_${g.id}_dimmer`, name: `Group ${g.id}: Brightness` })
		defs.push({ variableId: `group_${g.id}_effect`, name: `Group ${g.id}: Active effect` })
	}
	self.setVariableDefinitions(defs)
}
