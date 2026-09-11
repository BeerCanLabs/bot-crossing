/**
 * Linear task provider for Bot Crossing Task Board.
 */
export default {
  id: 'linear',
  name: 'Linear',
  description: 'Sync active cycle issues and team projects from Linear.',
  fields: [
    {
      key: 'apiKey',
      label: 'Linear Personal API Key',
      type: 'password',
      placeholder: 'lin_api_...',
      required: true,
    },
    {
      key: 'teamKey',
      label: 'Team Key (optional filter)',
      type: 'text',
      placeholder: 'e.g. ENG, DESIGN (optional)',
      required: false,
    },
  ],

  async test(config) {
    if (!config.apiKey) return { ok: false, error: 'Linear API Key is required' }
    try {
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          Authorization: config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: '{ viewer { id name email } }' }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.data?.viewer) return { ok: true, user: data.data.viewer.name }
      }
      return { ok: false, error: 'Failed to authenticate with Linear' }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  async fetchTasks(config = {}) {
    if (!config.apiKey) return []
    const query = `
      query {
        issues(filter: { state: { type: { nin: ["completed", "canceled"] } } }, first: 40) {
          nodes {
            id
            identifier
            title
            description
            url
            updatedAt
            state { name type }
            assignee { name }
            team { key name }
          }
        }
      }
    `
    try {
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          Authorization: config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) return []
      const json = await res.json()
      const nodes = json.data?.issues?.nodes || []

      return nodes.map((issue) => {
        let status = 'pending'
        if (issue.state?.type === 'started') status = 'in_progress'
        else if (issue.state?.type === 'blocked') status = 'blocked'

        return {
          id: `linear:${issue.id}`,
          title: `${issue.identifier}: ${issue.title}`,
          preview: (issue.description || '').slice(0, 160).replace(/[\r\n]+/g, ' '),
          project: issue.team?.key || 'Linear',
          assignee: issue.assignee?.name || 'Unassigned',
          status,
          priority: 'normal',
          url: issue.url,
          source: 'linear',
          sourceName: 'Linear',
          updatedAt: Date.parse(issue.updatedAt) || Date.now(),
        }
      })
    } catch {
      return []
    }
  },
}
