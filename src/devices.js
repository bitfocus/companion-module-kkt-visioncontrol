// Geräte im Vision-Netzwerk und Erreichbarkeit der App.
//
// Wichtig: GET /Network/Info listet alle Geräte, die zum Netzwerk GEHÖREN,
// auch ausgeschaltete (per Test bestätigt). Ob ein Gerät eingeschaltet bzw.
// erreichbar ist, liefert die REST-API derzeit nicht. Die Anzeige zählt daher
// nur die Netzwerk-Geräte und färbt nach der Erreichbarkeit der App.

/** Name eines Geräts; das Seriennummer-Ende macht gleichnamige Geräte unterscheidbar */
function deviceLabel(f) {
	const base = (f && (f.DeviceLabel || f.Fixturename)) || 'Gerät'
	const serial = f && f.Serial !== undefined ? String(f.Serial) : ''
	return serial ? `${base} #${serial.slice(-4)}` : base
}

/**
 * @param {object} p
 * @param {boolean} p.connected  API der App erreichbar
 * @param {boolean} p.readOk     GET /Network/Info zuletzt erfolgreich
 * @param {object[]} p.current   Geräte aus /Network/Info
 * @returns {{ count: number, names: string[], level: 'ok'|'error' }}
 */
function networkStatus({ connected, readOk, current }) {
	const ok = !!(connected && readOk)
	const list = ok ? current : []
	return { count: list.length, names: list.map(deviceLabel), level: ok ? 'ok' : 'error' }
}

module.exports = { networkStatus, deviceLabel }
