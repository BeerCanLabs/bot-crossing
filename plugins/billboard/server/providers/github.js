/**
 * GitHub Issues & Projects task provider for Bot Crossing Task Board.
 */
export default {
  id: 'github',
  name: 'GitHub Issues',
  description: 'Track open issues and pull requests across your GitHub repositories.',
  fields: [
    {
      key: 'token',
      label: 'GitHub Personal Access Token (PAT)',
      type: 'password',
      placeholder: 'ghp_... or leave blank to use gh CLI / GITHUB_TOKEN',
      required: false,
    },
    {
      key: 'repos',
      label: 'Repositories (comma-separated)',
      type: 'text',
      placeholder: 'owner/repo1, owner/repo2 (leave blank to track colony repos)',
      required: false,
    },
    {
      key: 'labels',
      label: 'Filter by Labels (comma-separated)',
      type: 'text',
      placeholder: 'e.g. bug, agent, in-flight (optional)',
      required: false,
    },
  ],

  async test(config) {
    const token = config.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          'User-Agent': 'BotCrossing-TaskBoard',
          Accept: 'application/vnd.github.v3+json',
          ...(token ? { Authorization: `token ${token}` } : {}),
        },
      })
      if (res.ok) {
        const user = await res.json()
        return { ok: true, user: user.login }
      }
      return { ok: false, error: `GitHub API returned ${res.status}: ${res.statusText}` }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  async fetchTasks(config = {}, context = {}) {
    const token = config.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
    let repos = []
    if (config.repos && typeof config.repos === 'string') {
      repos = config.repos.split(',').map((r) => r.trim()).filter(Boolean)
    } else if (Array.isArray(context.repos) && context.repos.length > 0) {
      repos = context.repos
    }

    if (repos.length === 0) return []

    const tasks = []
    const headers = {
      'User-Agent': 'BotCrossing-TaskBoard',
      Accept: 'application/vnd.github.v3+json',
      ...(token ? { Authorization: `token ${token}` } : {}),
    }

    for (const repo of repos) {
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=30`, { headers })
        if (!res.ok) continue
        const issues = await res.json()
        if (!Array.isArray(issues)) continue

        for (const issue of issues) {
          if (issue.pull_request) continue // Skip PRs by default

          const assignees = (issue.assignees || []).map((a) => a.login).join(', ')
          const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name)).join(', ')
          const isWorking = labels.toLowerCase().includes('in-progress') || labels.toLowerCase().includes('working')

          tasks.push({
            id: `github:${repo}#${issue.number}`,
            title: `#${issue.number} ${issue.title}`,
            preview: (issue.body || '').slice(0, 200).replace(/[\r\n]+/g, ' '),
            project: repo.split('/')[1] || repo,
            assignee: assignees || (issue.assignee ? issue.assignee.login : 'Unassigned'),
            status: isWorking ? 'in_progress' : 'pending',
            priority: labels.toLowerCase().includes('urgent') || labels.toLowerCase().includes('critical') ? 'urgent' : 'normal',
            url: issue.html_url,
            source: 'github',
            sourceName: 'GitHub',
            updatedAt: Date.parse(issue.updated_at) || Date.now(),
          })
        }
      } catch {
        // Continue gracefully
      }
    }

    return tasks
  },
}
