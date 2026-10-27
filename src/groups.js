// Groups from GET /Network/Info: { Groups: [{ Id, Name, ControlComponents }], Fixtures: [...] }
// Every action and feedback picks its target here: a group from the app (dropdown)
// or a single fixture by RDMID.

const TARGETS = [
	{ id: 'group', label: 'Group' },
	{ id: 'fixture', label: 'Fixture (RDMID)' },
]

/** Group name as text. The app stores names as zero-padded bytes; accept both forms. */
function decodeName(name) {
	if (typeof name === 'string') return name.replace(/\0+$/, '').trim()
	if (name && typeof name.Data === 'string') {
		return Buffer.from(name.Data, 'base64').toString('utf8').replace(/\0+$/, '').trim()
	}
	return ''
}

/** Normalized group list [{ id, name }] sorted by ID; empty entries are dropped */
function normalizeGroups(list) {
	if (!Array.isArray(list)) return []
	const out = []
	for (const g of list) {
		if (!g || typeof g !== 'object') continue
		const id = Number(g.Id ?? g.GroupID ?? g.GroupIndex)
		if (!Number.isInteger(id)) continue
		out.push({ id, name: decodeName(g.Name) || `Group ${id}` })
	}
	return out.sort((a, b) => a.id - b.id)
}

/** Choice list for dropdowns; group 0 is always offered so new buttons have a valid default */
function groupChoices(groups) {
	const list = Array.isArray(groups) ? groups : []
	const choices = list.map((g) => ({ id: String(g.id), label: `${g.name} (${g.id})` }))
	if (!list.some((g) => g.id === 0)) choices.unshift({ id: '0', label: 'Group 0' })
	return choices
}

/** Short comparison key: changes with new, deleted or renamed groups */
function groupsSignature(groups) {
	return (groups || []).map((g) => `${g.id}:${g.name}`).join('|')
}

/**
 * The three target fields shared by actions and feedbacks: target type,
 * group dropdown (shown for groups) and RDMID (shown for fixtures).
 * The dropdown also takes a custom ID or a variable, e.g. $(local:group).
 */
function targetOptions(groups) {
	return [
		{ id: 'target', type: 'dropdown', label: 'Target', default: 'group', choices: TARGETS },
		{
			id: 'group',
			type: 'dropdown',
			label: 'Group',
			default: '0',
			choices: groupChoices(groups),
			allowCustom: true,
			tooltip:
				'Groups from the Vision Control app. A custom GroupID or variable is also possible, including local ones, e.g. $(local:group).',
			isVisibleExpression: `$(options:target) != 'fixture'`,
			isVisible: (options) => options.target !== 'fixture',
		},
		{
			id: 'id',
			type: 'textinput',
			label: 'RDMID',
			default: '0',
			useVariables: { local: true },
			isVisibleExpression: `$(options:target) == 'fixture'`,
			isVisible: (options) => options.target === 'fixture',
		},
	]
}

/**
 * Resolves target and ID from the options. Buttons from before the group
 * dropdown only have `id`; it then also serves as GroupID.
 * @returns {Promise<{ target: 'group'|'fixture', id: number }>} id is NaN if not a number
 */
async function resolveTarget(options, parse) {
	const target = options.target === 'fixture' ? 'fixture' : 'group'
	const raw = target === 'fixture' ? options.id : (options.group ?? options.id)
	const text = String(await parse(String(raw ?? ''))).trim()
	return { target, id: text === '' ? NaN : Number(text) }
}

module.exports = { TARGETS, decodeName, normalizeGroups, groupChoices, groupsSignature, targetOptions, resolveTarget }
