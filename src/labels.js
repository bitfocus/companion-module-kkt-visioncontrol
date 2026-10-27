// Uniform labeling: exactly three font sizes across the whole module.
// The largest size in which the text fits on one line is chosen; otherwise the
// largest size in which it fits on two lines (wrapping at spaces and after
// hyphens).
//
// Measured the way Companion 5.1 draws: the font "Companion-sans" is Arimo
// (Arial metrics). A classic size s becomes s / 0.6 units without the topbar;
// one unit is 1 % of the button height minus 2 × 1.5 % margin, divided by
// the font's line box ratio (1.117). On a 72 px button this gives
// s × 1.042 px. Usable width: 72 px minus 2 × 3 % margin = 67.7 px.
// The presets therefore set show_topbar: false (with the topbar Companion uses
// the factor 2.1 instead of 1/0.6, and then e.g. "Cardio" and "Sunset" wrap).

const SIZES = [24, 18, 14]
const MAX_WIDTH = 66 // 67.7 px minus safety margin
const PX_PER_SIZE = 1.042
const LINE_BOX = 1.117

// Arimo: advance width per character in 1/1000 em
const ADV_CHARS =
	" !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÄÖÜäöüß−–…°€"
const ADV_WIDTHS = [
	278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278,
	278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
	667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556,
	556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 667, 778, 722, 556, 556, 556, 611, 584, 556, 1000, 400, 556,
]
const ADV = new Map([...ADV_CHARS].map((c, i) => [c, ADV_WIDTHS[i]]))

/** Width in px on a 72 px button */
function textWidth(text, size) {
	let em = 0
	for (const c of String(text)) em += ADV.get(c) ?? 600
	return (em / 1000) * size * PX_PER_SIZE
}

/** Height of a text block with n lines in px */
function textHeight(lines, size) {
	return lines * size * PX_PER_SIZE * LINE_BOX
}

// Words; wrapping is allowed after a hyphen ("Cool-" / "down")
function tokens(text) {
	return String(text)
		.split(/\s+/)
		.filter(Boolean)
		.flatMap((w) => w.split(/(?<=-)(?=.)/).map((part, i, all) => ({ part, glue: i < all.length - 1 })))
}

const VOWEL = /[aeiouäöüyAEIOUÄÖÜY]/

/**
 * Emergency hyphenation of a word that is too wide: preferably before a syllable
 * (consonant + vowel, e.g. "Bright-ness", "Recep-tion"), as close to the middle as possible.
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

// Greedy line wrapping; null if a word part is too wide
// (with allowHyphen such a word is hyphenated instead)
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
 * @param {number} maxSize    largest allowed size (24 or 18)
 * @param {number} maxHeight  available height for the text in px
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

/** One line at the given size; cut with "…" if it is too wide (e.g. above a value) */
function shortLabel(text, size = 14) {
	const t = String(text ?? '').trim()
	if (textWidth(t, size) <= MAX_WIDTH) return t
	let cut = t
	while (cut.length > 1 && textWidth(cut.trimEnd() + '…', size) > MAX_WIDTH) cut = cut.slice(0, -1)
	return cut.trimEnd() + '…'
}

/** Text with explicit line breaks so Companion wraps exactly like this */
function labelText(text, maxSize = 24, maxHeight = 72) {
	const fit = fitLabel(text, maxSize, maxHeight)
	return { text: fit.lines.join('\n'), size: fit.size, lineCount: fit.lines.length }
}

module.exports = { fitLabel, labelText, shortLabel, textWidth, textHeight, SIZES, MAX_WIDTH }
