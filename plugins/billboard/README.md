# Bot Crossing Task Board 📋🚀

A standalone, pluggable 3D operations deck and configurable task board for **[Bot Crossing](https://github.com/Station-Sciences/bot-crossing)**.

Turn your agent colony into an active operations center. Watch in-flight tasks rendered dynamically on a procedural 3D billboard next to the spaceship, and configure your agents to report work from **Notion, GitHub Issues, Jira, Linear, Paperclip, or local files**.

---

## ✨ Features

- 🛸 **Procedural 3D Sci-Fi Billboard:** Sits in the regolith to the right of the spaceship with live monospace telemetry script, glowing status lines, and a pulsing cyan mast beacon.
- ⚙️ **User-Configurable Providers:** Choose and configure your work tracker directly inside the colony UI:
  - **GitHub Issues** (open issues, assignees, labels)
  - **Notion** (Databases with custom status & assignee properties)
  - **Jira Software** (Atlassian Cloud active sprints & JQL filters)
  - **Linear** (Team cycles and issues)
  - **Paperclip** (Company tasks & agent governance)
  - **Local Files** (Zero-config watcher for `TODO.md` / `TASKS.md`)
- 🔍 **Real Task Filtering:** Shows real active and pending work tickets rather than just listing idle agents.
- 🔌 **Zero Core Modifications:** Designed as a Vite plugin. It hooks into `window.botCrossing` and Vite middleware with zero changes to upstream Bot Crossing files.

---

## 📦 Quickstart

### 1. Install into your Bot Crossing repository

```bash
npm install github:BeerCanLabs/bot-crossing-taskboard
```

### 2. Register the plugin in `vite.config.js`

Open `vite.config.js` in your Bot Crossing folder:

```javascript
import { defineConfig } from 'vite'
import taskboard from '@beercanlabs/bot-crossing-taskboard'

export default defineConfig({
  plugins: [
    taskboard() // 🚀 Mounts billboard, API, and config UI automatically
  ]
})
```

### 3. Run Bot Crossing

```bash
npm run dev
```

The 3D billboard will rise next to your spaceship. Click the billboard (or the `📋 Tasks` brandbar button, or press <kbd>B</kbd>) to open the board and configure your task provider!

---

## ⚙️ Configuration

Click the **Configure ⚙️** tab on the Task Board to connect your team's tools:

| Provider | Supported Features |
| :--- | :--- |
| **GitHub Issues** | Repositories, PAT auth, label filters, deep links |
| **Notion** | **Zero-Paste**: 1-Click OAuth connect & `/v1/search` automatic database discovery (no UUID copying required) |
| **Jira Software** | Jira Cloud API tokens, JQL queries, sprint tickets |
| **Linear** | Personal API tokens, team filters |
| **Paperclip** | Server URL, company tasks & goals |
| **Local TODOs** | Zero-config scan of `TODO.md` in placed colony repos |

---

## 🗺️ Roadmap

See **[ROADMAP.md](ROADMAP.md)** for upcoming milestones, including interactive task creation, drag-and-drop status changes, real-time webhooks, and custom billboard skins.

---

## 🤝 Contributing

We love community contributions! Want to add support for Asana, ClickUp, Monday.com, or GitLab?
Check out **[CONTRIBUTING.md](CONTRIBUTING.md)** — adding a new task provider is as simple as writing one small adapter file.

---

## 📄 License

MIT © [BeerCanLabs](https://github.com/BeerCanLabs)
