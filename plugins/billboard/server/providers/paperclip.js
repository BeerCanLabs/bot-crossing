/**
 * Paperclip task provider for Bot Crossing Task Board.
 */
export default {
  id: 'paperclip',
  name: 'Paperclip',
  description: 'Sync company goals, agent tasks, and governance tickets from Paperclip.',
  fields: [
    {
      key: 'url',
      label: 'Paperclip Server URL',
      type: 'text',
      placeholder: 'http://localhost:3100 (default)',
      required: false,
    },
    {
      key: 'apiKey',
      label: 'API Key (if authentication is enabled)',
      type: 'password',
      placeholder: 'Bearer token (optional)',
      required: false,
    },
  ],

  async test(config) {
    const host = (config.url || 'http://localhost:3100').replace(/\/+$/, '')
    try {
      const res = await fetch(`${host}/api/health`, {
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      })
      if (res.ok) return { ok: true }
      return { ok: false, error: `Paperclip returned status ${res.status}` }
    } catch (err) {
      return { ok: false, error: `Cannot reach Paperclip at ${host}: ${err.message}` }
    }
  },

  async fetchTasks(config = {}) {
    const host = (config.url || 'http://localhost:3100').replace(/\/+$/, '')
    const headers = config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}

    try {
      const res = await fetch(`${host}/api/tasks?status=active,pending`, { headers })
      if (!res.ok) return []
      const data = await res.json()
      const tasks = Array.isArray(data) ? data : data.tasks || []

      return tasks.map((t) => ({
        id: `paperclip:${t.id}`,
        title: t.title || t.name || 'Untitled Paperclip Task',
        preview: t.description || t.summary || '',
        project: t.companyName || t.project || 'Paperclip',
        assignee: t.agentName || t.assignee || 'Unassigned',
        status: t.status === 'running' || t.status === 'in_progress' ? 'in_progress' : 'pending',
        priority: t.priority || 'normal',
        url: `${host}/tasks/${t.id}`,
        source: 'paperclip',
        sourceName: 'Paperclip',
        updatedAt: Date.parse(t.updatedAt) || Date.now(),
      }))
    } catch {
      return []
    }
  },
}
