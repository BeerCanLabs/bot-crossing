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

// Functional domains (hex tiles in The Colony)
export const FUNCTIONAL_DOMAINS = {
  EXECUTIVE_SUITE: 'Executive Suite',
  AGENT_FACTORY: 'Agent Factory',
  ENGINEERING: 'Engineering',
  WEB_CLIENTS: 'Web Clients',
  INFRASTRUCTURE: 'Infrastructure',
  REAL_ESTATE: 'Real Estate',
}

// Human-readable titles, roles, and functional domains for each Submind agent
const AGENT_PROFILES = {
  donna: {
    title: 'Donna — Personal Assistant',
    role: 'Personal & business life operations, calendar management & executive coordination',
    domain: FUNCTIONAL_DOMAINS.EXECUTIVE_SUITE,
    repo: 'BeerCanLabs/SM-donna',
    model: 'gemini-3.5-flash',
  },
  castle: {
    title: 'Castle — Content Author & Voice',
    role: 'Thought leadership, Dale voice profile, blog authoring & reflections',
    domain: FUNCTIONAL_DOMAINS.EXECUTIVE_SUITE,
    repo: 'BeerCanLabs/SM-castle',
    model: 'claude-opus-4-8',
  },
  archie: {
    title: 'Archie — Head of Engineering',
    role: 'Agent Factory architecture, platform IaC & backlog coordination',
    domain: FUNCTIONAL_DOMAINS.AGENT_FACTORY,
    repo: 'BeerCanLabs/SM-archie',
    model: 'claude-opus-4-8',
  },
  draftsman: {
    title: 'Draftsman — System Architect',
    role: 'Agent blueprints, architectural standards & catalog metadata',
    domain: FUNCTIONAL_DOMAINS.AGENT_FACTORY,
    repo: 'BeerCanLabs/ev-draftsman',
    model: 'claude-opus-4-8',
  },
  switch: {
    title: 'Switch — Autonomous Software Engineer',
    role: 'Autonomous software engineering, lab apps, games & experiments',
    domain: FUNCTIONAL_DOMAINS.ENGINEERING,
    repo: 'BeerCanLabs/SM-switch',
    model: 'claude-opus-4-8',
  },
  geordi: {
    title: 'Geordi — Infrastructure & SRE',
    role: 'GCP Cloud Run platform, networking, Litestream replication & reliability',
    domain: FUNCTIONAL_DOMAINS.INFRASTRUCTURE,
    repo: 'BeerCanLabs/SM-geordi',
    model: 'gemini-3.5-flash',
  },
  higgins: {
    title: 'Higgins — Estate & Executive Manager',
    role: 'Closing Climb real estate pipeline, property ops & closing board',
    domain: FUNCTIONAL_DOMAINS.REAL_ESTATE,
    repo: 'BeerCanLabs/SM-higgins',
    model: 'grok-4',
  },
  'mcp-gateway': {
    title: 'Submind MCP Gateway',
    role: 'Model Context Protocol federation and tool dispatch gateway',
    domain: FUNCTIONAL_DOMAINS.AGENT_FACTORY,
    repo: 'BeerCanLabs/skippy-matrix',
    model: 'gateway',
  },
}

const REPO_DOMAINS = {
  'BeerCanLabs/skippy-matrix': FUNCTIONAL_DOMAINS.AGENT_FACTORY,
  'BeerCanLabs/SM-archie': FUNCTIONAL_DOMAINS.AGENT_FACTORY,
  'BeerCanLabs/ev-draftsman': FUNCTIONAL_DOMAINS.AGENT_FACTORY,
  'BeerCanLabs/closing-climb': FUNCTIONAL_DOMAINS.REAL_ESTATE,
  'BeerCanLabs/SM-higgins': FUNCTIONAL_DOMAINS.REAL_ESTATE,
  'BeerCanLabs/SM-donna': FUNCTIONAL_DOMAINS.EXECUTIVE_SUITE,
  'BeerCanLabs/SM-castle': FUNCTIONAL_DOMAINS.EXECUTIVE_SUITE,
  'BeerCanLabs/SM-geordi': FUNCTIONAL_DOMAINS.INFRASTRUCTURE,
  'BeerCanLabs/SM-switch': FUNCTIONAL_DOMAINS.ENGINEERING,
  'BeerCanLabs/HexSplore': FUNCTIONAL_DOMAINS.ENGINEERING,
  'BeerCanLabs/ember-orchard-clicker': FUNCTIONAL_DOMAINS.ENGINEERING,
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
    'BeerCanLabs/skippy-matrix',
    'BeerCanLabs/SM-switch',
    'BeerCanLabs/SM-archie',
    'BeerCanLabs/SM-higgins',
    'BeerCanLabs/SM-donna',
    'BeerCanLabs/SM-castle',
    'BeerCanLabs/SM-geordi',
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
    const running = hasActiveTask

    // Determine the functional domain for this thread
    let project = profile.domain || FUNCTIONAL_DOMAINS.ENGINEERING
    if (activeTask) {
      project = REPO_DOMAINS[activeTask.repo] || activeTask.projectName
    }
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

  // Always include Web Clients functional tile with Switch
  threads.push({
    id: ID('switch-web-clients'),
    title: 'Switch — Web Clients Engineer',
    preview: 'Client production web applications, external customer portals & frontends',
    project: FUNCTIONAL_DOMAINS.WEB_CLIENTS,
    projectPath: 'https://github.com/BeerCanLabs',
    cliCommand: 'python3 /Users/skippy/repos/skippy-matrix/scripts/hermes_mcp_client.py ask switch "status"',
    worktree: '',
    model: 'claude-opus-4-8',
    effort: '',
    cwd: 'https://github.com/BeerCanLabs',
    gitBranch: 'main',
    createdAt: now - 86400000,
    lastActivityAt: now - 3600000,
    lastFocusedAt: 0,
    running: false,
    unread: false,
    hasError: false,
    starred: true,
    routine: '',
    prState: '',
    archived: false,
    sizeBytes: 8192,
    source: 'gcp-submind',
    canOpen: true,
    ref: {
      agent: 'switch',
      repo: 'BeerCanLabs',
      url: 'https://github.com/BeerCanLabs',
    },
  })

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

const AGENT_SERVICES = {
  switch: 'https://sm-switch-382872241265.us-central1.run.app',
  higgins: 'https://sm-higgins-382872241265.us-central1.run.app',
  donna: 'https://sm-donna-382872241265.us-central1.run.app',
  castle: 'https://sm-castle-382872241265.us-central1.run.app',
  geordi: 'https://sm-geordi-382872241265.us-central1.run.app',
  archie: 'https://sm-archie-382872241265.us-central1.run.app',
  draftsman: 'https://ev-draftsman-382872241265.us-central1.run.app',
  'mcp-gateway': 'https://sm-mcp-gateway-382872241265.us-central1.run.app',
}

async function getGcpIdToken(audience) {
  try {
    const url = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`
    const res = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(2000) })
    if (res.ok) return await res.text()
  } catch {
    // metadata server not reachable (e.g. running locally)
  }
  return null
}

export async function chatWithSubmindAgent(agentName, text, sessionId = 'colony-session') {
  let normName = (agentName || '').toLowerCase().replace(/^sm-/, '').replace(/^submind:/, '')
  if (normName.startsWith('switch')) normName = 'switch'
  const serviceUrl = AGENT_SERVICES[normName]
  if (!serviceUrl) {
    return { ok: false, error: `Unknown Submind agent: ${agentName}` }
  }

  const token = process.env.GATEWAY_AUTH_TOKEN || '3fb7b6ca289945df8ee0fc945bdf9b5b'
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
  const idToken = await getGcpIdToken(serviceUrl)
  if (idToken) {
    headers['X-Serverless-Authorization'] = `Bearer ${idToken.trim()}`
  }

  try {
    const res = await fetch(`${serviceUrl}/v1/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text,
        session_id: sessionId || 'colony-session',
        stream: false,
      }),
      signal: AbortSignal.timeout(300000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { ok: false, error: `Agent ${normName} returned HTTP ${res.status}: ${errText.slice(0, 200)}` }
    }

    const data = await res.json()
    const replyText = data.text || data.reply || (data.t ? data.t : 'Message received')
    return {
      ok: true,
      agent: normName,
      text: replyText,
      id: data.id || Date.now().toString(),
      timestamp: Date.now(),
    }
  } catch (err) {
    return { ok: false, error: `Failed to contact ${normName}: ${err.message}` }
  }
}

export default {
  id: 'submind',
  name: "Skippy's Submind",
  detect,
  scanThreads,
  openThread,
  newSession,
  chatWithSubmindAgent,
}
