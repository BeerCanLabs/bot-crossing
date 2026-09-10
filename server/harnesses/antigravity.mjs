/**
 * Harness adapter: Antigravity CLI (Google) — the `agy` command-line tool and the
 * Antigravity 2.0 desktop app together.
 *
 * Everything that knows the shape of Antigravity's own files lives in this one module.
 * `server/scan.mjs` never reaches past the adapter interface, so adding another harness
 * means writing a sibling of this file rather than editing the scanner.  The contract is
 * written down in `server/harnesses/README.md`.
 *
 * Read-only, without exception.  Nothing here writes to Antigravity's files.
 *
 * Data layout:
 *   ~/.gemini/antigravity-cli/
 *     conversation_summaries.db     one SQLite row per conversation
 *     conversations/<uuid>.db       full trajectory per conversation (steps, metadata)
 *     brain/<uuid>/.system_generated/logs/transcript.jsonl
 *     presence/<uuid>.lock          flock held while the process is alive
 */
import { DatabaseSync } from 'node:sqlite'
import { execSync } from 'node:child_process'
import { existsSync, accessSync } from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { exists, findExecutable, jsonLines, readTail } from '../lib/fsutil.mjs'

const HOME = os.homedir()

/**
 * Where Antigravity keeps its data.  The same directory on all platforms — the CLI's own
 * config path, not an Application Support or AppData directory.
 */
const DATA_DIR = path.join(HOME, '.gemini', 'antigravity-cli')
const SUMMARIES_DB = path.join(DATA_DIR, 'conversation_summaries.db')
const CONVERSATIONS_DIR = path.join(DATA_DIR, 'conversations')
const BRAIN_DIR = path.join(DATA_DIR, 'brain')
const PRESENCE_DIR = path.join(DATA_DIR, 'presence')

const ID = (raw) => `antigravity:${raw}`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * How recently a session must have done something to count as "active now".
 * A conversation with a presence lock but no recent activity is an idle session
 * kept open in the terminal — the astronaut should not be hammering.
 */
const ACTIVE_WINDOW_MS = 30 * 60 * 1000

/**
 * Conversations with a presence lock file held by a running process.
 *
 * Antigravity uses flock-based advisory locks: the `agy` process opens
 * `presence/<uuid>.lock` and holds an exclusive lock for its lifetime.
 * We detect this by scanning for processes that have these files open.
 *
 * A single `lsof` call covers every lock at once, so the cost is one
 * subprocess per poll rather than one per thread.  lsof exits non-zero even
 * on success (when some paths have no holders), so stdout is read from the
 * exception object.
 */
function scanLiveProcesses() {
  const running = new Set()
  if (!existsSync(PRESENCE_DIR)) return running
  try {
    const out = execSync(`lsof +D "${PRESENCE_DIR}/" 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 5000,
    })
    for (const line of out.split('\n')) {
      const m = line.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.lock/)
      if (m) running.add(m[1])
    }
  } catch (e) {
    // lsof exits 1 even on success — the output is in stdout on the error object
    const out = e.stdout || ''
    for (const line of out.split('\n')) {
      const m = line.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.lock/)
      if (m) running.add(m[1])
    }
  }
  return running
}

/**
 * Whether a transcript ends with the model waiting on you.
 *
 * Reads the last chunk of the JSONL transcript and checks whether the final
 * step is a model response (PLANNER_RESPONSE) that is done — meaning the
 * agent finished its turn and the ball is in the user's court.
 */
const TAIL_BYTES = 64 * 1024

async function awaitingReply(conversationId) {
  const transcriptPath = path.join(
    BRAIN_DIR, conversationId, '.system_generated', 'logs', 'transcript.jsonl'
  )
  let records
  try {
    records = jsonLines(await readTail(transcriptPath, TAIL_BYTES))
  } catch {
    return false
  }
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i]
    // A user input means the model speaks next — not waiting on anyone.
    if (r.type === 'USER_INPUT') return false
    if (r.type === 'PLANNER_RESPONSE' && r.status === 'DONE') return true
    if (r.type === 'PLANNER_RESPONSE') return false
  }
  return false
}

/**
 * Whether the last step in a transcript is an error.
 */
async function hasError(conversationId) {
  const transcriptPath = path.join(
    BRAIN_DIR, conversationId, '.system_generated', 'logs', 'transcript.jsonl'
  )
  let records
  try {
    records = jsonLines(await readTail(transcriptPath, TAIL_BYTES))
  } catch {
    return false
  }
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i]
    if (r.status === 'ERROR') return true
    // Only check the last meaningful step
    if (r.type === 'PLANNER_RESPONSE' || r.type === 'USER_INPUT') break
  }
  return false
}

/**
 * Extract the workspace path from the stored URI.
 * AGY stores `workspace_uris` as a JSON array of `file:///…` URIs.
 */
function parseWorkspace(urisJson) {
  try {
    const uris = JSON.parse(urisJson || '[]')
    if (!uris.length) return { projectPath: '', project: 'unknown' }
    const uri = uris[0]
    const projectPath = uri.replace(/^file:\/\//, '')
    return { projectPath, project: path.basename(projectPath) || projectPath || 'unknown' }
  } catch {
    return { projectPath: '', project: 'unknown' }
  }
}

async function scanThreads() {
  if (!existsSync(SUMMARIES_DB)) return []

  let db
  try {
    db = new DatabaseSync(SUMMARIES_DB, { open: true, readOnly: true })
  } catch {
    return []
  }

  let rows
  try {
    rows = db.prepare(`
      SELECT conversation_id, title, preview, step_count,
             last_modified_time, workspace_uris, status,
             not_fully_idle, killed, nesting_depth,
             parent_conversation_id, last_user_input_time
      FROM conversation_summaries
      ORDER BY last_modified_time DESC
    `).all()
  } catch (err) {
    db.close()
    throw err
  }
  db.close()

  const live = scanLiveProcesses()
  const now = Date.now()
  const threads = []

  for (const row of rows) {
    // Skip subagent conversations — they are ephemeral children spawned by a parent
    // conversation and should not appear as separate astronauts.
    if (row.nesting_depth > 0) continue
    if (row.parent_conversation_id) continue

    // Skip killed conversations.
    if (row.killed) continue

    const { projectPath, project } = parseWorkspace(row.workspace_uris)
    const lastActivityAt = Date.parse(row.last_modified_time) || 0
    const hasLiveProcess = live.has(row.conversation_id)
    const fresh = now - lastActivityAt < ACTIVE_WINDOW_MS

    // Size: use a rough estimate from step count. Each step averages ~2KB of transcript,
    // so the character count scales with step_count. The colony only uses this on a log
    // scale, so precision does not matter.
    const sizeBytes = (row.step_count || 0) * 2048

    // Determine running/unread/error state.
    // Only probe the transcript for threads that could plausibly need it — live + fresh
    // for running, anything not ancient for unread.
    let running = false
    let unread = false
    let errored = false

    if (hasLiveProcess && fresh) {
      const waiting = await awaitingReply(row.conversation_id)
      running = !waiting
      if (waiting) unread = true
    } else if (hasLiveProcess && !fresh) {
      // Process is alive but idle — check if it is waiting on the user
      unread = await awaitingReply(row.conversation_id)
    }

    if (!running) {
      errored = await hasError(row.conversation_id)
    }

    threads.push({
      id: ID(row.conversation_id),
      title: row.title || row.preview || 'Untitled thread',
      preview: row.preview ? row.preview.slice(0, 240) : '',
      project,
      projectPath,
      worktree: '',
      model: '',
      effort: '',
      cwd: projectPath,
      gitBranch: '',
      createdAt: lastActivityAt,
      lastActivityAt,
      lastFocusedAt: 0,
      running,
      unread,
      hasError: errored,
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      sizeBytes,
      source: 'agy',
      canOpen: true,
      ref: { conversationId: row.conversation_id, cwd: projectPath },
    })
  }

  return threads
}

/**
 * Where the `agy` CLI is.  PATH first, then the known install locations.
 * Only used on Linux where the desktop app may not answer the deep link.
 */
const CLI_DIRS = [
  path.join(HOME, '.local', 'bin'),
  path.join(HOME, '.gemini', 'antigravity-cli', 'bin'),
  '/usr/local/bin',
  '/usr/bin',
]
const cliBinary = () => findExecutable('agy', CLI_DIRS)

/**
 * Hands the thread back to Antigravity.  The desktop app is an Electron app
 * registered for the `antigravity://` URL scheme — opening the URL brings
 * the app forward and passes it the conversation to navigate to.
 *
 * On Linux, or when the desktop app is not installed, the CLI is used instead:
 * `agy --conversation <uuid>` resumes the conversation in the terminal.
 */
async function openThread(ref) {
  const { conversationId, cwd } = ref || {}
  if (typeof conversationId !== 'string' || !UUID.test(conversationId)) {
    return { ok: false, error: 'No openable conversation id on that thread' }
  }

  const url = `antigravity://conversation/${conversationId}`

  let command
  if (process.platform === 'linux') {
    const bin = await cliBinary()
    if (bin) command = { argv: [bin, '--conversation', conversationId], cwd: typeof cwd === 'string' ? cwd : '' }
  }

  return { ok: true, url, command }
}

/**
 * A fresh conversation rooted in a directory.  The desktop app opens with the
 * workspace; the CLI starts a new session there.
 */
async function newSession(dir) {
  const url = `antigravity://new?${new URLSearchParams({ folder: dir })}`

  let command
  if (process.platform === 'linux') {
    const bin = await cliBinary()
    if (bin) command = { argv: [bin], cwd: dir }
  }

  return { ok: true, url, command }
}

export default {
  id: 'antigravity',
  name: 'Antigravity',
  /** Antigravity is present when the summaries database exists. */
  detect: () => exists(SUMMARIES_DB),
  scanThreads,
  openThread,
  newSession,
  paths: { DATA_DIR, SUMMARIES_DB, CONVERSATIONS_DIR, BRAIN_DIR, PRESENCE_DIR },
}
