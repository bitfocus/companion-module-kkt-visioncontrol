// Erreichbarkeit der Geräte im Vision-Netzwerk.
// Live-Quelle: GET /Network/Info (Geräte, die die App gerade kennt).
// Soll-Anzahl: Einstellung "Anzahl Geräte im Netzwerk"; 0 = höchste bisher
// gesehene Anzahl seit dem Start des Moduls.

/** Name eines Geräts für Anzeigen */
function deviceLabel(f) {
	const base = (f && (f.DeviceLabel || f.Fixturename)) || 'Gerät'
	const serial = f && f.Serial !== undefined ? String(f.Serial) : ''
	// Seriennummer-Ende macht gleichnamige Geräte unterscheidbar
	return serial ? `${base} #${serial.slice(-4)}` : base
}

/**
 * @param {object} p
 * @param {boolean} p.connected   API erreichbar
 * @param {boolean} p.readOk      GET /Network/Info zuletzt erfolgreich
 * @param {object[]} p.current    aktuelle Geräte aus /Network/Info
 * @param {Map} p.known           RDMID -> Name, alle bisher gesehenen Geräte
 * @param {number} p.expected     Soll-Anzahl aus der Einstellung (0 = automatisch)
 */
function deviceStatus({ connected, readOk, current, known, expected }) {
	const online = connected && readOk ? current.length : 0
	const total = Number(expected) > 0 ? Number(expected) : Math.max(known.size, online)
	const currentIds = new Set(current.map((f) => String(f.RDMID)))
	const missing = connected && readOk ? [...known.entries()].filter(([id]) => !currentIds.has(id)).map(([, name]) => name) : [...known.values()]
	// Fehlende Geräte, die das Modul nie gesehen hat (nur bei fester Soll-Anzahl)
	const unknownMissing = Math.max(0, total - online - missing.length)
	if (unknownMissing > 0) missing.push(`+${unknownMissing} unbekannt`)
	let level = 'ok'
	if (!connected || !readOk || online === 0) level = 'error'
	else if (online < total) level = 'warn'
	return { online, total, missing, level }
}

module.exports = { deviceStatus, deviceLabel }
