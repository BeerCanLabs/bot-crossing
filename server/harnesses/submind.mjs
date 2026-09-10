/**
 * Harness adapter: Skippy's Submind Agent Farm on Google Cloud Platform (GCP).
 *
 * Discovers and maps the Submind autonomous agent fleet running on Cloud Run in the
 * `submind-matrix` project (Higgins, Donna, Switch, Castle, Archie, Geordi, Draftsman).
 *
 * Reads:
 *   1. Active GitHub tasks & issues across BeerCanLabs repositories (closing-climb, SM-*).
 *      Agents with active open tasks appear with active scaffolding (⚒ hammering) in their
 *      respective project hex zones.
 *   2. Replicated state & memory snapshots directly from Google Cloud Storage
 *      (`gs://submind-matrix-*-memory`).
 */
import { Storage } from '@google-cloud/storage'

const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'submind-matrix'
const ID = (agent) => `submind:${agent}`

// Human-readable titles and role definitions for each Submind astronaut
const AGENT_PROFILES = {
  higgins: {
    title: 'Higgins — Estate & Executive Manager',
    role: 'Executive operations, calendars & Closing Climb real estate pipeline',
    repo: 'BeerCanLabs/SM-higgins',
    model: 'grok-4',
  },
  donna: {
    title: 'Donna — Chief Operating Officer',
    role: 'COO, high-level coordination, proactive assistance & executive comms',
    repo: 'BeerCanLabs/SM-donna',
    model: 'gemini-3.5-flash',
  },
  switch: {
    title: 'Switch — Code & Automation Specialist',
    role: 'Autonomous refactoring, script execution & system automation',
    repo: 'BeerCanLabs/SM-switch',
    model: 'claude-3-5-sonnet',
  },
  castle: {
    title: 'Castle — Security & Defense Officer',
    role: 'Security policy audits, IAM inspection & secret boundary enforcement',
    repo: 'BeerCanLabs/SM-castle',
    model: 'claude-3-5-sonnet',
  },
  archie: {
    title: 'Archie — Issue & GitHub Operations',
    role: 'Multi-repo issue triage, backlog coordination & PR review management',
    repo: 'BeerCanLabs/SM-archie',
    model: 'claude-3-5-sonnet',
  },
  geordi: {
    title: 'Geordi — Infrastructure & SRE',
    role: 'GCP Cloud Run health, Litestream replication & cloud reliability',
    repo: 'BeerCanLabs/SM-geordi',
    model: 'gemini-3.5-flash',
  },
  draftsman: {
    title: 'Draftsman — System Architect',
    role: 'C4 diagram generation, architectural specs & catalog metadata',
    repo: 'BeerCanLabs/ev-draftsman',
    model: 'claude-3-5-sonnet',
  },
  'mcp-gateway': {
    title: 'Submind MCP Gateway',
    role: 'Model Context Protocol federation and tool dispatch gateway',
    repo: 'BeerCanLabs/skippy-matrix',
    model: 'gateway',
  },
}

// Window of time an agent's memory sync counts as "actively working now"
const ACTIVE_WINDOW_MS = 60 * 60 * 1000

let storageClient = null
function getStorage() {
  if (!storageClient) {
    storageClient = new Storage({ projectId: PROJECT_ID })
  }
  return storageClient
}

/**
 * Fetch open issues across relevant BeerCanLabs repos to identify active agent assignments.
 */
async function fetchActiveTasks() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
  if (!token) return new Map()

  const repos = [
    'BeerCanLabs/closing-climb',
    'BeerCanLabs/SM-switch',
    'BeerCanLabs/SM-archie',
    'BeerCanLabs/SM-higgins',
    'BeerCanLabs/SM-donna',
  ]

  const tasksByAgent = new Map()

  for (const repo of repos) {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=open`, {
        headers: {
          'User-Agent': 'Bot-Crossing-Submind',
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })
      if (!res.ok) continue
      const issues = await res.json()
      if (!Array.isArray(issues)) continue

      for (const issue of issues) {
        // Skip pull requests
        if (issue.pull_request) continue

        const text = `${issue.title} ${issue.body || ''}`.toLowerCase()
        let targetAgent = ''

        if (text.includes('switch') || text.includes('sm-switch')) targetAgent = 'switch'
        else if (text.includes('higgins') || text.includes('sm-higgins')) targetAgent = 'higgins'
        else if (text.includes('donna') || text.includes('sm-donna')) targetAgent = 'donna'
        else if (text.includes('archie') || text.includes('sm-archie')) targetAgent = 'archie'
        else if (text.includes('castle') || text.includes('sm-castle')) targetAgent = 'castle'
        else if (text.includes('geordi') || text.includes('sm-geordi')) targetAgent = 'geordi'
        else if (text.includes('draftsman') || text.includes('ev-draftsman')) targetAgent = 'draftsman'

        if (targetAgent && !tasksByAgent.has(targetAgent)) {
          tasksByAgent.set(targetAgent, {
            repo,
            projectName: repo.split('/')[1] || repo,
            issueNumber: issue.number,
            title: issue.title,
            body: issue.body || '',
            url: issue.html_url,
            updatedAt: Date.parse(issue.updated_at) || Date.now(),
          })
        }
      }
    } catch {
      // Continue gracefully if network or repo check fails
    }
  }

  return tasksByAgent
}

/**
 * Detect if Submind is accessible (checks if we can instantiate GCS and find the project).
 */
async function detect() {
  try {
    const storage = getStorage()
    const [buckets] = await storage.getBuckets({ maxResults: 5 })
    return buckets.some((b) => b.name.includes('submind') || b.name.includes('-memory'))
  } catch (err) {
    return false
  }
}

/**
 * Discovers all Submind agent memory buckets in GCP and active GitHub tasks.
 */
async function scanThreads() {
  const storage = getStorage()
  let buckets = []
  try {
    const [allBuckets] = await storage.getBuckets()
    buckets = allBuckets.filter(
      (b) => b.name.startsWith(`${PROJECT_ID}-`) && b.name.endsWith('-memory')
    )
  } catch (err) {
    console.warn('[submind] Failed to list GCS buckets:', err?.message || err)
    return []
  }

  const activeTasks = await fetchActiveTasks()
  const now = Date.now()
  const threads = []

  for (const bucket of buckets) {
    const rawName = bucket.name
      .replace(`${PROJECT_ID}-`, '')
      .replace('-memory', '')
      .replace(/^sm-|^ev-/, '')

    const profile = AGENT_PROFILES[rawName] || {
      title: `${rawName.toUpperCase()} — Submind Agent`,
      role: 'Autonomous Submind worker',
      repo: `BeerCanLabs/SM-${rawName}`,
      model: 'cloud-run',
    }

    let latestUpdate = 0
    let totalBytes = 0

    try {
      // Query recent WAL snapshots and state backups to compute activity and size
      const [files] = await bucket.getFiles({ prefix: 'db/', maxResults: 15 })
      for (const f of files) {
        const updated = Date.parse(f.metadata.updated) || 0
        if (updated > latestUpdate) latestUpdate = updated
        totalBytes += Number(f.metadata.size || 0)
      }
    } catch {
      // Fallback
    }

    if (!latestUpdate) {
      latestUpdate = Date.parse(bucket.metadata.updated || bucket.metadata.timeCreated) || now
    }

    // Check if agent has an active GitHub task
    const activeTask = activeTasks.get(rawName)
    const hasActiveTask = Boolean(activeTask)

    const age = now - latestUpdate
    const running = hasActiveTask || age < ACTIVE_WINDOW_MS

    const project = activeTask ? activeTask.projectName : rawName
    const projectPath = activeTask ? `https://github.com/${activeTask.repo}` : `https://github.com/${profile.repo}`
    const title = activeTask
      ? `${rawName.toUpperCase()} — Working on #${activeTask.issueNumber}: ${activeTask.title}`
      : profile.title
    const preview = activeTask ? activeTask.body.slice(0, 240) : profile.role

    const cliCommand = activeTask
      ? `gh issue view ${activeTask.issueNumber} -R ${activeTask.repo}`
      : `python3 /Users/skippy/repos/skippy-matrix/scripts/hermes_mcp_client.py ask ${rawName} "status"`

    threads.push({
      id: ID(rawName),
      title,
      preview,
      project,
      projectPath,
      cliCommand,
      worktree: '',
      model: profile.model,
      effort: '',
      cwd: `gs://${bucket.name}`,
      gitBranch: 'main',
      createdAt: Date.parse(bucket.metadata.timeCreated) || latestUpdate,
      lastActivityAt: activeTask ? activeTask.updatedAt : latestUpdate,
      lastFocusedAt: 0,
      running,
      unread: false,
      hasError: false,
      starred: true,
      routine: '',
      prState: '',
      archived: false,
      sizeBytes: Math.max(totalBytes, 4096),
      source: 'gcp-submind',
      canOpen: true,
      ref: {
        agent: rawName,
        bucket: bucket.name,
        repo: activeTask ? activeTask.repo : profile.repo,
        url: activeTask ? activeTask.url : `https://github.com/${profile.repo}`,
      },
    })
  }

  return threads
}

/**
 * Opens the agent thread: navigates to the assigned issue or agent repository.
 */
async function openThread(ref) {
  const { url, repo } = ref || {}
  const targetUrl = url || (repo ? `https://github.com/${repo}` : 'https://github.com/BeerCanLabs')
  return { ok: true, url: targetUrl }
}

async function newSession(dir) {
  return {
    ok: true,
    url: 'https://github.com/BeerCanLabs',
  }
}

export default {
  id: 'submind',
  name: "Skippy's Submind",
  detect,
  scanThreads,
  openThread,
  newSession,
}
