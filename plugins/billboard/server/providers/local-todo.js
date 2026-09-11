import fsp from 'node:fs/promises'
import path from 'node:path'

/**
 * Local file task provider for Bot Crossing Task Board.
 * Reads TODO.md, TASKS.md, or .tasks.json from local project directories.
 */
export default {
  id: 'local-todo',
  name: 'Local TODOs & Markdown',
  description: 'Scans TODO.md, TASKS.md, or .tasks.json in local repository roots.',
  fields: [
    {
      key: 'filename',
      label: 'File to Watch',
      type: 'text',
      placeholder: 'TODO.md (default: checks TODO.md, TASKS.md, .tasks.json)',
      required: false,
    },
  ],

  async test() {
    return { ok: true }
  },

  async fetchTasks(config = {}, context = {}) {
    const projectPaths = context.projectPaths || []
    const tasks = []

    for (const projectDir of projectPaths) {
      if (!projectDir || typeof projectDir !== 'string') continue
      const candidates = config.filename
        ? [config.filename]
        : ['TODO.md', 'todo.md', 'TASKS.md', 'tasks.md', '.tasks.json']

      for (const fname of candidates) {
        const fullPath = path.join(projectDir, fname)
        try {
          const content = await fsp.readFile(fullPath, 'utf8')
          const projectName = path.basename(projectDir)

          if (fname.endsWith('.json')) {
            const parsed = JSON.parse(content)
            const items = Array.isArray(parsed) ? parsed : parsed.tasks || []
            for (const item of items) {
              if (item.done || item.status === 'done') continue
              tasks.push({
                id: `local:${projectName}:${item.id || item.title}`,
                title: item.title || 'Untitled task',
                preview: item.description || '',
                project: projectName,
                assignee: item.assignee || 'Local',
                status: item.inProgress ? 'in_progress' : 'pending',
                priority: item.priority || 'normal',
                url: '',
                source: 'local-todo',
                sourceName: 'Local File',
                updatedAt: Date.now(),
              })
            }
          } else {
            // Markdown parser for - [ ] TODO items
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim()
              const match = line.match(/^-\s*\[([ xX])\]\s*(.+)$/)
              if (match) {
                const isDone = match[1].toLowerCase() === 'x'
                if (isDone) continue
                const taskText = match[2].trim()
                tasks.push({
                  id: `local:${projectName}:${i}`,
                  title: taskText,
                  preview: `${fname}:${i + 1}`,
                  project: projectName,
                  assignee: 'Local Agent',
                  status: 'pending',
                  priority: 'normal',
                  url: '',
                  source: 'local-todo',
                  sourceName: 'TODO.md',
                  updatedAt: Date.now(),
                })
              }
            }
          }
          break // Found a file for this project
        } catch {
          // File not present, try next
        }
      }
    }

    return tasks
  },
}
