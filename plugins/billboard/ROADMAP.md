# Bot Crossing Task Board — Roadmap

A pluggable, community-driven 3D operations and task board for [Bot Crossing](https://github.com/Station-Sciences/bot-crossing).

Our mission is to turn the Bot Crossing colony into an active operations deck where human operators and autonomous AI agents coordinate real-world work.

---

## 🎯 Release Milestones

### Phase 1: Foundation (v0.1.0) — *Current*
- [x] **Zero-touch Vite Plugin Architecture**: Drop into any Bot Crossing installation with `plugins: [taskboard()]`.
- [x] **Procedural 3D Billboard**: Dual-sided sci-fi billboard next to the spaceship with live telemetry script, pulsing mast beacon, overhead luminaires, and regolith pylons.
- [x] **In-Flight & Pending Task Hub**: Interactive modal displaying real work cards (status, assignee, repo, and deep links).
- [x] **Configurable Provider Architecture**: User-selected task providers (Notion, GitHub, Jira, Linear, Paperclip, Local TODOs).
- [x] **Settings UI**: In-app configuration form with "Test Connection" and instant persistence to `colony.json`.
- [x] **Cron & Routine Visibility**: Aggregates scheduled agent automations across Cloud Scheduler and local cron.

---

### Phase 2: Ecosystem Task Providers (v0.2.0)
- [ ] **Notion Database Integration**: Full property mapping for custom status, owner, priority, and date columns.
- [ ] **Jira Software Adapter**: JQL support, sprint filtering, and issue transitions.
- [ ] **Linear Adapter**: Real-time team cycle tracking, project state, and issue triage.
- [ ] **Paperclip Company Bridge**: Direct link to Paperclip's company task engine and agent governance budgets.
- [ ] **Local Git/Markdown Watcher**: Zero-config file watcher for `TODO.md`, `TASKS.md`, and `.tasks.json` in repo roots.

---

### Phase 3: Interactive Operations & Bidirectional Control (v0.3.0)
- [ ] **Interactive Task Creation**: Click the billboard to create a new issue or task assigned to a colony agent.
- [ ] **Drag-to-Progress**: Drag cards between `Backlog`, `In Progress`, and `Done` directly from the colony UI.
- [ ] **Agent Dispatch Buttons**: Trigger agent execution or assign a task to an idle astronaut standing in the colony.
- [ ] **Live Telemetry Streams**: Stream agent execution deltas directly onto the 3D billboard surface texture in real time.

---

### Phase 4: World Immersion & Customization (v0.4.0)
- [ ] **Billboard Skins & Themes**:
  - *Classic Sci-Fi* (Cyberpunk Cyan/Amber LED)
  - *Holographic Projection* (Flickering 3D volumetric emitter)
  - *Solar Punk* (Timber pylons with solar-powered monochrome e-ink)
- [ ] **Sound Effects**: Optional sci-fi ambient telemetry hum and task completion chime.
- [ ] **Webhooks & Real-time Push**: WebSocket / Server-Sent Events (SSE) so tasks update instantly without polling.
- [ ] **Multi-Screen Support**: Pop-out task board view for a secondary desk monitor.

---

## 💡 How to Suggest Features
Have an idea or use a task manager not listed here?
Open an issue on [GitHub](https://github.com/BeerCanLabs/bot-crossing-taskboard/issues) or submit a provider PR! See [CONTRIBUTING.md](CONTRIBUTING.md).
