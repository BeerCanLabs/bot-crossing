import test from 'node:test'
import assert from 'node:assert/strict'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'

import { scanCronJobs } from '../server/scan.mjs'
import submind, { scanCronJobs as submindCronJobs } from '../server/harnesses/submind.mjs'

test('submind adapter provides scanCronJobs with valid schedules', async () => {
  const jobs = await submindCronJobs()
  assert.ok(Array.isArray(jobs), 'scanCronJobs must return an array')
  assert.ok(jobs.length > 0, 'should have scheduled Submind cron jobs')

  for (const job of jobs) {
    assert.ok(job.id, 'job must have an id')
    assert.ok(job.agent, 'job must have an agent')
    assert.ok(job.schedule, 'job must have a cron schedule')
    assert.match(job.schedule, /^(\S+\s+){4}\S+$/, `${job.schedule} is not a valid 5-field cron expression`)
    assert.ok(job.task, 'job must have a task description')
  }

  const agents = new Set(jobs.map((j) => j.agent))
  assert.ok(agents.has('switch'), 'Switch must have scheduled jobs')
  assert.ok(agents.has('donna'), 'Donna must have scheduled jobs')
  assert.ok(agents.has('higgins'), 'Higgins must have scheduled jobs')
  assert.ok(agents.has('archie'), 'Archie must have scheduled jobs')
})

test('scanCronJobs aggregates fleet cron schedules', async () => {
  const allJobs = await scanCronJobs()
  assert.ok(Array.isArray(allJobs))
  assert.ok(allJobs.length > 0)
  for (const job of allJobs) {
    assert.ok(job.schedule, 'all aggregated jobs must have a schedule')
  }
})

async function withServer(run) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bot-crossing-test-tasks-'))
  process.env.BOT_CROSSING_DATA = dir
  const { apiMiddleware } = await import(`../server/api.mjs?${dir}`)

  const server = http.createServer((req, res) => apiMiddleware(req, res, () => {
    res.statusCode = 404
    res.end()
  }))

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const call = (pathname, opts = {}) =>
    fetch(`http://127.0.0.1:${port}${pathname}`, {
      ...opts,
      headers: { Origin: `http://127.0.0.1:${port}`, ...(opts.headers || {}) },
    })

  try {
    await run({ call, dir })
  } finally {
    server.close()
    await fsp.rm(dir, { recursive: true, force: true })
  }
}

test('/api/tasks returns in-flight tasks and scheduled cronjobs', async () => {
  await withServer(async ({ call }) => {
    const res = await call('/api/tasks')
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data.tasks), 'tasks must be an array')
    assert.ok(Array.isArray(data.cronjobs), 'cronjobs must be an array')
    assert.ok(typeof data.scannedAt === 'number', 'scannedAt must be a timestamp')
    assert.ok(data.cronjobs.length > 0, 'cronjobs should be populated')
  })
})
