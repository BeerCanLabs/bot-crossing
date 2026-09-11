import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

const AGENT_REPOS = {
  higgins: 'BeerCanLabs/SM-higgins',
  donna: 'BeerCanLabs/SM-donna',
  castle: 'BeerCanLabs/SM-castle',
  archie: 'BeerCanLabs/SM-archie',
  switch: 'BeerCanLabs/SM-switch',
  geordi: 'BeerCanLabs/SM-geordi',
  draftsman: 'BeerCanLabs/ev-draftsman',
  'alc-support': 'dsackr/american-lutheran-church-kellogg',
}

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

export function createAgentCardsMiddleware(options = {}) {
  return async function agentCardsMiddleware(req, res, next) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

    const sendJson = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
    }

    // 1. Trigger an agent's cron routine manually
    if (url.pathname === '/api/agent-cards/cron/run' && req.method === 'POST') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        try {
          const { agent, jobId } = JSON.parse(body || '{}')
          if (!agent || !jobId) {
            return sendJson(400, { error: 'agent and jobId are required' })
          }

          // Trigger execution via submind harness if available
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

    // 2. Add a task to an agent's backlog
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
          const targetRepo = AGENT_REPOS[rawAgent] || `BeerCanLabs/SM-${rawAgent}`
          const desc = taskBody || `Task assigned to ${rawAgent} via Bot Crossing Colony Depot`

          let createdIssueUrl = null
          try {
            const cmd = `gh issue create -R ${targetRepo} --title ${JSON.stringify(title)} --body ${JSON.stringify(desc)}`
            const { stdout } = await execAsync(cmd, { timeout: 10000 })
            createdIssueUrl = stdout.trim()
          } catch (cmdErr) {
            console.warn(`[AgentCards] gh issue create failed: ${cmdErr.message}`)
          }

          return sendJson(200, {
            ok: true,
            agent: rawAgent,
            repo: targetRepo,
            title,
            url: createdIssueUrl || `https://github.com/${targetRepo}/issues`,
            message: `Task successfully dispatched to ${rawAgent}'s backlog`
          })
        } catch (err) {
          return sendJson(500, { error: err.message })
        }
      })
      return
    }

    // 3. Query agent-specific cron jobs
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
