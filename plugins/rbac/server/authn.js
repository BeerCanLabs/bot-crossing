import { execSync } from 'node:child_process'

/**
 * Authentication (AuthN) Resolver.
 * Extracts and normalizes the authenticated user identity from the incoming request.
 */
export function resolveAuthUser(req) {
  // 1. Cloudflare Zero Trust Access
  const cfEmail = req.headers['cf-access-authenticated-user-email']
  if (cfEmail && typeof cfEmail === 'string' && cfEmail.trim().length > 0) {
    const email = cfEmail.trim().toLowerCase()
    return {
      authenticated: true,
      id: email,
      email,
      name: email.split('@')[0],
      provider: 'cloudflare'
    }
  }

  // 1b. Cloudflare JWT Assertion fallback
  const cfJwt = req.headers['cf-access-jwt-assertion']
  if (cfJwt && typeof cfJwt === 'string') {
    try {
      const parts = cfJwt.split('.')
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
        if (payload.email) {
          const email = payload.email.trim().toLowerCase()
          return {
            authenticated: true,
            id: email,
            email,
            name: email.split('@')[0],
            provider: 'cloudflare-jwt'
          }
        }
      }
    } catch (err) {
      console.warn('[RBAC] Failed to parse CF JWT:', err.message)
    }
  }

  // 2. Generic Reverse Proxy / OAuth / SAML headers
  const proxyEmail = req.headers['x-forwarded-email'] || req.headers['x-user-email'] || req.headers['x-auth-request-email']
  if (proxyEmail && typeof proxyEmail === 'string' && proxyEmail.trim().length > 0) {
    const email = proxyEmail.trim().toLowerCase()
    return {
      authenticated: true,
      id: email,
      email,
      name: email.split('@')[0],
      provider: 'proxy'
    }
  }

  // 3. Dev / Local Environment Override
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const queryUser = url.searchParams.get('devUser')
  if (queryUser) {
    const email = queryUser.trim().toLowerCase()
    return {
      authenticated: true,
      id: email,
      email,
      name: email.split('@')[0],
      provider: 'dev-param'
    }
  }

  const envUser = process.env.COLONY_ADMIN_EMAIL || process.env.COLONY_DEV_USER || process.env.RBAC_DEV_USER
  if (envUser) {
    const email = envUser.trim().toLowerCase()
    return {
      authenticated: true,
      id: email,
      email,
      name: email.split('@')[0],
      provider: 'dev-env'
    }
  }

  // 4. Local machine fallback: Check local git user email if running locally
  const host = req.headers.host || ''
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('::1')
  if (isLocal) {
    try {
      const gitEmail = execSync('git config user.email', { encoding: 'utf-8', timeout: 1000 }).trim().toLowerCase()
      if (gitEmail && gitEmail.includes('@')) {
        return {
          authenticated: true,
          id: gitEmail,
          email: gitEmail,
          name: gitEmail.split('@')[0],
          provider: 'local-git'
        }
      }
    } catch {}
  }

  // 5. Unauthenticated visitor
  return {
    authenticated: false,
    id: null,
    email: null,
    name: 'Anonymous',
    provider: null,
    reason: 'no_identity_provider'
  }
}
