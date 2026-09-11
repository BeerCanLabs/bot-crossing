import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { scanThreads } from './scan.mjs'

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
  },
  {
    id: 'agent-cards',
    name: 'Custom Agent Cards',
    version: '1.0.0',
    description: 'Custom astronaut cards with interactive chat, cron routine inspection with manual triggers, and task backlog management.',
    author: 'BeerCanLabs',
    category: 'agent-interface',
    icon: '🪪',
    package: '@beercanlabs/bot-crossing-agent-cards',
    repo: 'https://github.com/BeerCanLabs/bot-crossing-plugins/tree/main/packages/agent-cards'
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
        },
        'agent-cards': {
          id: 'agent-cards',
          name: 'Custom Agent Cards',
          enabled: true,
          package: '@beercanlabs/bot-crossing-agent-cards',
          category: 'agent-interface'
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
          const hadNewPlugins = Object.keys(this.state.installed).some((k) => !raw.installed[k])
          this.state.installed = {
            ...this.state.installed,
            ...raw.installed
          }
          if (hadNewPlugins) {
            this.saveState()
          }
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
    if (id === 'agent-cards') {
      try {
        return await import('@beercanlabs/bot-crossing-agent-cards')
      } catch {}
    }

    return null
  }

  createPluginMiddleware(id, mod) {
    if (mod.createRbacMiddleware) {
      return mod.createRbacMiddleware({
        dataDir: DATA_DIR,
        getAgents: async () => {
          try {
            return await scanThreads()
          } catch {
            return []
          }
        }
      })
    }
    if (mod.createTaskBoardMiddleware) {
      return mod.createTaskBoardMiddleware()
    }
    if (mod.createAgentCardsMiddleware || id === 'agent-cards') {
      const fn = mod.createAgentCardsMiddleware || mod.createMiddleware || mod.default
      if (typeof fn === 'function') {
        return fn({ dataDir: DATA_DIR })
      }
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
            middleware: this.createPluginMiddleware(id, mod)
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
          middleware: this.createPluginMiddleware(id, mod)
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

  getClientScripts() {
    const scripts = []
    for (const [id, item] of this.loadedPlugins.entries()) {
      const localClientPath = path.join(LOCAL_PLUGINS_DIR, id, 'client', 'index.js')
      const monorepoClientPath = path.join(here, '..', '..', 'bot-crossing-plugins', 'packages', id, 'client', 'index.js')
      if (fs.existsSync(localClientPath) || fs.existsSync(monorepoClientPath)) {
        scripts.push(`/plugins/${id}/client/index.js`)
      } else if (item.mod?.clientScriptUrl) {
        scripts.push(item.mod.clientScriptUrl)
      }
    }
    return scripts
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

    // 3. Agent Cards runs next if enabled
    const agentCards = this.loadedPlugins.get('agent-cards')
    if (agentCards?.middleware) {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname.startsWith('/api/agent-cards')) {
        return agentCards.middleware(req, res, next)
      }
    }

    if (typeof next === 'function') next()
  }
}

export const pluginManager = new PluginManager()
await pluginManager.init()
