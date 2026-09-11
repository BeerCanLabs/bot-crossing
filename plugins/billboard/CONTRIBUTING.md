# Contributing to Bot Crossing Task Board

Thanks for your interest in building with us! We welcome contributions, especially **new task provider adapters**.

---

## 🛠️ Adding a New Task Provider

Adding a provider (e.g., Asana, ClickUp, Monday.com, Trello, GitLab) requires **one new file** in `server/providers/`:

```javascript
// server/providers/my-service.js
export default {
  id: 'my-service',                  // Stable kebab-case key
  name: 'My Service',                // Human-readable name displayed in UI
  
  // Fields required from the user in the Settings UI
  fields: [
    { key: 'apiKey', label: 'API Token', type: 'password', required: true },
    { key: 'workspaceId', label: 'Workspace ID', type: 'text', required: true },
  ],

  /**
   * Test user credentials from the UI.
   * @param {object} config - The values entered by the user
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async test(config) {
    // Ping your service API
    return { ok: true }
  },

  /**
   * Fetch active and pending tasks.
   * @param {object} config - Provider configuration
   * @param {object} context - Colony context ({ repos, agents })
   * @returns {Promise<Task[]>}
   */
  async fetchTasks(config, context) {
    // Query your service and return normalized Task objects
    return [
      {
        id: 'my-service:123',
        title: 'Fix issue with billing pipeline',
        preview: 'Check webhook retries',
        status: 'in_progress', // 'in_progress' | 'pending' | 'blocked' | 'done'
        assignee: 'switch',    // Agent or team member
        project: 'billing',    // Colony repo or project
        url: 'https://myservice.com/tasks/123',
        source: 'my-service',
        updatedAt: Date.now(),
      }
    ]
  }
}
```

Then register your provider in `server/providers/index.js`:
```javascript
import myService from './my-service.js'

export const PROVIDERS = [
  github,
  notion,
  jira,
  linear,
  paperclip,
  localTodo,
  myService, // <-- add here
]
```

That's it! The settings modal will automatically render the input form for your service, test the connection, and pull tasks into the 3D billboard.

---

## 📜 Coding Conventions
- Native ECMAScript Modules (`import` / `export`).
- No bulky dependencies: use native `fetch()`, Node.js built-ins (`fsp`, `path`), or peer dependencies (`three`).
- Clean error handling: if a service call fails, return `{ ok: false, error }` gracefully so the UI stays responsive.
- MIT Licensed.
