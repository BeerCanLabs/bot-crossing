import github from './github.js'
import notion from './notion.js'
import jira from './jira.js'
import linear from './linear.js'
import paperclip from './paperclip.js'
import localTodo from './local-todo.js'

export const PROVIDERS = [
  github,
  notion,
  jira,
  linear,
  paperclip,
  localTodo,
]

export const providerMap = new Map(PROVIDERS.map((p) => [p.id, p]))

export function getProvider(id) {
  return providerMap.get(id) || null
}
