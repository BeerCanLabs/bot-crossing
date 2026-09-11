/**
 * Notion Database task provider for Bot Crossing Task Board.
 * Supports zero-paste auto-discovery via Notion /v1/search API.
 */

/**
 * Searches for all databases shared with the integration token.
 */
export async function discoverDatabases(apiKey) {
  if (!apiKey) return []
  try {
    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { value: 'database', property: 'object' },
        page_size: 50,
      }),
    })

    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []).map((db) => {
      const title = db.title?.map((t) => t.plain_text).join('') || 'Untitled Database'
      return {
        id: db.id,
        title,
        url: db.url,
        properties: Object.keys(db.properties || {}),
        lastEditedTime: db.last_edited_time,
      }
    })
  } catch {
    return []
  }
}

export default {
  id: 'notion',
  name: 'Notion',
  description: 'Sync tasks and project tickets directly from a Notion Database with auto-discovery.',
  fields: [
    {
      key: 'apiKey',
      label: 'Notion API Token',
      type: 'password',
      placeholder: 'ntn_... (or leave blank if NOTION_API_KEY is in environment)',
      required: false,
    },
    {
      key: 'databaseId',
      label: 'Database',
      type: 'text',
      placeholder: 'Leave blank to auto-discover databases from Notion',
      required: false,
    },
    {
      key: 'statusProperty',
      label: 'Status Property Name',
      type: 'text',
      placeholder: 'Status (auto-detected if blank)',
      required: false,
    },
    {
      key: 'assigneeProperty',
      label: 'Assignee Property Name',
      type: 'text',
      placeholder: 'Assignee, Owner, or Agent (auto-detected if blank)',
      required: false,
    },
  ],

  async test(config = {}) {
    const apiKey = config.apiKey || process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || ''
    if (!apiKey) {
      return { ok: false, error: 'Notion API Token is required (or set NOTION_API_KEY in environment)' }
    }

    let databaseId = config.databaseId || process.env.NOTION_DATABASE_ID || ''
    let databases = []

    // If database ID is omitted, auto-discover all accessible databases
    if (!databaseId) {
      databases = await discoverDatabases(apiKey)
      if (databases.length === 0) {
        return {
          ok: false,
          error: 'Connected to Notion, but no databases are shared with this integration. Share a database or page with your integration in Notion.',
        }
      }
      databaseId = databases[0].id
      return {
        ok: true,
        name: databases[0].title,
        databaseId: databases[0].id,
        databases,
        autoDiscovered: true,
        message: `Discovered "${databases[0].title}" (${databases.length} database${databases.length > 1 ? 's' : ''} available)`,
      }
    }

    const cleanId = databaseId.replace(/-/g, '')
    try {
      const res = await fetch(`https://api.notion.com/v1/databases/${cleanId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
        },
      })
      if (res.ok) {
        const data = await res.json()
        const title = data.title?.map((t) => t.plain_text).join('') || 'Untitled Database'
        return { ok: true, name: title, databaseId: data.id }
      }
      return { ok: false, error: `Notion returned ${res.status}: ${res.statusText}` }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  async discover(config = {}) {
    const apiKey = config.apiKey || process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || ''
    return discoverDatabases(apiKey)
  },

  async fetchTasks(config = {}) {
    const apiKey = config.apiKey || process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || ''
    if (!apiKey) return []

    let databaseId = config.databaseId || process.env.NOTION_DATABASE_ID || ''
    let statusProp = config.statusProperty || ''
    let assigneeProp = config.assigneeProperty || ''

    // Auto-discover database if missing
    if (!databaseId) {
      const databases = await discoverDatabases(apiKey)
      if (databases.length === 0) return []
      // Prioritize database matching task/ops/board keywords
      const preferred = databases.find((d) => /task|ops|board|submind|project/i.test(d.title)) || databases[0]
      databaseId = preferred.id

      // Auto-detect property names from schema
      if (!statusProp) {
        statusProp = preferred.properties.find((p) => /status|state/i.test(p)) || 'Status'
      }
      if (!assigneeProp) {
        assigneeProp = preferred.properties.find((p) => /agent|assignee|owner/i.test(p)) || 'Assignee'
      }
    } else {
      if (!statusProp) statusProp = 'Status'
      if (!assigneeProp) assigneeProp = 'Assignee'
    }

    const cleanId = databaseId.replace(/-/g, '')

    try {
      const res = await fetch(`https://api.notion.com/v1/databases/${cleanId}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 50 }),
      })

      if (!res.ok) return []
      const data = await res.json()
      const pages = data.results || []

      return pages.map((page) => {
        // Extract title
        let title = 'Untitled Task'
        for (const val of Object.values(page.properties || {})) {
          if (val.type === 'title' && val.title?.[0]?.plain_text) {
            title = val.title.map((t) => t.plain_text).join('')
            break
          }
        }

        // Extract status
        const statusVal = page.properties?.[statusProp]
        let statusName = statusVal?.status?.name || statusVal?.select?.name || 'Pending'
        let status = 'pending'
        const lowerStatus = statusName.toLowerCase()
        if (lowerStatus.includes('progress') || lowerStatus.includes('doing') || lowerStatus.includes('working')) {
          status = 'in_progress'
        } else if (lowerStatus.includes('done') || lowerStatus.includes('completed')) {
          status = 'done'
        } else if (lowerStatus.includes('block')) {
          status = 'blocked'
        }

        // Extract assignee (checks people, select, or rich_text)
        const assigneeVal = page.properties?.[assigneeProp]
        let assignee = 'Unassigned'
        if (assigneeVal?.people?.[0]?.name) {
          assignee = assigneeVal.people.map((p) => p.name).join(', ')
        } else if (assigneeVal?.select?.name) {
          assignee = assigneeVal.select.name
        } else if (assigneeVal?.rich_text?.[0]?.plain_text) {
          assignee = assigneeVal.rich_text.map((t) => t.plain_text).join('')
        }

        return {
          id: `notion:${page.id}`,
          title,
          preview: `Notion task (${statusName})`,
          project: 'Notion',
          assignee,
          status,
          priority: 'normal',
          url: page.url,
          source: 'notion',
          sourceName: 'Notion',
          updatedAt: Date.parse(page.last_edited_time) || Date.now(),
        }
      })
    } catch {
      return []
    }
  },
}
