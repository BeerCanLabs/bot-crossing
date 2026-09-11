import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { apiMiddleware } from '../server/api.mjs'

function withServer(fn) {
  return async () => {
    const s = http.createServer((req, res) => apiMiddleware(req, res, () => {
      res.writeHead(404).end('Not found')
    }))
    await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve))
    const { port } = s.address()
    const base = `http://127.0.0.1:${port}`
    try {
      await fn(base)
    } finally {
      await new Promise((resolve) => s.close(resolve))
    }
  }
}

test('Agent Cards: reports client script in /api/plugins/client-scripts', withServer(async (base) => {
  const res = await fetch(`${base}/api/plugins/client-scripts`, {
    headers: { Origin: base }
  })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(Array.isArray(data.scripts))
  assert.ok(data.scripts.some((s) => s.includes('agent-cards')), `Expected agent-cards client script, got: ${JSON.stringify(data.scripts)}`)
}))

test('Agent Cards: serves plugin client script directly over /plugins/agent-cards/client/index.js', withServer(async (base) => {
  const res = await fetch(`${base}/plugins/agent-cards/client/index.js`, {
    headers: { Origin: base }
  })
  assert.equal(res.status, 200)
  const contentType = res.headers.get('content-type') || ''
  assert.ok(contentType.includes('javascript'), `Expected javascript content type, got: ${contentType}`)
  const body = await res.text()
  assert.ok(body.includes('card:render'), 'Expected script to contain card:render hook')
  assert.ok(body.includes('Scheduled Routines'), 'Expected script to contain Scheduled Routines section')
  assert.ok(body.includes('btn-card-talk'), 'Expected script to contain talk button')
}))

test('Agent Cards: queries agent-specific cron routines on /api/agent-cards/cron', withServer(async (base) => {
  const res = await fetch(`${base}/api/agent-cards/cron?agent=higgins`, {
    headers: { Origin: base }
  })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.agent, 'higgins')
  assert.ok(Array.isArray(data.jobs))
  assert.ok(data.jobs.length >= 3, `Expected at least 3 cron jobs for Higgins, got: ${data.jobs.length}`)
  const morningBriefing = data.jobs.find((j) => j.id.includes('morning-daily-25'))
  assert.ok(morningBriefing, 'Expected Higgins morning briefing routine')
  assert.equal(morningBriefing.schedule, '0 6 * * *')
}))

test('Agent Cards: triggers manual cron execution on /api/agent-cards/cron/run', withServer(async (base) => {
  const res = await fetch(`${base}/api/agent-cards/cron/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: base
    },
    body: JSON.stringify({
      agent: 'higgins',
      jobId: 'submind-higgins-morning-daily-25-briefing'
    })
  })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.ok, true)
  assert.equal(data.agent, 'higgins')
  assert.equal(data.jobId, 'submind-higgins-morning-daily-25-briefing')
}))

test('Agent Cards: creates task on /api/agent-cards/tasks/create', withServer(async (base) => {
  const res = await fetch(`${base}/api/agent-cards/tasks/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: base
    },
    body: JSON.stringify({
      agent: 'higgins',
      title: 'Review weekly escrow summaries'
    })
  })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.ok, true)
  assert.equal(data.agent, 'higgins')
  assert.equal(data.repo, 'BeerCanLabs/SM-higgins')
  assert.ok(data.url)
}))
