/**
 * Harness adapter: Grok CLI (~/.grok)
 *
 * Scans Grok interactive sessions from ~/.grok/sessions/
 * Each session directory contains summary.json, chat_history.jsonl, and prompt_history.jsonl.
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { exists, findExecutable } from '../lib/fsutil.mjs'

const HOME = os.homedir()
const GROK_HOME = process.env.GROK_HOME || path.join(HOME, '.grok')
const SESSIONS_DIR = path.join(GROK_HOME, 'sessions')
const ACTIVE_SESSIONS_FILE = path.join(GROK_HOME, 'active_sessions.json')

const ID = (raw) => `grok:${raw}`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function detect() {
  return exists(SESSIONS_DIR)
}

async function getActiveSessionIds() {
  try {
    const raw = await fsp.readFile(ACTIVE_SESSIONS_FILE, 'utf8')
    const list = JSON.parse(raw)
    return new Set(Array.isArray(list) ? list.map((x) => (typeof x === 'string' ? x : x?.id)).filter(Boolean) : [])
  } catch {
    return new Set()
  }
}

async function scanThreads() {
  if (!(await detect())) return []

  const activeIds = await getActiveSessionIds()
  let cwdEntries = []
  try {
    cwdEntries = await fsp.readdir(SESSIONS_DIR, { withFileTypes: true })
  } catch {
    return []
  }

  const threads = []

  for (const entry of cwdEntries) {
    if (!entry.isDirectory()) continue
    const cwdDir = path.join(SESSIONS_DIR, entry.name)

    let sessionEntries = []
    try {
      sessionEntries = await fsp.readdir(cwdDir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const sEntry of sessionEntries) {
      if (!sEntry.isDirectory()) continue
      const sessionId = sEntry.name
      if (!UUID.test(sessionId)) continue

      const sPath = path.join(cwdDir, sessionId)
      const summaryPath = path.join(sPath, 'summary.json')

      try {
        const raw = await fsp.readFile(summaryPath, 'utf8')
        const summary = JSON.parse(raw)

        const cwd = summary.info?.cwd || (decodeURIComponent(entry.name) || '')
        const project = path.basename(cwd) || 'unspecified'
        const createdAt = Date.parse(summary.created_at || '') || Date.now()
        const lastActivityAt = Date.parse(summary.last_active_at || summary.updated_at || '') || createdAt

        let sizeBytes = 4096
        try {
          const files = await fsp.readdir(sPath)
          for (const f of files) {
            const stat = await fsp.stat(path.join(sPath, f)).catch(() => null)
            if (stat) sizeBytes += stat.size
          }
        } catch {
          // ignore
        }

        const isRunning = activeIds.has(sessionId)
        const cliCommand = cwd ? `(cd "${cwd}" && grok --resume ${sessionId})` : `grok --resume ${sessionId}`

        threads.push({
          id: ID(sessionId),
          title: summary.session_summary || summary.generated_title || 'Untitled session',
          preview: summary.session_summary || summary.generated_title || '',
          project,
          projectPath: cwd,
          cwd,
          worktree: '',
          model: summary.current_model_id || 'grok',
          effort: summary.reasoning_effort || '',
          gitBranch: summary.head_branch || '',
          createdAt,
          lastActivityAt,
          lastFocusedAt: 0,
          running: isRunning,
          unread: false,
          hasError: false,
          starred: false,
          routine: '',
          prState: '',
          archived: false,
          sizeBytes,
          source: 'grok-cli',
          canOpen: true,
          cliCommand,
          ref: { sessionId, cwd },
        })
      } catch {
        // partial or corrupted session summary, skip
      }
    }
  }

  return threads
}

function openThread(ref) {
  const sessionId = ref?.sessionId
  const cwd = ref?.cwd
  if (!sessionId) {
    return { ok: false, error: 'No Grok session id on record' }
  }
  return {
    ok: true,
    command: {
      argv: ['grok', '--resume', sessionId],
      cwd: cwd || HOME,
    },
  }
}

function newSession(dir) {
  return {
    ok: true,
    command: {
      argv: ['grok'],
      cwd: dir,
    },
  }
}

export default {
  id: 'grok',
  name: 'Grok CLI',
  detect,
  scanThreads,
  openThread,
  newSession,
  paths: { GROK_HOME, SESSIONS_DIR },
}
