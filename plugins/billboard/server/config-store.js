import fsp from 'node:fs/promises'
import path from 'node:path'

const CWD = process.cwd()
const COLONY_FILE = path.join(process.env.BOT_CROSSING_DATA || path.join(CWD, 'data'), 'colony.json')
const FALLBACK_CONFIG = path.join(CWD, '.taskboard-config.json')

export async function loadTaskConfig() {
  // First try reading from colony.json
  try {
    const raw = await fsp.readFile(COLONY_FILE, 'utf8')
    const colony = JSON.parse(raw)
    if (colony.taskProvider && typeof colony.taskProvider === 'object') {
      return colony.taskProvider
    }
  } catch {
    // colony.json not present or unreadable
  }

  // Fallback to standalone config
  try {
    const raw = await fsp.readFile(FALLBACK_CONFIG, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {
      active: 'github',
      providers: {
        github: { repos: '', token: '' },
      },
    }
  }
}

export async function saveTaskConfig(taskConfig) {
  // If colony.json exists, update it atomically
  try {
    const raw = await fsp.readFile(COLONY_FILE, 'utf8')
    const colony = JSON.parse(raw)
    colony.taskProvider = taskConfig
    await fsp.writeFile(COLONY_FILE, JSON.stringify(colony, null, 2), 'utf8')
    return { ok: true, file: COLONY_FILE }
  } catch {
    // Otherwise save to standalone file
    await fsp.writeFile(FALLBACK_CONFIG, JSON.stringify(taskConfig, null, 2), 'utf8')
    return { ok: true, file: FALLBACK_CONFIG }
  }
}
