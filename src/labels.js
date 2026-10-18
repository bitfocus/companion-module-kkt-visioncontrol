// Einheitliche Beschriftung: genau drei Schriftgrößen im ganzen Modul.
// Gewählt wird die größte Stufe, in der der Text einzeilig passt; sonst die
// kleinste Stufe, dann ggf. zweizeilig (Umbruch an Leerzeichen).
//
// Die Zeichenbreite ist eine Schätzung für Companions Button-Schrift
// (ca. 0,52 × Schriftgröße). Nutzbare Breite einer 72-px-Taste: ca. 68 px.
// Damit passen einzeilig: 24 px bis 5, 18 px bis 7, 14 px bis 9 Zeichen.

const SIZES = [24, 18, 14]
const MAX_WIDTH = 68
const CHAR_FACTOR = 0.52

function charsPerLine(size) {
	return Math.floor(MAX_WIDTH / (size * CHAR_FACTOR))
}

// Gieriger Zeilenumbruch an Leerzeichen; null, wenn ein Wort zu lang ist
function wrap(text, maxChars) {
	const lines = []
	let line = ''
	for (const word of String(text).split(/\s+/).filter(Boolean)) {
		if (word.length > maxChars) return null
		const next = line ? `${line} ${word}` : word
		if (next.length <= maxChars) line = next
		else {
			lines.push(line)
			line = word
		}
	}
	if (line) lines.push(line)
	return lines
}

/**
 * @param {string} text
 * @param {number} maxSize  größte erlaubte Stufe (24 oder 18)
 * @returns {{ size: string, lines: string[] }}
 */
function fitLabel(text, maxSize = 24) {
	for (const s of SIZES.filter((x) => x <= maxSize)) {
		const lines = wrap(text, charsPerLine(s))
		if (lines && lines.length === 1) return { size: String(s), lines }
	}
	const small = SIZES[SIZES.length - 1]
	const lines = wrap(text, charsPerLine(small)) || [String(text)]
	return { size: String(small), lines }
}

/** Text mit expliziten Zeilenumbrüchen, damit Companion genau so umbricht */
function labelText(text, maxSize = 24) {
	const fit = fitLabel(text, maxSize)
	return { text: fit.lines.join('\n'), size: fit.size, lineCount: fit.lines.length }
}

module.exports = { fitLabel, labelText, SIZES }
