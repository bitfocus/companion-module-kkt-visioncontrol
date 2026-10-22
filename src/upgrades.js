// Migrationsschritte für bestehende Verbindungen. Companion führt jedes Skript
// genau einmal pro Verbindung aus, neue Skripte immer hinten anhängen.

/**
 * Abfrage-Intervall 2000 → 1000 ms: Eine große Abfrage dauert nur ca. 35 ms,
 * Geräte erscheinen so doppelt so schnell. Nur ändern, wenn noch der alte
 * Standardwert eingestellt ist.
 */
function pollIntervalTo1000(_context, props) {
	const result = { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }
	if (props.config && Number(props.config.poll) === 2000) {
		result.updatedConfig = { ...props.config, poll: 1000 }
	}
	return result
}

/**
 * Schnelle Abfrage (fastPoll) ausdrücklich eintragen. Ältere Verbindungen
 * kennen das Feld nicht; Companion zeigt es dann als 0 an, und ein Speichern
 * der Einstellungen hätte die schnelle Abfrage abgeschaltet.
 */
function fastPollDefault(_context, props) {
	const result = { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }
	if (props.config && (props.config.fastPoll === undefined || props.config.fastPoll === null || props.config.fastPoll === '')) {
		result.updatedConfig = { ...props.config, fastPoll: 500 }
	}
	return result
}

module.exports = [pollIntervalTo1000, fastPollDefault]
