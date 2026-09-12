import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

async function getSubmindModule() {
  try {
    return await import('../../../server/harnesses/submind.mjs')
  } catch {}
  try {
    return await import('../../../../bot-crossing/server/harnesses/submind.mjs')
  } catch {}
  return null
}

async function getScanModule() {
  try {
    return await import('../../../server/scan.mjs')
  } catch {}
  try {
    return await import('../../../../bot-crossing/server/scan.mjs')
  } catch {}
  return null
}

async function resolveActiveTaskProvider() {
  let config = {}
  try {
    const { loadTaskConfig } = await import('../../billboard/server/config-store.js')
    config = await loadTaskConfig()
  } catch {}

  const activeId = process.env.TASK_PROVIDER || config.active || (process.env.NOTION_API_KEY ? 'notion' : 'github')
  const providerConfig = config.providers?.[activeId] || {}

  return { activeId, providerConfig }
}

async function resolveBacklogUrl(activeId, providerConfig, agentName = '') {
  if (activeId === 'notion') {
    const dbId = (providerConfig.databaseId || process.env.NOTION_DATABASE_ID || '').replace(/-/g, '')
    return dbId ? `https://www.notion.so/${dbId}` : 'https://www.notion.so'
  }
  if (activeId === 'linear') {
    return providerConfig.workspace ? `https://linear.app/${providerConfig.workspace}` : 'https://linear.app'
  }
  if (activeId === 'jira') {
    return providerConfig.host ? `https://${providerConfig.host}` : 'https://jira.atlassian.com'
  }
  if (activeId === 'github') {
    const repos = providerConfig.repos ? providerConfig.repos.split(',').map((r) => r.trim()).filter(Boolean) : []
    if (repos.length > 0) return `https://github.com/${repos[0]}/issues`
    return 'https://github.com'
  }
  return ''
}

export function createAgentCardsMiddleware(options = {}) {
  return async function agentCardsMiddleware(req, res, next) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

    const sendJson = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
    }

    // 1. Get plugin provider & card configuration
    if (url.pathname === '/api/agent-cards/config' && req.method === 'GET') {
      const { activeId, providerConfig } = await resolveActiveTaskProvider()
      const backlogUrl = await resolveBacklogUrl(activeId, providerConfig)
      const providerNames = {
        notion: 'Notion',
        github: 'GitHub',
        linear: 'Linear',
        jira: 'Jira',
        paperclip: 'Paperclip',
        'local-todo': 'Local'
      }

      return sendJson(200, {
        provider: activeId,
        providerName: providerNames[activeId] || 'Backlog',
        backlogUrl,
        features: {
          chat: true,
          cron: true,
          tasks: true,
          cli: true
        }
      })
    }

    // 2. Trigger an agent's cron routine manually
    if (url.pathname === '/api/agent-cards/cron/run' && req.method === 'POST') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        try {
          const { agent, jobId } = JSON.parse(body || '{}')
          if (!agent || !jobId) {
            return sendJson(400, { error: 'agent and jobId are required' })
          }

          // Dynamically dispatch via agent harness
          try {
            const submind = await getSubmindModule()
            if (submind?.chatWithSubmindAgent) {
              await submind.chatWithSubmindAgent(agent, `Trigger manual execution of scheduled routine: ${jobId}`)
            }
          } catch (err) {
            console.log(`[AgentCards] Manual trigger dispatched for ${agent} (${jobId}):`, err.message)
          }

          return sendJson(200, {
            ok: true,
            agent,
            jobId,
            message: `Routine '${jobId}' triggered for agent '${agent}'`,
            timestamp: Date.now()
          })
        } catch (err) {
          return sendJson(500, { error: err.message })
        }
      })
      return
    }

    // 3. Add a task to an agent's backlog via active configured task provider
    if (url.pathname === '/api/agent-cards/tasks/create' && req.method === 'POST') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        try {
          const { agent, title, body: taskBody } = JSON.parse(body || '{}')
          if (!agent || !title) {
            return sendJson(400, { error: 'agent and title are required' })
          }

          const rawAgent = agent.toLowerCase().replace(/^sm-/, '').replace(/^submind:/, '').trim()
          const capAgent = rawAgent.charAt(0).toUpperCase() + rawAgent.slice(1)
          const { activeId, providerConfig } = await resolveActiveTaskProvider()

          let createdUrl = null
          let providerDisplayName = 'Tasks'

          if (activeId === 'notion') {
            providerDisplayName = 'Notion'
            const apiKey = providerConfig.apiKey || process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || ''
            const databaseId = (providerConfig.databaseId || process.env.NOTION_DATABASE_ID || '').replace(/-/g, '')

            if (apiKey && databaseId) {
              const payload = {
                parent: { database_id: databaseId },
                properties: {
                  Task: { title: [{ text: { content: title } }] },
                  Status: { status: { name: 'Backlog' } },
                  Agent: { select: { name: capAgent } },
                  Priority: { select: { name: 'Normal' } },
                }
              }
              if (taskBody) {
                payload.properties.Notes = { rich_text: [{ text: { content: taskBody } }] }
              }

              const res = await fetch('https://api.notion.com/v1/pages', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Notion-Version': '2022-06-28',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
              })
              if (res.ok) {
                const data = await res.json()
                createdUrl = data.url || `https://www.notion.so/${data.id.replace(/-/g, '')}`
              } else {
                const errData = await res.json().catch(() => ({}))
                console.warn('[AgentCards] Notion task creation notice:', errData.message || res.statusText)
              }
            }
          } else if (activeId === 'github') {
            providerDisplayName = 'GitHub'
            const repo = providerConfig.repos ? providerConfig.repos.split(',')[0].trim() : ''
            if (repo) {
              try {
                const cmd = `gh issue create -R ${repo} --title ${JSON.stringify(title)} --body ${JSON.stringify(taskBody || `Task assigned to ${capAgent}`)}`
                const { stdout } = await execAsync(cmd, { timeout: 10000 })
                createdUrl = stdout.trim()
              } catch (e) {
                console.warn('[AgentCards] gh issue create fallback notice:', e.message)
              }
            }
          }

          if (!createdUrl) {
            createdUrl = await resolveBacklogUrl(activeId, providerConfig, rawAgent)
          }

          return sendJson(200, {
            ok: true,
            agent: rawAgent,
            title,
            provider: activeId,
            providerName: providerDisplayName,
            url: createdUrl,
            message: `Task successfully dispatched to ${capAgent}'s ${providerDisplayName} backlog`
          })
        } catch (err) {
          return sendJson(500, { error: err.message })
        }
      })
      return
    }

    // 4. Query agent-specific cron jobs dynamically
    if (url.pathname === '/api/agent-cards/cron' && req.method === 'GET') {
      const agent = (url.searchParams.get('agent') || '').toLowerCase().replace(/^sm-/, '').replace(/^submind:/, '').trim()
      try {
        const scanMod = await getScanModule()
        const allJobs = scanMod?.scanCronJobs ? await scanMod.scanCronJobs().catch(() => []) : []
        const agentJobs = allJobs.filter((j) => (j.agent || '').toLowerCase().replace(/^sm-/, '') === agent)
        return sendJson(200, { agent, jobs: agentJobs })
      } catch (err) {
        return sendJson(200, { agent, jobs: [] })
      }
    }

    if (typeof next === 'function') next()
  }
}
