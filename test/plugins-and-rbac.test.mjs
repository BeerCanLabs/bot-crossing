import test from 'node:test'
import assert from 'node:assert/strict'
import fsp from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

async function withServer(run) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bot-crossing-test-rbac-'))
  process.env.BOT_CROSSING_DATA = dir
  const { apiMiddleware } = await import(`../server/api.mjs?cacheBust=${Date.now()}_${Math.random()}`)

  const server = http.createServer((req, res) => apiMiddleware(req, res, () => {
    res.writeHead(404)
    res.end()
  }))

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const base = `http://127.0.0.1:${port}`

  try {
    await run({ base, dir })
  } finally {
    server.close()
    await fsp.rm(dir, { recursive: true, force: true })
  }
}

test('PluginManager reports installed plugins and official catalog', async () => {
  await withServer(async ({ base }) => {
    const res = await fetch(`${base}/api/plugins`, {
      headers: { Origin: base }
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(data.installed)
    assert.ok(data.installed.billboard, 'Billboard plugin must be installed')
    assert.ok(data.installed.rbac, 'RBAC plugin must be installed')
    assert.ok(Array.isArray(data.catalog), 'Catalog must be an array')
    assert.ok(data.catalog.length >= 2, 'Catalog must contain at least billboard and rbac')
  })
})

test('RBAC: Cloudflare Access email header authenticates user', async () => {
  await withServer(async ({ base }) => {
    const res = await fetch(`${base}/api/rbac/me`, {
      headers: {
        Origin: base,
        'Cf-Access-Authenticated-User-Email': 'dale@sackrider.com'
      }
    })
    assert.equal(res.status, 200)
    const me = await res.json()
    assert.equal(me.user.email, 'dale@sackrider.com')
    assert.equal(me.role, 'admin')
    assert.equal(me.isAdmin, true)
  })
})

test('RBAC: Admin can manage roles and assign Agent Manager with specific agents', async () => {
  await withServer(async ({ base }) => {
    const adminHeaders = {
      Origin: base,
      'Content-Type': 'application/json',
      'Cf-Access-Authenticated-User-Email': 'dale@sackrider.com'
    }

    // 1. Assign alice as agent_manager for sm-castle
    const assignRes = await fetch(`${base}/api/rbac/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: 'alice@example.com',
        role: 'agent_manager',
        allowedAgents: ['sm-castle']
      })
    })
    assert.equal(assignRes.status, 200)

    // 2. Assign bob as spectator
    const assignBob = await fetch(`${base}/api/rbac/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: 'bob@example.com',
        role: 'spectator'
      })
    })
    assert.equal(assignBob.status, 200)

    // 3. Verify Alice's permissions
    const aliceMeRes = await fetch(`${base}/api/rbac/me`, {
      headers: {
        Origin: base,
        'Cf-Access-Authenticated-User-Email': 'alice@example.com'
      }
    })
    const alice = await aliceMeRes.json()
    assert.equal(alice.role, 'agent_manager')
    assert.deepEqual(alice.allowedAgents, ['sm-castle'])

    // 4. Spectator bob is rejected from sending chat
    const bobChat = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: {
        Origin: base,
        'Content-Type': 'application/json',
        'Cf-Access-Authenticated-User-Email': 'bob@example.com'
      },
      body: JSON.stringify({
        agent: 'sm-castle',
        message: 'Hello from spectator'
      })
    })
    assert.equal(bobChat.status, 403)
    const bobChatErr = await bobChat.json()
    assert.match(bobChatErr.error, /Spectator role is read-only/)

    // 5. Alice cannot chat with sm-donna (she is only assigned to sm-castle)
    const aliceDonnaChat = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: {
        Origin: base,
        'Content-Type': 'application/json',
        'Cf-Access-Authenticated-User-Email': 'alice@example.com'
      },
      body: JSON.stringify({
        agent: 'sm-donna',
        message: 'Hello Donna'
      })
    })
    assert.equal(aliceDonnaChat.status, 403)
    const aliceErr = await aliceDonnaChat.json()
    assert.match(aliceErr.error, /Access Denied: You are not assigned to manage agent 'sm-donna'/)
  })
})

test('RBAC: Non-admin is rejected from managing roles', async () => {
  await withServer(async ({ base }) => {
    const spectatorHeaders = {
      Origin: base,
      'Content-Type': 'application/json',
      'Cf-Access-Authenticated-User-Email': 'charlie@example.com'
    }

    const res = await fetch(`${base}/api/rbac/users`, {
      method: 'GET',
      headers: spectatorHeaders
    })
    assert.equal(res.status, 403)
  })
})
