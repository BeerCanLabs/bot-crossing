# Key Product Flows (KPF.md) — Bot-Crossing

This document maps all core capabilities of **Bot-Crossing** to their entry points, failure impacts, and associated automated test files. It serves as the primary source of truth for product reliability, state persistence, and regression prevention.

---

## 1. Cloud Run Persistent State Hydration (Anti-"50 First Dates" State & RBAC)
- **KPF ID:** `KPF-BC-001`
- **Description:** Containerized Node.js service running on GCP Cloud Run with persistent Cloud Storage FUSE volume mount (`colony-data` mounted at `/app/data`). Preserves RBAC user registry (`rbac-users.json`), colony world layout / plots (`colony.json`), and marketplace plugin configurations (`plugins.json`) across Cloud Run revisions, scale-to-zero cold starts, and container restarts.
- **Entry points:** 
  - Server Storage: `plugins/rbac/server/store.js::RbacStore`, `server/api.mjs`, `server/plugins.mjs`
  - Cloud Infrastructure: GCP Cloud Run volume mount (`gs://submind-matrix-colony-data` mounted to `/app/data`), environment variable `BOT_CROSSING_DATA=/app/data`
- **If it silently breaks:** Cloud Run defaults to ephemeral in-memory container filesystems. Every deployment or scale-to-zero spin-down erases invited users (e.g. Stephanie), permissions reset to "nobody", and colony customizations are lost (the "50 First Dates" bug).
- **Test status:** Automated:
  - `test/persistence-and-hydration.test.mjs` — `"KPF-BC-001: RbacStore re-hydrates invited users and roles across container lifecycle"`
  - `test/persistence-and-hydration.test.mjs` — `"KPF-BC-001: HTTP API persists RBAC configurations across server restarts"`
  - `test/persistence-and-hydration.test.mjs` — `"KPF-BC-001: Colony layout state (colony.json) persists across server restarts"`
  - `test/persistence-and-hydration.test.mjs` — `"KPF-BC-001: Barred users remain barred across re-hydration"`

---

## 2. Role-Based Access Control & Strict Invite-Only Enforcement
- **KPF ID:** `KPF-BC-002`
- **Description:** Multi-user security layer supporting Admin, Agent Manager, and Spectator roles via Cloudflare Zero Trust (`Cf-Access-Authenticated-User-Email` header) or pluggable AuthN. Guarantees strict invite-only colony access (uninvited visitors receive `403 Unauthorized` / empty state), agent-scoping (Agent Managers can only chat/interact with designated agents), and permanent barred email denial.
- **Entry points:**
  - Logic: `plugins/rbac/server/store.js`, `plugins/rbac/server/index.js`, `server/api.mjs::apiMiddleware()`
  - Client UI: `plugins/rbac/client/index.js`
- **If it silently breaks:** Unauthenticated or unauthorized visitors gain visibility into colony agents and transcripts, spectators can modify colony layout/plugins, or barred addresses access colony data.
- **Test status:** Automated:
  - `test/plugins-and-rbac.test.mjs` — `"RBAC: Cloudflare Access email header authenticates user"`
  - `test/plugins-and-rbac.test.mjs` — `"RBAC: Admin can manage roles and assign Agent Manager with specific agents"`
  - `test/plugins-and-rbac.test.mjs` — `"RBAC: Non-admin is rejected from managing roles"`
  - `test/plugins-and-rbac.test.mjs` — `"RBAC: Strict invite-only blocks uninvited visitors from colony data"`
  - `test/plugins-and-rbac.test.mjs` — `"RBAC: Spectator cannot toggle or disable plugins"`
  - `test/plugins-and-rbac.test.mjs` — `"RBAC: Barred email dale@sackrider.com is permanently denied"`

---

## 3. Dynamic Colony Plugin & Marketplace Engine
- **KPF ID:** `KPF-BC-003`
- **Description:** Extensible plugin runtime allowing procedural 3D world elements, custom cards, and server APIs to be dynamically registered, enabled/disabled, and served without modifying upstream Bot-Crossing core code.
- **Entry points:**
  - Manager: `server/plugins.mjs::PluginManager`
  - Endpoints: `/api/plugins`, `/api/plugins/toggle`, `/api/plugins/client-scripts`
  - Client Loader: `src/index.html`
- **If it silently breaks:** Plugins fail to load, third-party extensions crash the server, or client scripts fail to inject into the 3D canvas viewport.
- **Test status:** Automated:
  - `test/plugins-and-rbac.test.mjs` — `"PluginManager reports installed plugins and official catalog"`
  - `test/agent-cards.test.mjs` — `"Agent Cards: reports client script in /api/plugins/client-scripts"`
  - `test/agent-cards.test.mjs` — `"Agent Cards: serves plugin client script directly over /plugins/agent-cards/client/index.js"`

---

## 4. Custom Agent Cards, Interactive Chat & Cron Triggers
- **KPF ID:** `KPF-BC-004`
- **Description:** Modular agent modal replacing generic inspector cards with live submind chat, agent-specific cron routine visualization and manual trigger execution, and deep task backlog integration.
- **Entry points:**
  - Endpoints: `/api/agent-cards/config`, `/api/agent-cards/cron`, `/api/agent-cards/cron/run`, `/api/agent-cards/tasks/create`, `/api/agent-chat`
  - Adapter: `server/harnesses/submind.mjs`
  - Client UI: `plugins/agent-cards/client/index.js`
- **If it silently breaks:** Operators cannot chat with colony agents in the modal, cron routines report empty or fail to trigger manually, or task backlog integrations fail.
- **Test status:** Automated:
  - `test/agent-cards.test.mjs` — `"Agent Cards: returns provider configuration on /api/agent-cards/config"`
  - `test/agent-cards.test.mjs` — `"Agent Cards: queries agent-specific cron routines on /api/agent-cards/cron"`
  - `test/agent-cards.test.mjs` — `"Agent Cards: triggers manual cron execution on /api/agent-cards/cron/run"`
  - `test/agent-cards.test.mjs` — `"Agent Cards: creates task on /api/agent-cards/tasks/create via active provider"`

---

## 5. Autonomous Fleet Discovery & Submind Matrix Aggregation
- **KPF ID:** `KPF-BC-005`
- **Description:** Scans dynamic fleet directories (e.g. Submind Matrix repos, Claude Code sessions, Codex threads, Cursor transcripts) to locate running agents, their worktrees, execution states, and scheduled routines.
- **Entry points:**
  - Harnesses: `server/harnesses/submind.mjs`, `server/harnesses/claude-code.mjs`, `server/harnesses/codex.mjs`, `server/harnesses/cursor.mjs`
  - Scanner: `server/scan.mjs`
- **If it silently breaks:** Agents fail to appear in the colony, astronauts display incorrect status colors, or submind agents are not discovered.
- **Test status:** Automated:
  - `test/harness.test.mjs` (all harness contract and scanner tests)
  - `test/submind.test.mjs` — `"submind exports Content Creation in FUNCTIONAL_DOMAINS"`, `"scanCronJobs aggregates fleet cron schedules"`
  - `test/plugins-and-rbac.test.mjs` — `"RBAC: Dynamic fleet discovery includes Higgins and Submind agents"`

---

## 6. Three-Way State Merge & Multi-Tab Conflict Resolution
- **KPF ID:** `KPF-BC-006`
- **Description:** Pure mathematical three-way merge (`mergeState`) protecting against state clobbering when multiple browser tabs or administrators move buildings, update plots, or alter archive states concurrently.
- **Entry points:**
  - Algorithm: `src/game/merge-state.js::mergeState`
  - Server API: `server/api.mjs::PUT /api/state`
- **If it silently breaks:** Concurrent edits overwrite each other without warning, or stale browser tabs erase changes made by other operators.
- **Test status:** Automated:
  - `test/state.test.mjs` — `"an addition from each tab survives the merge"`
  - `test/state.test.mjs` — `"a removal survives the merge — a plain union would resurrect it"`
  - `test/state.test.mjs` — `"two tabs moving different zones both keep their move"`
  - `test/state.test.mjs` — `"simultaneous saves never 500 — one wins, the rest get a mergeable 409"`
