/**
 * Jira Software task provider for Bot Crossing Task Board.
 */
export default {
  id: 'jira',
  name: 'Jira Software',
  description: 'Sync active sprint issues and backlog cards from Jira Cloud.',
  fields: [
    {
      key: 'host',
      label: 'Jira Host URL',
      type: 'text',
      placeholder: 'https://yourcompany.atlassian.net',
      required: true,
    },
    {
      key: 'email',
      label: 'Atlassian Account Email',
      type: 'text',
      placeholder: 'user@company.com',
      required: true,
    },
    {
      key: 'apiToken',
      label: 'API Token',
      type: 'password',
      placeholder: 'Atlassian API token',
      required: true,
    },
    {
      key: 'jql',
      label: 'JQL Query (optional)',
      type: 'text',
      placeholder: 'statusCategory != Done ORDER BY priority DESC',
      required: false,
    },
  ],

  async test(config) {
    if (!config.host || !config.email || !config.apiToken) {
      return { ok: false, error: 'Host, Email, and API Token are required' }
    }
    const host = config.host.replace(/\/+$/, '')
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
    try {
      const res = await fetch(`${host}/rest/api/3/myself`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      })
      if (res.ok) {
        const user = await res.json()
        return { ok: true, user: user.displayName }
      }
      return { ok: false, error: `Jira returned ${res.status}: ${res.statusText}` }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  async fetchTasks(config = {}) {
    if (!config.host || !config.email || !config.apiToken) return []
    const host = config.host.replace(/\/+$/, '')
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
    const jql = config.jql || 'statusCategory != Done ORDER BY priority DESC, updated DESC'

    try {
      const res = await fetch(`${host}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=40`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      })
      if (!res.ok) return []
      const data = await res.json()
      const issues = data.issues || []

      return issues.map((issue) => {
        const fields = issue.fields || {}
        const statusCat = fields.status?.statusCategory?.key || ''
        let status = 'pending'
        if (statusCat === 'indeterminate') status = 'in_progress'
        else if (statusCat === 'done') status = 'done'

        return {
          id: `jira:${issue.key}`,
          title: `${issue.key}: ${fields.summary || 'Untitled Issue'}`,
          preview: fields.status?.name ? `Status: ${fields.status.name}` : '',
          project: fields.project?.name || issue.key.split('-')[0],
          assignee: fields.assignee?.displayName || 'Unassigned',
          status,
          priority: (fields.priority?.name || 'normal').toLowerCase(),
          url: `${host}/browse/${issue.key}`,
          source: 'jira',
          sourceName: 'Jira',
          updatedAt: Date.parse(fields.updated) || Date.now(),
        }
      })
    } catch {
      return []
    }
  },
}
