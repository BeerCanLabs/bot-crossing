import test from 'node:test'
import assert from 'node:assert/strict'
import fsp from 'node:fs/promises'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { RbacStore } from '../plugins/rbac/server/store.js'

async function createServerInstance(dir) {
  process.env.BOT_CROSSING_DATA = dir
  const { apiMiddleware } = await import(`../server/api.mjs?cacheBust=${Date.now()}_${Math.random()}`)

  const server = http.createServer((req, res) => apiMiddleware(req, res, () => {
    res.writeHead(404)
    res.end()
  }))

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const base = `http://127.0.0.1:${port}`

  return {
    base,
    close: () => new Promise((resolve) => server.close(resolve))
  }
}

test('KPF-BC-001: RbacStore re-hydrates invited users and roles across container lifecycle', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bot-crossing-kpf-rbac-'))
  try {
    // 1. First container instance
    const store1 = new RbacStore(dir)
    store1.setUser('stephanie@example.com', 'agent_manager', ['higgins', 'sm-higgins'])
    store1.setUser('charlie@example.com', 'spectator')

    // Verify raw file on disk (persistent volume)
    const filePath = path.join(dir, 'rbac-users.json')
    assert.ok(fs.existsSync(filePath), 'rbac-users.json must exist on persistent disk')
    const onDisk = JSON.parse(await fsp.readFile(filePath, 'utf-8'))
    assert.ok(onDisk.users['stephanie@example.com'], 'Stephanie must be persisted to disk')
    assert.equal(onDisk.users['stephanie@example.com'].role, 'agent_manager')

    // 2. Simulate container reboot / new revision mounting the same persistent volume
    const store2 = new RbacStore(dir)
    const stephanie = store2.getUser('stephanie@example.com')
    assert.equal(stephanie.role, 'agent_manager')
    assert.deepEqual(stephanie.allowedAgents, ['higgins', 'sm-higgins'])

    const charlie = store2.getUser('charlie@example.com')
    assert.equal(charlie.role, 'spectator')

    // Root admin must still be active and not wipe custom users
    const admin = store2.getUser('dale.sackrider@gmail.com')
    assert.equal(admin.role, 'admin')
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
})

test('KPF-BC-001: HTTP API persists RBAC configurations across server restarts', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bot-crossing-kpf-server-'))
  try {
    // Container revision 1
    const server1 = await createServerInstance(dir)
    const adminHeaders1 = {
      Origin: server1.base,
      'Content-Type': 'application/json',
      'Cf-Access-Authenticated-User-Email': 'dale.sackrider@gmail.com'
    }

    // Add Stephanie as agent manager for Higgins
    const addRes = await fetch(`${server1.base}/api/rbac/users`, {
      method: 'POST',
      headers: adminHeaders1,
      body: JSON.stringify({
        email: 'stephanie@example.com',
        role: 'agent_manager',
        allowedAgents: ['higgins', 'sm-higgins']
      })
    })
    assert.equal(addRes.status, 200)

    // Stop container 1
    await server1.close()

    // Container revision 2 (new server instance reusing the persistent volume)
    const server2 = await createServerInstance(dir)
    const adminHeaders2 = {
      Origin: server2.base,
      'Content-Type': 'application/json',
      'Cf-Access-Authenticated-User-Email': 'dale.sackrider@gmail.com'
    }

    // Verify Stephanie still exists in user listing
    const listRes = await fetch(`${server2.base}/api/rbac/users`, {
      headers: adminHeaders2
    })
    assert.equal(listRes.status, 200)
    const listData = await listRes.json()
    assert.ok(listData.users['stephanie@example.com'], 'Stephanie must persist after server restart')
    assert.equal(listData.users['stephanie@example.com'].role, 'agent_manager')

    // Authenticate as Stephanie directly against new server instance
    const stephanieRes = await fetch(`${server2.base}/api/rbac/me`, {
      headers: {
        Origin: server2.base,
        'Cf-Access-Authenticated-User-Email': 'stephanie@example.com'
      }
    })
    assert.equal(stephanieRes.status, 200)
    const stephanieMe = await stephanieRes.json()
    assert.equal(stephanieMe.role, 'agent_manager')
    assert.deepEqual(stephanieMe.allowedAgents, ['higgins', 'sm-higgins'])

    await server2.close()
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
})

test('KPF-BC-001: Colony layout state (colony.json) persists across server restarts', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bot-crossing-kpf-colony-'))
  try {
    const server1 = await createServerInstance(dir)
    const adminHeaders1 = {
      Origin: server1.base,
      'Content-Type': 'application/json',
      'Cf-Access-Authenticated-User-Email': 'dale.sackrider@gmail.com'
    }

    // Save colony state
    const saveState = {
      version: 2,
      hiddenProjects: ['repo-secret'],
      plots: {
        'repo-secret': [[42, 84]]
      }
    }

    const putRes = await fetch(`${server1.base}/api/state`, {
      method: 'PUT',
      headers: adminHeaders1,
      body: JSON.stringify(saveState)
    })
    assert.equal(putRes.status, 200)
    await server1.close()

    // Container reboot / re-hydration
    const server2 = await createServerInstance(dir)
    const getRes = await fetch(`${server2.base}/api/state`, {
      headers: {
        Origin: server2.base,
        'Cf-Access-Authenticated-User-Email': 'dale.sackrider@gmail.com'
      }
    })
    assert.equal(getRes.status, 200)
    const fetched = await getRes.json()
    assert.deepEqual(fetched.hiddenProjects, ['repo-secret'])
    assert.deepEqual(fetched.plots['repo-secret'], [[42, 84]])

    await server2.close()
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
})

test('KPF-BC-001: Barred users remain barred across re-hydration', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bot-crossing-kpf-barred-'))
  try {
    const store = new RbacStore(dir)
    assert.throws(() => {
      store.setUser('dale@sackrider.com', 'admin')
    }, /barred/)

    // Direct malicious payload in storage file
    const filePath = path.join(dir, 'rbac-users.json')
    const raw = JSON.parse(await fsp.readFile(filePath, 'utf-8'))
    raw.users['dale@sackrider.com'] = { role: 'admin', allowedAgents: ['*'] }
    await fsp.writeFile(filePath, JSON.stringify(raw), 'utf-8')

    // Reload store
    const reloadedStore = new RbacStore(dir)
    const barredUser = reloadedStore.getUser('dale@sackrider.com')
    assert.equal(barredUser.role, 'unauthorized')
    assert.equal(barredUser.barred, true)
    assert.equal(reloadedStore.data.users['dale@sackrider.com'], undefined, 'Barred email must be purged from memory and disk')
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
})
