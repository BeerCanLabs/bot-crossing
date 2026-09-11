import { createAgentCardsMiddleware } from './server/api.js'

export function createMiddleware(options = {}) {
  return createAgentCardsMiddleware(options)
}

export default createMiddleware
