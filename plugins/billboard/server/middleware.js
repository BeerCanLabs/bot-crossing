import { PROVIDERS, getProvider } from './providers/index.js'
import { loadTaskConfig, saveTaskConfig } from './config-store.js'

function sendJson(res, status, data) {
  const payload = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

export function createTaskBoardMiddleware() {
  return async function taskBoardMiddleware(req, res, next) {
    const url = new URL(req.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/taskboard')) {
      return next ? next() : sendJson(res, 404, { error: 'Not found' })
    }

    try {
      // GET /api/taskboard/config - Returns registered providers and active config
      if (url.pathname === '/api/taskboard/config' && req.method === 'GET') {
        const config = await loadTaskConfig()
        const providers = PROVIDERS.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          fields: p.fields,
        }))
        return sendJson(res, 200, { config, providers })
      }

      // POST /api/taskboard/config - Saves user configuration
      if (url.pathname === '/api/taskboard/config' && req.method === 'POST') {
        const body = await readBody(req)
        await saveTaskConfig(body)
        return sendJson(res, 200, { ok: true })
      }

      // POST /api/taskboard/test - Tests connection for a specific provider
      if (url.pathname === '/api/taskboard/test' && req.method === 'POST') {
        const { providerId, config } = await readBody(req)
        const provider = getProvider(providerId)
        if (!provider) return sendJson(res, 400, { ok: false, error: `Unknown provider: ${providerId}` })
        const result = await provider.test(config || {})
        return sendJson(res, result.ok ? 200 : 400, result)
      }

      // GET /api/taskboard/databases - Auto-discovers databases for a provider (e.g. Notion)
      if (url.pathname === '/api/taskboard/databases' && req.method === 'GET') {
        const providerId = url.searchParams.get('providerId') || 'notion'
        const provider = getProvider(providerId)
        if (!provider || typeof provider.discover !== 'function') {
          return sendJson(res, 400, { ok: false, error: `Provider ${providerId} does not support discovery` })
        }
        const config = await loadTaskConfig()
        const providerConfig = config.providers?.[providerId] || {}
        const databases = await provider.discover(providerConfig)
        return sendJson(res, 200, { ok: true, databases })
      }

      // GET /api/taskboard/oauth/notion/connect - Initiates 1-click OAuth flow
      if (url.pathname === '/api/taskboard/oauth/notion/connect' && req.method === 'GET') {
        const clientId = process.env.NOTION_CLIENT_ID
        if (!clientId) {
          return sendJson(res, 400, {
            ok: false,
            error: '1-Click OAuth requires NOTION_CLIENT_ID and NOTION_CLIENT_SECRET in server environment.',
            oauthConfigured: false,
          })
        }
        const proto = req.headers['x-forwarded-proto'] || 'http'
        const host = req.headers['host'] || 'localhost'
        const redirectUri = `${proto}://${host}/api/taskboard/oauth/notion/callback`
        const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`
        
        if (url.searchParams.get('json') === '1') {
          return sendJson(res, 200, { ok: true, authUrl, oauthConfigured: true })
        }
        res.writeHead(302, { Location: authUrl })
        return res.end()
      }

      // GET /api/taskboard/oauth/notion/callback - Handles OAuth redirect
      if (url.pathname === '/api/taskboard/oauth/notion/callback' && req.method === 'GET') {
        const code = url.searchParams.get('code')
        const clientId = process.env.NOTION_CLIENT_ID
        const clientSecret = process.env.NOTION_CLIENT_SECRET
        if (!code || !clientId || !clientSecret) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          return res.end('<h3>OAuth Error: Missing authorization code or client credentials</h3>')
        }

        const proto = req.headers['x-forwarded-proto'] || 'http'
        const host = req.headers['host'] || 'localhost'
        const redirectUri = `${proto}://${host}/api/taskboard/oauth/notion/callback`

        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
          }),
        })

        if (!tokenRes.ok) {
          const errData = await tokenRes.text()
          res.writeHead(500, { 'Content-Type': 'text/html' })
          return res.end(`<h3>Failed to exchange token with Notion</h3><pre>${errData}</pre>`)
        }

        const tokenData = await tokenRes.json()
        const config = await loadTaskConfig()
        if (!config.providers) config.providers = {}
        if (!config.providers.notion) config.providers.notion = {}

        config.providers.notion.apiKey = tokenData.access_token
        config.providers.notion.workspaceName = tokenData.workspace_name
        config.active = 'notion'

        // Auto-discover database
        const notionProvider = getProvider('notion')
        if (notionProvider && typeof notionProvider.discover === 'function') {
          const databases = await notionProvider.discover({ apiKey: tokenData.access_token })
          if (databases.length > 0) {
            config.providers.notion.databaseId = databases[0].id
          }
        }

        await saveTaskConfig(config)

        res.writeHead(302, { Location: '/?notion_connected=1' })
        return res.end()
      }

      // GET /api/taskboard/tasks - Returns tasks from configured provider
      if (url.pathname === '/api/taskboard/tasks' && req.method === 'GET') {
        const config = await loadTaskConfig()
        const activeId = config.active || 'github'
        const provider = getProvider(activeId)

        let tasks = []
        if (provider) {
          const providerConfig = config.providers?.[activeId] || {}
          tasks = await provider.fetchTasks(providerConfig, {
            repos: [], // Can be populated from active colony threads if desired
          })
        }

        return sendJson(res, 200, {
          tasks,
          provider: activeId,
          providerName: provider?.name || activeId,
          scannedAt: Date.now(),
        })
      }

      return sendJson(res, 404, { error: 'Unknown taskboard route' })
    } catch (err) {
      return sendJson(res, 500, { error: err.message })
    }
  }
}
