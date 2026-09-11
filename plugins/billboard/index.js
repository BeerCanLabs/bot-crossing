import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTaskBoardMiddleware } from './server/middleware.js'
import { loadTaskConfig, saveTaskConfig } from './server/config-store.js'
import { PROVIDERS, getProvider } from './server/providers/index.js'

const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * Vite plugin for Bot Crossing Task Board.
 * Automatically attaches API middleware and injects client scripts into the game engine.
 */
export default function taskBoardPlugin(options = {}) {
  return {
    name: 'vite-plugin-bot-crossing-taskboard',

    configureServer(server) {
      server.middlewares.use(createTaskBoardMiddleware())
    },

    configurePreviewServer(server) {
      server.middlewares.use(createTaskBoardMiddleware())
    },

    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: {
              type: 'module',
              src: '/@taskboard/client.js',
            },
            injectTo: 'body',
          },
        ],
      }
    },

    resolveId(id) {
      if (id === '/@taskboard/client.js') {
        return path.join(here, 'client', 'inject.js')
      }
    },
  }
}

export {
  createTaskBoardMiddleware,
  loadTaskConfig,
  saveTaskConfig,
  PROVIDERS,
  getProvider,
}
