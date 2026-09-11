import { createRbacMiddleware } from './server/middleware.js'
import { resolveAuthUser } from './server/authn.js'
import { RbacStore } from './server/store.js'

export default function rbacPlugin(options = {}) {
  return {
    name: 'bot-crossing-rbac',
    serverMiddleware: createRbacMiddleware(options),
    configureServer(server) {
      server.middlewares.use(createRbacMiddleware(options))
    }
  }
}

export {
  createRbacMiddleware,
  resolveAuthUser,
  RbacStore
}
