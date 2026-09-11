import { resolveAuthUser } from './authn.js'
import { RbacStore } from './store.js'

const BUILTIN_SUBMIND_AGENTS = [
  { id: 'higgins', name: 'Higgins', title: 'Higgins — Estate & Executive Manager', role: 'Closing Climb real estate pipeline, property ops & closing board', domain: 'Real Estate' },
  { id: 'donna', name: 'Donna', title: 'Donna — Personal Assistant', role: 'Personal & business life operations, calendar management & executive coordination', domain: 'Executive Suite' },
  { id: 'castle', name: 'Castle', title: 'Castle — Content Author & Voice', role: 'Thought leadership, Dale voice profile, blog authoring & reflections', domain: 'Content Creation' },
  { id: 'archie', name: 'Archie', title: 'Archie — Head of Engineering', role: 'Agent Factory architecture, platform IaC & backlog coordination', domain: 'Agent Factory' },
  { id: 'draftsman', name: 'Draftsman', title: 'Draftsman — System Architect', role: 'Agent blueprints, architectural standards & catalog metadata', domain: 'Agent Factory' },
  { id: 'switch', name: 'Switch', title: 'Switch — Autonomous Software Engineer', role: 'Autonomous software engineering, lab apps, games & experiments', domain: 'Engineering' },
  { id: 'geordi', name: 'Geordi', title: 'Geordi — Infrastructure & SRE', role: 'GCP Cloud Run platform, networking, Litestream replication & reliability', domain: 'Infrastructure' },
  { id: 'alc-support', name: 'ALC Support', title: 'ALC Support — Church Webmaster', role: 'Website updates, liturgical accuracy & issue resolution', domain: 'Web Clients' },
  { id: 'mcp-gateway', name: 'Submind MCP Gateway', title: 'Submind MCP Gateway', role: 'Model Context Protocol federation and tool dispatch gateway', domain: 'Agent Factory' },
]

export function createRbacMiddleware(options = {}) {
  const store = new RbacStore(options.dataDir)

  return async function rbacMiddleware(req, res, next) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const user = resolveAuthUser(req)
    const userMeta = store.getUser(user.email)

    req.auth = {
      user,
      role: userMeta.role,
      allowedAgents: userMeta.allowedAgents || [],
      isAdmin: userMeta.role === 'admin'
    }

    const sendJson = (status, payload) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(payload))
    }

    // 1. RBAC Discovery & Auth Detection API
    if (url.pathname === '/api/rbac/detect-auth' && req.method === 'GET') {
      return sendJson(200, {
        authenticated: Boolean(user.authenticated),
        provider: user.provider,
        email: user.email,
        name: user.name,
        role: req.auth.role,
        isAdmin: req.auth.isAdmin,
        isBarred: Boolean(userMeta.barred),
        requiresSetup: !user.authenticated
      })
    }

    if (url.pathname === '/api/rbac/me' && req.method === 'GET') {
      return sendJson(200, {
        user,
        role: req.auth.role,
        allowedAgents: req.auth.allowedAgents,
        isAdmin: req.auth.isAdmin,
        barred: Boolean(userMeta.barred)
      })
    }

    // 2. Dynamic Agents Discovery API (harvests Submind fleet + all dynamic thread agents)
    if (url.pathname === '/api/rbac/agents' && req.method === 'GET') {
      const agentsMap = new Map()
      for (const a of BUILTIN_SUBMIND_AGENTS) {
        agentsMap.set(a.id, a)
      }

      if (typeof options.getAgents === 'function') {
        try {
          const dynamicThreads = await options.getAgents()
          if (Array.isArray(dynamicThreads)) {
            for (const t of dynamicThreads) {
              const rawId = t.ref?.agent || t.id.replace(/^submind:/, '').replace(/^grok:/, '').replace(/^claude-code:/, '').replace(/^codex:/, '')
              const agentId = String(rawId || '').toLowerCase().replace(/^sm-/, '').trim()
              if (agentId && !agentsMap.has(agentId)) {
                agentsMap.set(agentId, {
                  id: agentId,
                  name: t.title?.split('—')[0]?.trim() || agentId,
                  title: t.title || agentId,
                  role: t.preview || t.project || 'Autonomous Agent',
                  domain: t.domain || 'Engineering'
                })
              }
            }
          }
        } catch (err) {
          console.warn('[RBAC] Could not resolve dynamic agents:', err.message)
        }
      }

      const agentsList = Array.from(agentsMap.values())
      return sendJson(200, { agents: agentsList })
    }

    // 3. Claim Root Admin Endpoint
    if (url.pathname === '/api/rbac/claim-admin' && req.method === 'POST') {
      if (!user.authenticated || !user.email) {
        return sendJson(401, { error: 'Authentication required before claiming administrator role.' })
      }
      try {
        const updated = store.setUser(user.email, 'admin', ['*'])
        return sendJson(200, { ok: true, user: updated })
      } catch (err) {
        return sendJson(400, { error: err.message })
      }
    }

    // 4. User Directory Management API (Admin only)
    if (url.pathname === '/api/rbac/users') {
      if (req.auth.role !== 'admin') {
        return sendJson(403, { error: 'Admin privileges required to manage roles.' })
      }

      if (req.method === 'GET') {
        return sendJson(200, store.getAllUsers())
      }

      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            const data = JSON.parse(body)
            if (!data.email || !data.role) {
              return sendJson(400, { error: 'Email and role are required.' })
            }
            const updated = store.setUser(data.email, data.role, data.allowedAgents)
            return sendJson(200, { success: true, user: updated })
          } catch (err) {
            return sendJson(400, { error: err.message })
          }
        })
        return
      }

      if (req.method === 'DELETE') {
        const email = url.searchParams.get('email')
        if (!email) {
          return sendJson(400, { error: 'Email parameter required.' })
        }
        try {
          const success = store.deleteUser(email)
          return sendJson(200, { success })
        } catch (err) {
          return sendJson(400, { error: err.message })
        }
      }
    }

    // 5. Strict Guard on Plugin Management (Toggle / Install / Uninstall)
    // Non-admins (spectators, agent managers, unauthorized) CANNOT toggle or disable RBAC or plugins!
    if (url.pathname.startsWith('/api/plugins/')) {
      if (req.auth.role !== 'admin') {
        return sendJson(403, { error: 'Admin privileges required to configure or toggle plugins.' })
      }
    }

    // 6. Strict Guard for Unauthorized Users:
    // If not authenticated or not invited, lock down all colony core data APIs!
    if (req.auth.role === 'unauthorized') {
      if (
        url.pathname.startsWith('/api/threads') ||
        url.pathname.startsWith('/api/tasks') ||
        url.pathname.startsWith('/api/chat') ||
        url.pathname.startsWith('/api/plugins') ||
        url.pathname.startsWith('/api/open') ||
        url.pathname.startsWith('/api/reveal')
      ) {
        return sendJson(403, {
          error: 'Access Denied: You are not authorized to access this colony.',
          role: 'unauthorized',
          email: user.email
        })
      }
    }

    // 7. Intercept & Guard Colony Chat Endpoints
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      if (req.auth.role === 'spectator') {
        return sendJson(403, {
          error: 'Spectator role is read-only. Chatting with agents is restricted.'
        })
      }

      // Read chat body to verify agent permission
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        try {
          const payload = JSON.parse(body)
          const targetAgent = (payload.to || payload.agent || '').toLowerCase()
          const normTarget = targetAgent.replace(/^sm-/, '').replace(/^submind:/, '').trim()

          if (req.auth.role === 'agent_manager') {
            const isAllowed = req.auth.allowedAgents.includes('*') || req.auth.allowedAgents.some((ag) => {
              const normAg = (ag || '').toLowerCase().replace(/^sm-/, '').replace(/^submind:/, '').trim()
              return normAg === normTarget
            })
            if (!isAllowed) {
              return sendJson(403, {
                error: `Access Denied: You are not assigned to manage agent '${targetAgent}'.`
              })
            }
          }

          // Scope session per user so multi-user chats don't overwrite each other
          if (payload.sessionId) {
            payload.sessionId = `colony:${user.email}:${targetAgent}`
          }

          // Re-inject parsed body for downstream handler
          req.body = payload
          if (typeof next === 'function') next()
        } catch (err) {
          return sendJson(400, { error: 'Invalid chat JSON' })
        }
      })
      return
    }

    if ((url.pathname === '/api/open' || url.pathname === '/api/reveal') && req.method === 'POST') {
      if (req.auth.role !== 'admin') {
        return sendJson(403, { error: 'Admin privileges required to open or reveal host files.' })
      }
    }

    // Pass through
    if (typeof next === 'function') {
      next()
    }
  }
}
