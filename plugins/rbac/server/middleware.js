import { resolveAuthUser } from './authn.js'
import { RbacStore } from './store.js'

export function createRbacMiddleware(options = {}) {
  const store = new RbacStore(options.dataDir)

  return async function rbacMiddleware(req, res, next) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const user = resolveAuthUser(req)
    const userMeta = store.getUser(user.email)
    
    req.auth = {
      user,
      role: userMeta.role,
      allowedAgents: userMeta.allowedAgents || []
    }

    const sendJson = (status, payload) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(payload))
    }

    // 1. RBAC API Endpoints
    if (url.pathname === '/api/rbac/me' && req.method === 'GET') {
      return sendJson(200, {
        user,
        role: req.auth.role,
        allowedAgents: req.auth.allowedAgents,
        isAdmin: req.auth.role === 'admin'
      })
    }

    if (url.pathname === '/api/rbac/users') {
      // Must be admin to list or mutate users
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
            return sendJson(400, { error: 'Invalid JSON payload' })
          }
        })
        return
      }

      if (req.method === 'DELETE') {
        const email = url.searchParams.get('email')
        if (!email) {
          return sendJson(400, { error: 'Email parameter required.' })
        }
        const success = store.deleteUser(email)
        return sendJson(200, { success })
      }
    }

    // 2. Intercept & Guard Colony Core Endpoints
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
          const targetAgent = payload.to || payload.agent

          if (req.auth.role === 'agent_manager') {
            const isAllowed = req.auth.allowedAgents.includes('*') || req.auth.allowedAgents.includes(targetAgent)
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

          // Re-inject the parsed body for downstream handler
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
