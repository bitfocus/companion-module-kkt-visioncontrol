// Einheitliche Beschriftung: genau drei Schriftgrößen im ganzen Modul.
// Gewählt wird die größte Stufe, in der der Text einzeilig passt; sonst die
// größte Stufe, in der er zweizeilig passt (Umbruch an Leerzeichen und nach
// Bindestrichen).
//
// Gemessen wie Companion 5.1 zeichnet: Schrift "Companion-sans" ist Arimo
// (Arial-Maße). Eine klassische Größe s wird ohne Topbar zu s / 0,6 Einheiten;
// eine Einheit ist 1 % der Tastenhöhe abzüglich 2 × 1,5 % Rand, geteilt durch
// das Zeilenbox-Verhältnis der Schrift (1,117). Auf einer 72-px-Taste ergibt
// das s × 1,042 px. Nutzbare Breite: 72 px abzüglich 2 × 3 % Rand = 67,7 px.
// Die Presets setzen deshalb show_topbar: false (mit Topbar rechnet Companion
// mit dem Faktor 2,1 statt 1/0,6, dann brechen z. B. "Cardio" und "Abendrot").

const SIZES = [24, 18, 14]
const MAX_WIDTH = 66 // 67,7 px abzüglich Sicherheitsrand
const PX_PER_SIZE = 1.042
const LINE_BOX = 1.117

// Arimo: Vorschubbreite je Zeichen in 1/1000 em
const ADV_CHARS =
	" !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÄÖÜäöüß−–…°€"
const ADV_WIDTHS = [
	278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278,
	278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
	667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556,
	556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 667, 778, 722, 556, 556, 556, 611, 584, 556, 1000, 400, 556,
]
const ADV = new Map([...ADV_CHARS].map((c, i) => [c, ADV_WIDTHS[i]]))

/** Breite in px auf einer 72-px-Taste */
function textWidth(text, size) {
	let em = 0
	for (const c of String(text)) em += ADV.get(c) ?? 600
	return (em / 1000) * size * PX_PER_SIZE
}

/** Höhe eines Textblocks mit n Zeilen in px */
function textHeight(lines, size) {
	return lines * size * PX_PER_SIZE * LINE_BOX
}

// Wörter; nach einem Bindestrich darf umbrochen werden ("Cool-" / "down")
function tokens(text) {
	return String(text)
		.split(/\s+/)
		.filter(Boolean)
		.flatMap((w) => w.split(/(?<=-)(?=.)/).map((part, i, all) => ({ part, glue: i < all.length - 1 })))
}

const VOWEL = /[aeiouäöüyAEIOUÄÖÜY]/

/**
 * Notfall-Trennung eines zu breiten Worts: bevorzugt vor einer Silbe
 * (Konsonant + Vokal, z. B. "Lang-samer", "Warm-weiß"), möglichst mittig.
 */
function hyphenate(word, size) {
	const chars = [...word]
	let best = null
	for (let k = 2; k <= chars.length - 2; k++) {
		const head = chars.slice(0, k).join('') + '-'
		if (textWidth(head, size) > MAX_WIDTH) break
		const syllable = !VOWEL.test(chars[k]) && VOWEL.test(chars[k + 1] || '') && !(chars[k - 1] === 'c' && /[hk]/.test(chars[k]))
		const score = (syllable ? 0 : 100) + Math.abs(chars.length / 2 - k)
		if (!best || score < best.score) best = { score, head, tail: chars.slice(k).join('') }
	}
	return best ? [best.head, best.tail] : null
}

// Gieriger Zeilenumbruch; null, wenn ein Wortteil zu breit ist
// (mit allowHyphen wird ein solches Wort stattdessen getrennt)
function wrap(text, size, allowHyphen = false) {
	const lines = []
	let line = ''
	let joinNoSpace = false
	const parts = []
	for (const t of tokens(text)) {
		const split = allowHyphen && textWidth(t.part, size) > MAX_WIDTH ? hyphenate(t.part, size) : null
		if (split) parts.push({ part: split[0], glue: true }, { part: split[1], glue: t.glue })
		else parts.push(t)
	}
	for (const { part, glue } of parts) {
		if (textWidth(part, size) > MAX_WIDTH) return null
		const next = line ? line + (joinNoSpace ? '' : ' ') + part : part
		if (textWidth(next, size) <= MAX_WIDTH) line = next
		else {
			lines.push(line)
			line = part
		}
		joinNoSpace = glue
	}
	if (line) lines.push(line)
	return lines
}

/**
 * @param {string} text
 * @param {number} maxSize    größte erlaubte Stufe (24 oder 18)
 * @param {number} maxHeight  verfügbare Höhe für den Text in px
 * @returns {{ size: string, lines: string[] }}
 */
function fitLabel(text, maxSize = 24, maxHeight = 72) {
	const sizes = SIZES.filter((x) => x <= maxSize)
	for (const lineCount of [1, 2]) {
		for (const s of sizes) {
			const lines = wrap(text, s)
			if (lines && lines.length === lineCount && textHeight(lineCount, s) <= maxHeight) return { size: String(s), lines }
		}
	}
	const small = SIZES[SIZES.length - 1]
	const lines = wrap(text, small, true) || [String(text)]
	return { size: String(small), lines }
}

/** Text mit expliziten Zeilenumbrüchen, damit Companion genau so umbricht */
function labelText(text, maxSize = 24, maxHeight = 72) {
	const fit = fitLabel(text, maxSize, maxHeight)
	return { text: fit.lines.join('\n'), size: fit.size, lineCount: fit.lines.length }
}

module.exports = { fitLabel, labelText, textWidth, textHeight, SIZES, MAX_WIDTH }
