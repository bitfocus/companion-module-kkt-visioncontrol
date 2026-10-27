// Migration steps for existing connections. Companion runs each script
// exactly once per connection; always append new scripts at the end.

/**
 * Poll interval 2000 → 1000 ms: a large poll only takes about 35 ms,
 * so devices appear twice as fast. Only change it if the old default
 * value is still set.
 */
function pollIntervalTo1000(_context, props) {
	const result = { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }
	if (props.config && Number(props.config.poll) === 2000) {
		result.updatedConfig = { ...props.config, poll: 1000 }
	}
	return result
}

/**
 * Explicitly set the fast poll (fastPoll). Older connections do not know
 * the field; Companion then shows it as 0, and saving the settings would
 * have switched off the fast poll.
 */
function fastPollDefault(_context, props) {
	const result = { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }
	if (props.config && (props.config.fastPoll === undefined || props.config.fastPoll === null || props.config.fastPoll === '')) {
		result.updatedConfig = { ...props.config, fastPoll: 500 }
	}
	return result
}

/**
 * Group dropdown: actions and feedbacks used to take the GroupID in the text
 * field `id`. Copy it into the new `group` field (custom values and variables
 * stay valid); `id` remains the RDMID for fixtures.
 */
function groupDropdown(_context, props) {
	const result = { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }
	const migrate = (item, list) => {
		const o = item.options
		if (!o || o.target === undefined || o.group !== undefined) return
		o.group = String(o.id ?? '0')
		list.push(item)
	}
	for (const a of props.actions || []) migrate(a, result.updatedActions)
	for (const f of props.feedbacks || []) migrate(f, result.updatedFeedbacks)
	return result
}

module.exports = [pollIntervalTo1000, fastPollDefault, groupDropdown]
