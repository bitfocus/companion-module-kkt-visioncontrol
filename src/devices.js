// Devices in the Vision network and reachability of the app.
//
// Important: GET /Network/Info lists all devices that BELONG to the network,
// including switched-off ones (confirmed by testing). Whether a device is on or
// reachable is currently not provided by the REST API. The display therefore
// only counts the network devices and colors by the app's reachability.

/** Name of a device; the end of the serial number distinguishes devices with the same name */
function deviceLabel(f) {
	const base = (f && (f.DeviceLabel || f.Fixturename)) || 'Device'
	const serial = f && f.Serial !== undefined ? String(f.Serial) : ''
	return serial ? `${base} #${serial.slice(-4)}` : base
}

/**
 * @param {object} p
 * @param {boolean} p.connected  app's API reachable
 * @param {boolean} p.readOk     GET /Network/Info last succeeded
 * @param {object[]} p.current   devices from /Network/Info
 * @returns {{ count: number, names: string[], level: 'ok'|'error' }}
 */
function networkStatus({ connected, readOk, current }) {
	const ok = !!(connected && readOk)
	const list = ok ? current : []
	return { count: list.length, names: list.map(deviceLabel), level: ok ? 'ok' : 'error' }
}

module.exports = { networkStatus, deviceLabel }
