import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.BOT_CROSSING_DATA || path.join(here, '..', 'data')
const PLUGINS_FILE = path.join(DATA_DIR, 'plugins.json')
const LOCAL_PLUGINS_DIR = path.join(here, '..', 'plugins')

// Official marketplace catalog
const OFFICIAL_CATALOG = [
  {
    id: 'billboard',
    name: 'Task Board Billboard',
    version: '1.0.0',
    description: 'Procedural 3D billboard next to the spaceship tracking active tasks from Notion, GitHub, Jira, and Linear.',
    author: 'BeerCanLabs',
    category: 'world-structure',
    icon: '📋',
    package: '@beercanlabs/bot-crossing-billboard',
    repo: 'https://github.com/BeerCanLabs/bot-crossing-plugins/tree/main/packages/billboard'
  },
  {
    id: 'rbac',
    name: 'Role-Based Access Control',
    version: '1.0.0',
    description: 'Enterprise multi-user access control supporting Admin, Agent Manager, and Spectator roles with Cloudflare Zero Trust and pluggable AuthN.',
    author: 'BeerCanLabs',
    category: 'security',
    icon: '🛡️',
    package: '@beercanlabs/bot-crossing-rbac',
    repo: 'https://github.com/BeerCanLabs/bot-crossing-plugins/tree/main/packages/rbac'
  }
]

export class PluginManager {
  constructor() {
    this.state = {
      installed: {
        billboard: {
          id: 'billboard',
          name: 'Task Board Billboard',
          enabled: true,
          package: '@beercanlabs/bot-crossing-billboard',
          category: 'world-structure'
        },
        rbac: {
          id: 'rbac',
          name: 'Role-Based Access Control',
          enabled: true,
          package: '@beercanlabs/bot-crossing-rbac',
          category: 'security'
        }
      }
    }
    this.loadedPlugins = new Map()
    this.loadState()
  }

  loadState() {
    try {
      if (fs.existsSync(PLUGINS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf-8'))
        if (raw.installed) {
          this.state.installed = raw.installed
        }
      } else {
        this.saveState()
      }
    } catch (err) {
      console.warn('[PluginManager] Failed to read plugins.json:', err.message)
    }
  }

  saveState() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.writeFileSync(PLUGINS_FILE, JSON.stringify(this.state, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[PluginManager] Failed to save plugins.json:', err.message)
    }
  }

  async resolvePluginModule(id) {
    // 1. Check local monorepo sibling path
    const localMonorepoPath = path.join(here, '..', '..', 'bot-crossing-plugins', 'packages', id, 'index.js')
    if (fs.existsSync(localMonorepoPath)) {
      return await import(pathToFileURL(localMonorepoPath).href)
    }

    // 2. Check local ./plugins directory
    const localPluginsPath = path.join(LOCAL_PLUGINS_DIR, id, 'index.js')
    if (fs.existsSync(localPluginsPath)) {
      return await import(pathToFileURL(localPluginsPath).href)
    }

    // 3. Fallback to node_modules packages
    if (id === 'billboard') {
      try {
        return await import('@beercanlabs/bot-crossing-billboard')
      } catch {
        return await import('@beercanlabs/bot-crossing-taskboard')
      }
    }
    if (id === 'rbac') {
      return await import('@beercanlabs/bot-crossing-rbac')
    }

    return null
  }

  async init() {
    for (const [id, meta] of Object.entries(this.state.installed)) {
      if (!meta.enabled) continue
      try {
        const mod = await this.resolvePluginModule(id)
        if (mod) {
          this.loadedPlugins.set(id, {
            meta,
            mod,
            middleware: mod.createRbacMiddleware 
              ? mod.createRbacMiddleware({ dataDir: DATA_DIR })
              : (mod.createTaskBoardMiddleware ? mod.createTaskBoardMiddleware() : null)
          })
          console.log(`[PluginManager] Loaded plugin '${id}' (${meta.name})`)
        }
      } catch (err) {
        console.warn(`[PluginManager] Could not load plugin '${id}':`, err.message)
      }
    }
  }

  getPlugin(id) {
    return this.loadedPlugins.get(id)
  }

  isPluginEnabled(id) {
    return !!this.state.installed[id]?.enabled
  }

  async setPluginEnabled(id, enabled) {
    if (!this.state.installed[id]) {
      const catalogItem = OFFICIAL_CATALOG.find((c) => c.id === id)
      if (catalogItem) {
        this.state.installed[id] = {
          id: catalogItem.id,
          name: catalogItem.name,
          enabled: false,
          category: catalogItem.category
        }
      } else {
        throw new Error(`Plugin '${id}' not found in catalog`)
      }
    }

    this.state.installed[id].enabled = Boolean(enabled)
    this.saveState()

    if (enabled) {
      const mod = await this.resolvePluginModule(id)
      if (mod) {
        this.loadedPlugins.set(id, {
          meta: this.state.installed[id],
          mod,
          middleware: mod.createRbacMiddleware 
            ? mod.createRbacMiddleware({ dataDir: DATA_DIR })
            : (mod.createTaskBoardMiddleware ? mod.createTaskBoardMiddleware() : null)
        })
      }
    } else {
      this.loadedPlugins.delete(id)
    }

    return this.state.installed[id]
  }

  getStatus() {
    return {
      installed: this.state.installed,
      catalog: OFFICIAL_CATALOG.map((cat) => ({
        ...cat,
        isInstalled: Boolean(this.state.installed[cat.id]),
        isEnabled: Boolean(this.state.installed[cat.id]?.enabled)
      }))
    }
  }

  /**
   * Middleware chain for all active plugins
   */
  async middleware(req, res, next) {
    // 1. RBAC runs first if enabled
    const rbac = this.loadedPlugins.get('rbac')
    if (rbac?.middleware) {
      let rbacHandled = false
      await new Promise((resolve) => {
        rbac.middleware(req, res, () => {
          rbacHandled = true
          resolve()
        })
      })
      if (!rbacHandled) return // RBAC completed response (e.g. 403 Forbidden or /api/rbac/*)
    }

    // 2. Billboard runs next if enabled
    const billboard = this.loadedPlugins.get('billboard')
    if (billboard?.middleware) {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname.startsWith('/api/taskboard')) {
        return billboard.middleware(req, res, next)
      }
    }

    if (typeof next === 'function') next()
  }
}

export const pluginManager = new PluginManager()
await pluginManager.init()
