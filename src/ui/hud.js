import { PRESETS, PLANETS_ORDER } from './hud-data.js'
import { PLANETS } from '../world/planet.js'
import { TIMES, systemTimeOfDay } from '../world/sky.js'
import { STATUS_LABEL } from '../game/colony.js'
import { FACE, FRAME_COLS, FRAME_ROWS } from '../agents/faces.js'
import { PLOT_PALETTE, hashString } from '../world/plots.js'

/**
 * The whole HUD, in plain DOM.
 *
 * Deliberately not a framework: this sits on top of a render loop that must not miss a
 * frame, so the UI only ever touches the DOM when something it shows has actually changed —
 * every setter compares against the last value it wrote and returns early otherwise.
 *
 * The one hard rule is that all of this is optional. Pressing H hides every panel, and the
 * game stays fully readable because status lives above the astronauts' heads in the scene,
 * not in here.
 */

/**
 * The page only ever runs on the machine the server is on — it answers nothing else — so the
 * browser's OS is the server's OS, and the name of the thing that shows a folder can be read
 * here rather than asked for.
 */
const IS_MAC = /Mac/.test(navigator.platform)
const FILE_MANAGER = IS_MAC ? 'Finder' : /Win/.test(navigator.platform) ? 'Explorer' : 'Files'

const ICON = {
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M6.6 6.6C4.06 8.2 2 11 2 11s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-6h5v6"/></svg>`,
  next: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 8.5h3.2l1.5-2h8.6l1.5 2H21v11H3z"/><circle cx="12" cy="14" r="3.4"/></svg>`,
  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.6v.4"/><path d="M12 17h.01"/></svg>`,
  open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18v3H3z"/><path d="M5 9v10h14V9"/><path d="M10 13h4"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.7a8 8 0 0 1-8.5 8 9.3 9.3 0 0 1-2.7-.4L4.5 21l1.4-4.1a7.9 7.9 0 0 1-2.4-5.7A8 8 0 0 1 12 3.6a8 8 0 0 1 8.5 8.1z"/><path d="M12 8.6v5.4M9.3 11.3h5.4"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.4A1.4 1.4 0 0 1 4.4 6h4.2l2 2.5h7A1.4 1.4 0 0 1 19 9.9v7.7a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 17.6z"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>`,
  locate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.6"/><path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6"/></svg>`,
  orbit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10.2" ry="4.6" transform="rotate(-24 12 12)"/><circle cx="21" cy="8.2" r="1.5" fill="currentColor" stroke="none"/></svg>`,
  terminal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  tasks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12l2 2 4-4"/><path d="M9 7h6M9 17h6"/></svg>`,
  shop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
}

const STAT_DEFS = [
  { key: 'working', label: 'building', cls: 'working' },
  { key: 'waiting', label: 'need you', cls: 'waiting' },
  { key: 'blocked', label: 'blocked', cls: 'blocked' },
  { key: 'celebrating', label: 'shipped', cls: 'done' },
  { key: 'agents', label: 'crew', cls: 'idle' },
]

export class Hud {
  constructor(root, settings, actions) {
    this.settings = settings
    this.actions = actions
    this.visible = true
    this._last = {}
    this.hiddenOpen = false
    this.isChatOpen = false
    this.chatThread = null
    this.chatAgent = null
    this.chatAgentName = null
    this.isSending = false
    this.isTaskBoardOpen = false
    this.taskBoardData = { tasks: [], cronjobs: [] }
    this.activeTaskBoardTab = 'tasks'

    this.el = document.createElement('div')
    this.el.className = 'hud'
    this.el.innerHTML = TEMPLATE
    root.appendChild(this.el)

    this.$ = (sel) => this.el.querySelector(sel)

    this._buildStats()
    this._buildSettings()
    this._buildAvatar()
    this._wire()
    this.syncSettings()
  }

  // ── construction ────────────────────────────────────────────────────────────────────

  _buildStats() {
    const wrap = this.$('.stats')
    this.statEls = {}
    for (const def of STAT_DEFS) {
      const b = document.createElement('button')
      b.className = `stat ${def.cls}`
      b.type = 'button'
      b.dataset.key = def.key
      b.title = `Jump to the next ${def.label} astronaut`
      b.innerHTML = `<i class="pip"></i><span class="n">0</span><span class="lbl">${def.label}</span>`
      b.type = 'button'
      b.addEventListener('click', () => this.actions.focusStatus?.(def.key))
      wrap.appendChild(b)
      this.statEls[def.key] = b
    }
  }

  _buildSettings() {
    const body = this.$('.settings .body')
    const s = this.settings
    this.controls = []

    // Quality presets.
    body.appendChild(
      group(
        'Quality preset',
        chips(
          Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, title: p.hint })),
          () => s.get('preset'),
          (id) => s.applyPreset(id),
          this.controls
        )
      )
    )

    // Performance.
    const perf = group('Performance')
    perf.append(
      this._toggle('HDR + bloom', 'bloom', 'Glowing eyes, lamps and windows. The first thing to drop.'),
      this._toggle('Tilt-shift', 'tiltShift', 'A shallow depth of field, which is what makes the colony read as a model.'),
      this._slider(
        'Tilt-shift blur',
        'tiltShiftStrength',
        0,
        1,
        0.05,
        (v) => `${Math.round(v * 100)}%`,
        'Aperture: how shallow the focus is, and how far out of it things go.'
      ),
      this._slider(
        'Tilt-shift angle',
        'tiltShiftAngle',
        -90,
        90,
        1,
        (v) => `${v}°`,
        'Swings the plane of focus, the way tilting a real lens does.'
      ),
      this._select('Shadows', 'shadows', [
        ['off', 'Off'],
        ['low', 'Low'],
        ['high', 'High'],
        ['ultra', 'Ultra'],
      ]),
      this._select('Particles', 'particles', [
        ['off', 'Off'],
        ['low', 'Low'],
        ['full', 'Full'],
      ]),
      this._select('Textures', 'textureQuality', [
        ['low', 'Low'],
        ['medium', 'Medium'],
        ['high', 'High'],
        ['ultra', 'Ultra'],
      ]),
      this._select('Ground detail', 'groundDetail', [
        ['low', 'Low'],
        ['medium', 'Medium'],
        ['high', 'High'],
      ]),
      this._toggle('Anti-aliasing', 'antialias', 'SMAA pass. Cheap, but not free.'),
      this._slider(
        'Render scale',
        'renderScale',
        0.35,
        2,
        0.05,
        (v) => `${Math.round(v * 100)}%`,
        '100% is your display’s own resolution, retina included.'
      ),
      this._toggle('Adaptive quality', 'autoQuality', 'Quietly drops render scale if frames get expensive.'),
      this._slider('Scatter', 'scatterDensity', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`),
      this._slider('Max crew', 'maxAgents', 10, 200, 10, (v) => String(v)),
      this._toggle('Stars', 'stars')
    )
    body.appendChild(perf)

    // World.
    const world = group('Planet')
    const planets = document.createElement('div')
    planets.className = 'planets'
    for (const id of PLANETS_ORDER) {
      const planet = PLANETS[id]
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'planet'
      b.title = planet.blurb
      const c1 = hex(planet.ground.high)
      const c2 = hex(planet.ground.low)
      b.innerHTML = `<i class="orb" style="background:radial-gradient(circle at 33% 30%, ${c1}, ${c2})"></i><span>${planet.name}</span>`
      b.addEventListener('click', () => this.settings.set('planet', id))
      planets.appendChild(b)
      this.controls.push({ el: b, sync: () => b.setAttribute('aria-pressed', String(this.settings.get('planet') === id)) })
    }
    world.appendChild(planets)
    body.appendChild(world)

    // Lighting.
    const light = group('Lighting')
    light.append(
      chips(
        // `Live` is a time of day like the others from where you are standing, so it belongs
        // in the same row rather than in a toggle further down.
        [...TIMES.map((t) => ({ id: t.id, label: t.label })), { id: 'live', label: 'Live' }],
        () => (this.settings.get('clockTime') ? 'live' : nearestTime(this.settings.get('timeOfDay'))),
        (id) => {
          this.settings.set('autoTime', false)
          this.settings.set('clockTime', id === 'live')
          if (id === 'live') this.settings.set('timeOfDay', systemTimeOfDay())
          else this.settings.set('timeOfDay', TIMES.find((t) => t.id === id).value)
        },
        this.controls
      ),
      this._slider('Time of day', 'timeOfDay', 0, 1, 0.005, clockLabel, undefined, () => {
        // Reaching for the slider is a request for a particular light, so stop following the
        // clock — otherwise the next frame would drag the thumb straight back.
        this.settings.set('clockTime', false)
      }),
      this._toggle(
        'Cycle day/night',
        'autoTime',
        'Runs the clock forward on its own. Ignored while the sky is following this machine’s clock.'
      ),
      this._slider('Cycle length', 'dayLength', 30, 900, 30, (v) => `${Math.round(v / 60)}m`),
      this._toggle(
        'Environment light',
        'ibl',
        'Image-based lighting taken from this planet’s own sky. Metals get something to reflect.'
      ),
      this._slider('Environment', 'iblIntensity', 0, 2, 0.05, (v) => v.toFixed(2)),
      this._slider('Exposure', 'exposure', 0.4, 2, 0.05, (v) => v.toFixed(2)),
      this._slider('Bloom', 'bloomStrength', 0, 1.6, 0.02, (v) => v.toFixed(2))
    )
    body.appendChild(light)

    // View.
    const view = group('View')
    view.append(
      this._toggle(
        'Hide dormant repos',
        'hideDormant',
        'Takes a repo off the map when every thread in it has been quiet for three days. Its threads are untouched, and it comes back to the same ground the moment one wakes up.'
      )
    )
    view.append(
      this._toggle('Return to isometric', 'autoFrame', 'Eases the angle back when you stop dragging.'),
      this._slider('Field of view', 'fov', 20, 60, 1, (v) => `${v}°`),
      this._toggle('Project labels', 'showLabels'),
      this._toggle('Reduced motion', 'reducedMotion', 'Calms the bobbing and the camera easing.'),
      this._toggle('Show FPS', 'showFps')
    )
    body.appendChild(view)
  }

  _row(label, hint) {
    const row = document.createElement('div')
    row.className = 'row'
    const l = document.createElement('div')
    l.className = 'label'
    l.innerHTML = `<span>${label}</span>${hint ? `<span class="hint">${hint}</span>` : ''}`
    row.appendChild(l)
    return row
  }

  _toggle(label, key, hint) {
    const row = this._row(label, hint)
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'toggle'
    b.setAttribute('role', 'switch')
    b.addEventListener('click', () => this.settings.set(key, !this.settings.get(key)))
    row.appendChild(b)
    this.controls.push({
      el: row,
      sync: () => {
        b.setAttribute('aria-checked', String(Boolean(this.settings.get(key))))
        row.classList.toggle('overridden', this.settings.isOverridden(key))
      },
    })
    return row
  }

  _select(label, key, options, hint) {
    const row = this._row(label, hint)
    const sel = document.createElement('select')
    sel.className = 'select'
    for (const [value, text] of options) {
      const o = document.createElement('option')
      o.value = value
      o.textContent = text
      sel.appendChild(o)
    }
    sel.addEventListener('change', () => this.settings.set(key, sel.value))
    row.appendChild(sel)
    this.controls.push({
      el: row,
      sync: () => {
        sel.value = String(this.settings.get(key))
        row.classList.toggle('overridden', this.settings.isOverridden(key))
      },
    })
    return row
  }

  _slider(label, key, min, max, step, format, hint, onInput) {
    const row = this._row(label, hint)
    const wrap = document.createElement('div')
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px'
    const input = document.createElement('input')
    input.type = 'range'
    input.className = 'slider'
    input.min = min
    input.max = max
    input.step = step
    const out = document.createElement('span')
    out.className = 'value'
    input.addEventListener('input', () => {
      onInput?.()
      this.settings.set(key, Number(input.value))
    })
    wrap.append(input, out)
    row.appendChild(wrap)
    this.controls.push({
      el: row,
      sync: () => {
        const v = Number(this.settings.get(key))
        // Never fight the thumb the user is dragging.
        if (document.activeElement !== input) input.value = String(v)
        out.textContent = format(v)
        row.classList.toggle('overridden', this.settings.isOverridden(key))
      },
    })
    return row
  }

  /** The little face on the agent card, drawn from the same atlas the astronauts use. */
  _buildAvatar() {
    const canvas = this.$('.thread-pop .avatar canvas')
    canvas.width = 108
    canvas.height = 108
    this.avatarCtx = canvas.getContext('2d')
    this.avatarTmp = document.createElement('canvas')
    this.avatarTmp.width = 108
    this.avatarTmp.height = 108
    this.avatarTmpCtx = this.avatarTmp.getContext('2d')
    this._avatarState = { frame: -1, color: '' }
  }

  _wire() {
    const on = (sel, ev, fn) => this.$(sel).addEventListener(ev, fn)

    on('#btn-settings', 'click', () => this.toggleSettings())
    on('#btn-close-settings', 'click', () => this.toggleSettings(false))
    on('#btn-tasks', 'click', () => this.toggleTaskBoard())
    on('#btn-task-board-close', 'click', () => this.closeTaskBoard())
    on('#btn-task-board-locate', 'click', () => {
      this.closeTaskBoard()
      this.actions.focusBillboard?.()
    })
    on('.task-board-backdrop', 'click', () => this.closeTaskBoard())
    const tbWindow = this.$('.task-board-window')
    if (tbWindow) tbWindow.addEventListener('click', (e) => e.stopPropagation())

    on('#btn-shop', 'click', () => this.toggleShop())
    on('#btn-shop-close', 'click', () => this.closeShop())
    on('#btn-shop-locate', 'click', () => {
      this.closeShop()
      this.actions.focusShop?.()
    })
    on('#shop-backdrop', 'click', () => this.closeShop())

    on('#tab-shop-installed-btn', 'click', () => this.switchShopTab('installed'))
    on('#tab-shop-catalog-btn', 'click', () => this.switchShopTab('catalog'))
    on('#tab-shop-rbac-btn', 'click', () => this.switchShopTab('rbac'))

    on('#tab-tasks-btn', 'click', () => this.switchTaskBoardTab('tasks'))
    on('#tab-cron-btn', 'click', () => this.switchTaskBoardTab('cron'))
    on('#tab-config-btn', 'click', () => this.switchTaskBoardTab('config'))

    const tbTaskList = this.$('#task-board-task-list')
    if (tbTaskList) {
      tbTaskList.addEventListener('click', (e) => {
        if (e.target.closest('#btn-empty-configure')) {
          this.switchTaskBoardTab('config')
          return
        }
        const btn = e.target.closest('button[data-action]')
        if (!btn) return
        const action = btn.dataset.action
        const id = btn.dataset.id
        const agent = btn.dataset.agent
        if (action === 'locate' && id) {
          this.closeTaskBoard()
          this.actions.focusThread?.(id)
        } else if (action === 'open-thread' && id) {
          this.actions.openThreadById?.(id)
        } else if (action === 'chat' && agent) {
          this.closeTaskBoard()
          this.actions.openChatForAgent?.(agent)
        }
      })
    }

    on('#btn-hide', 'click', () => this.toggleUi())
    on('#btn-help', 'click', () => this.toggleHelp())
    on('#btn-shot', 'click', () => this.actions.screenshot?.())
    on('#btn-home', 'click', () => this.actions.resetView?.())
    on('#btn-next', 'click', () => this.actions.focusStatus?.('waiting'))
    on('#btn-orbit', 'click', () => this.setOrbit(this.actions.toggleOrbit?.()))
    on('#btn-planet', 'click', () => this.actions.cyclePlanet?.())
    on('#btn-time', 'click', () => this.actions.cycleTime?.())
    on('#btn-chat', 'click', () => {
      if (this.selected?.thread) this.openChat(this.selected.thread, this.selected.agent)
    })
    on('#btn-chat-close', 'click', () => this.closeChat())
    on('#btn-chat-clear', 'click', () => this.clearChatHistory())
    on('#btn-chat-send', 'click', () => this.sendCurrentChatMessage())
    on('#btn-open', 'click', () => this.actions.openThread?.())
    on('#btn-copy-cli', 'click', () => this.actions.copyCliCommand?.())
    on('.thread-pop .cli-pill', 'click', () => this.actions.copyCliCommand?.())
    on('#btn-viewed', 'click', () => this.actions.markViewed?.())
    on('#btn-archive', 'click', () => this.actions.archiveThread?.())
    on('#btn-deselect', 'click', () => this.actions.select?.(null))
    on('#btn-new-session', 'click', () => this.actions.newConversation?.())
    on('#btn-reveal', 'click', () => this.actions.revealProject?.())
    on('#btn-copy-path', 'click', () => this.actions.copyProjectPath?.())
    on('#btn-hide-project', 'click', () => this.actions.hideProject?.())
    on('#btn-hidden-toggle', 'click', () => this.toggleHiddenList())
    on('#btn-locate', 'click', () => this.actions.focusProject?.(this.project?.name))
    on('#btn-close-project', 'click', () => this.actions.closeProject?.())
    on('.help', 'click', (e) => {
      if (e.target === this.$('.help')) this.toggleHelp(false)
    })
    this.$('.help .sheet').addEventListener('click', (e) => e.stopPropagation())
    on('#btn-help-close', 'click', () => this.toggleHelp(false))

    const chatInput = this.$('#chat-input')
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          this.sendCurrentChatMessage()
        }
      })
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto'
        chatInput.style.height = Math.min(120, chatInput.scrollHeight) + 'px'
      })
    }

    this.el.querySelectorAll('.chat-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const msg = chip.dataset.msg
        if (msg && chatInput) {
          chatInput.value = msg
          this.sendCurrentChatMessage()
        }
      })
    })

    this.settings.onChange(() => this.syncSettings())
  }

  // ── state in ────────────────────────────────────────────────────────────────────────

  syncSettings() {
    for (const c of this.controls) c.sync()
    this.$('.fps').classList.toggle('on', Boolean(this.settings.get('showFps')))
  }

  setStats(stats) {
    for (const def of STAT_DEFS) {
      const n = stats[def.key] ?? 0
      const el = this.statEls[def.key]
      if (this._last['stat:' + def.key] === n) continue
      this._last['stat:' + def.key] = n
      el.querySelector('.n').textContent = String(n)
      el.dataset.empty = String(n === 0)
    }
  }

  /**
   * Every repo, in the sidebar. This was a strip of chips along the bottom of the screen;
   * it is a list now because the sidebar is where all the chrome lives, and because a list
   * can carry a count and an alarm without running out of room at eleven repos.
   */
  setLegend(projects, activeName = null, hidden = [], folded = []) {
    const signature =
      projects.map((p) => `${p.name}:${p.count}:${p.accent}:${p.urgent ? 1 : 0}`).join('|') +
      `~${activeName}~` +
      hidden.map((p) => `${p.name}:${p.count}`).join('|') +
      `~${folded.length}`
    if (this._last.legend === signature) return
    this._last.legend = signature

    const wrap = this.$('.projects')
    wrap.innerHTML = ''
    for (const p of projects) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'repo'
      b.title = `${p.count} thread${p.count === 1 ? '' : 's'} in ${p.name}`
      b.setAttribute('aria-pressed', String(p.name === activeName))
      b.innerHTML =
        `<i class="swatch" style="background:${hex(p.accent)};color:${hex(p.accent)}"></i>` +
        `<span class="n">${escapeHtml(p.name)}</span>` +
        (p.urgent ? '<i class="alarm"></i>' : '') +
        `<span class="count">${p.count}</span>`
      b.addEventListener('click', () => this.actions.pickProject?.(p.name))
      wrap.appendChild(b)
    }
    this.$('.sec-head span').textContent = `${projects.length} repo${projects.length === 1 ? '' : 's'}`

    // The hidden list is its own block at the foot of the sidebar: collapsed by default, because
    // the whole point of hiding a repo is not to look at it.
    const block = this.$('.hidden-block')
    block.hidden = hidden.length === 0 && folded.length === 0
    const hiddenWrap = this.$('.hidden-projects')
    hiddenWrap.innerHTML = ''
    for (const p of hidden) {
      const accent = PLOT_PALETTE[hashString(p.name) % PLOT_PALETTE.length]
      const row = document.createElement('div')
      row.className = 'repo hidden-repo'
      row.innerHTML =
        `<i class="swatch" style="background:${hex(accent)};color:${hex(accent)}"></i>` +
        `<span class="n">${escapeHtml(p.name)}</span>` +
        `<span class="count">${p.count}</span>`
      const show = document.createElement('button')
      show.type = 'button'
      show.className = 'btn ghost show-repo'
      show.title = `Show ${p.name} on the map again`
      show.textContent = 'Show'
      show.addEventListener('click', () => this.actions.unhideProject?.(p.name))
      row.appendChild(show)
      hiddenWrap.appendChild(row)
    }

    // The dormant fold gets one line rather than a row each: it is a setting, not a list of
    // decisions, and the thing worth offering is the way back rather than per-repo control.
    if (folded.length) {
      const n = folded.reduce((sum, p) => sum + p.count, 0)
      const row = document.createElement('div')
      row.className = 'repo hidden-repo folded-note'
      row.innerHTML =
        `<span class="n">${folded.length} quiet repo${folded.length === 1 ? '' : 's'}` +
        `, ${n} thread${n === 1 ? '' : 's'}</span>`
      const show = document.createElement('button')
      show.type = 'button'
      show.className = 'btn ghost show-repo'
      show.title = 'Put dormant repos back on the map'
      show.textContent = 'Show'
      show.addEventListener('click', () => this.settings.set('hideDormant', false))
      row.appendChild(show)
      hiddenWrap.appendChild(row)
    }

    const total = hidden.length + folded.length
    this.$('#btn-hidden-toggle .label').textContent = `${total} off the map`
    this._syncHiddenList()
  }

  toggleHiddenList() {
    this.hiddenOpen = !this.hiddenOpen
    this._syncHiddenList()
  }

  _syncHiddenList() {
    this.$('#btn-hidden-toggle').setAttribute('aria-expanded', String(this.hiddenOpen))
    this.$('.hidden-projects').hidden = !this.hiddenOpen
  }

  /**
   * The project sidebar: what a zone is, and the things you can do to the *repo* rather
   * than to one thread in it. Opened by clicking a zone, its name plate, its legend chip,
   * or any astronaut standing on it.
   */
  setProject(project) {
    const panel = this.$('.side')
    if (!project) {
      this.project = null
      if (this._last.project === null) return
      this._last.project = null
      panel.classList.remove('drilled')
      return
    }

    this.project = project
    // The minute is part of the signature because `ago()` is: without it a repo where
    // nothing is happening keeps whatever "4m ago" it was first drawn with, for as long as
    // you leave the panel open.
    const signature =
      `${project.name}~${project.path}~${project.accent}~${project.selectedId}~${Math.floor(Date.now() / 60000)}~` +
      project.threads.map((t) => `${t.id}:${t.status}:${t.title}:${t.lastActivityAt}`).join('|')
    panel.classList.add('drilled')
    if (this._last.project === signature) return
    this._last.project = signature

    const swatch = this.$('.side .who .swatch')
    swatch.style.background = hex(project.accent)
    swatch.style.color = hex(project.accent) // the halo is `currentColor`
    this.$('.side .name').textContent = project.name
    const path = this.$('.side .path')
    path.textContent = project.path ? shortPath(project.path) : 'folder unknown'
    path.title = project.path || ''
    // Nothing to open a new thread in, and nothing to reveal, without a folder on disk.
    this.$('#btn-new-session').disabled = !project.path
    this.$('#btn-reveal').disabled = !project.path
    this.$('#btn-copy-path').disabled = !project.path

    const n = project.threads.length
    const waiting = project.threads.filter((t) => t.status === 'waiting' || t.status === 'blocked').length
    this.$('.side .threads-head').innerHTML =
      `<span>${n} thread${n === 1 ? '' : 's'}</span>` + (waiting ? `<span class="want">${waiting} need you</span>` : '')

    const list = this.$('.side .threads')
    // A poll rewrites these rows every time a live thread's timestamp moves. Losing your
    // place in a forty-thread repo every fifteen seconds would make the list unusable.
    const scroll = list.scrollTop
    list.innerHTML = ''
    for (const t of project.threads) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `thread ${statusClass(t.status)}`
      b.setAttribute('aria-pressed', String(t.id === project.selectedId))
      b.title = STATUS_LABEL[t.status] || t.status
      b.innerHTML =
        '<i class="pip"></i>' +
        `<span class="t">${escapeHtml(t.title || 'Untitled thread')}</span>` +
        `<span class="when">${ago(t.lastActivityAt)}</span>` +
        (t.worktree ? `<span class="wt">⑂ ${escapeHtml(t.worktree)}</span>` : '')
      b.addEventListener('click', () => this.actions.focusThread?.(t.id))
      list.appendChild(b)
      // A long repo can hide the astronaut you just clicked in the world. Scrolled by hand
      // rather than with `scrollIntoView`, which walks up the ancestors and will happily
      // scroll the *page* — and a page that can scroll at all is one keystroke away from
      // the whole HUD sitting sideways with nothing to put it back.
      if (t.id === project.selectedId && this._scrolledTo !== t.id) {
        this._scrolledTo = t.id
        const row = b
        requestAnimationFrame(() => {
          const top = row.offsetTop
          const bottom = top + row.offsetHeight
          if (top < list.scrollTop) list.scrollTop = top
          else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
        })
      }
    }
    list.scrollTop = scroll
    if (!project.selectedId) this._scrolledTo = null
  }

  /**
   * The selected thread, shown inside the zone sidebar rather than in a panel of its own —
   * one thread and its repo are the same context, and splitting them across the screen made
   * you look in two places to act on one astronaut.
   */
  setSelection(agent, thread) {
    const card = this.$('.thread-pop')
    // Only ever one accent button in the panel: whichever action is the immediate one.
    this.$('#btn-new-session').classList.toggle('primary', !agent || !thread)
    if (!agent || !thread) {
      card.classList.remove('on')
      this.selected = null
      return
    }
    this.selected = { agent, thread }
    card.classList.add('on')

    this.$('.thread-pop .title').textContent = thread.title || 'Untitled thread'
    const status = STATUS_LABEL[agent.status] || agent.status
    const meta = this.$('.thread-pop .meta')
    const bits = [
      `<span class="tag"><i class="swatch" style="background:${hex(agent.trim.getHex())}"></i>${escapeHtml(status)}</span>`,
    ]
    // The repo is the panel's own heading now, so the card says what the *thread* is.
    if (thread.worktree) bits.push(`<span class="tag">⑂ ${escapeHtml(thread.worktree)}</span>`)
    if (thread.gitBranch) bits.push(`<span class="tag">${escapeHtml(thread.gitBranch)}</span>`)
    if (thread.model) bits.push(`<span class="tag">${escapeHtml(shortModel(thread.model))}</span>`)
    bits.push(`<span>${ago(thread.lastActivityAt)}</span>`)
    meta.innerHTML = bits.join('')

    const pct = Math.round((this.actions.progressFor?.(thread.id) ?? 0) * 100)
    this.$('.thread-pop .progress > i').style.width = `${pct}%`
    this.$('.thread-pop .progress > i').style.background = hex(agent.trim.getHex())
    // Measured once per selection rather than per frame: placing the card beside its
    // astronaut needs its size sixty times a second, and asking the layout for it that
    // often is how a HUD starts costing frames.
    this._cardSize = { w: card.offsetWidth, h: card.offsetHeight }
    this.$('#btn-open').disabled = thread.canOpen === false
    const cliBtn = this.$('#btn-copy-cli')
    if (cliBtn) {
      cliBtn.hidden = !thread.cliCommand
      if (thread.cliCommand) {
        cliBtn.title = `Copy CLI resume command: ${thread.cliCommand} (T)`
      }
    }
    const cliPill = this.$('.thread-pop .cli-pill')
    if (cliPill) {
      cliPill.hidden = !thread.cliCommand
      if (thread.cliCommand) {
        this.$('.thread-pop .cli-code').textContent = thread.cliCommand
        cliPill.title = `Click or press T to copy: ${thread.cliCommand}`
      }
    }
    // Only offered when there is something to dismiss. A third button on every card would
    // crowd the two that are always worth having, and "Viewed" on a thread that is not asking
    // for anything is a control with no effect.
    this.$('#btn-viewed').hidden = !thread.unread
  }

  /**
   * Put the thread card beside its own astronaut, in screen space, every frame.
   *
   * `screen` is where the astronaut is right now, in CSS pixels, or null when it is behind
   * the camera. The card prefers the astronaut's right, flips to its left rather than slide
   * under the sidebar, and never leaves the window — so it stays reachable at any zoom
   * without ever covering the thing it is describing.
   */
  placeCard(screen) {
    const el = this.$('.thread-pop')
    if (!screen || !this.selected) {
      if (this._cardOn) {
        this._cardOn = false
        el.classList.remove('on')
      }
      return
    }
    const size = this._cardSize || { w: 280, h: 150 }
    const margin = 12
    const gap = 26
    const rightWall = window.innerWidth - margin - (this._sideWidth || 0)

    let flip = false
    let left = screen.x + gap
    if (left + size.w > rightWall) {
      left = screen.x - gap - size.w
      flip = true
      // Nowhere to go on either side — sit over the middle rather than off the edge.
      if (left < margin) left = Math.min(Math.max(margin, screen.x - size.w / 2), rightWall - size.w)
    }
    const top = Math.min(Math.max(margin, screen.y - size.h / 2), window.innerHeight - margin - size.h)

    if (!this._cardOn) {
      this._cardOn = true
      el.classList.add('on')
    }
    // Whole pixels, and only when it actually moved: a transform written every frame with a
    // fractional delta is a repaint the compositor cannot skip.
    const x = Math.round(left)
    const y = Math.round(top)
    if (x !== this._cardX || y !== this._cardY) {
      this._cardX = x
      this._cardY = y
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }
    // The nib points back at the astronaut, so it changes sides with the card.
    if (flip !== this._cardFlip) {
      this._cardFlip = flip
      el.classList.toggle('flip', flip)
    }
    // And it tracks the astronaut vertically when the card has been pushed off-centre.
    const nib = Math.min(Math.max(14, screen.y - y), size.h - 14)
    if (nib !== this._cardNib) {
      this._cardNib = nib
      el.style.setProperty('--nib-y', `${Math.round(nib)}px`)
    }
  }

  /** How much of the right-hand edge the sidebar is taking, so the card can avoid it. */
  setSideWidth(px) {
    this._sideWidth = px
  }

  /** Redraw the card's face so it blinks in step with the astronaut it belongs to. */
  updateAvatar(faceAtlasCanvas) {
    if (!this.selected || !faceAtlasCanvas) return
    const agent = this.selected.agent
    const frame = agent.faceFrame ?? FACE.idle
    const color = agent.eye
    const css = cssFromGlow(color)
    if (this._avatarState.frame === frame && this._avatarState.color === css) return
    this._avatarState = { frame, color: css }

    const size = 108
    const cell = faceAtlasCanvas.width / FRAME_COLS
    const sx = (frame % FRAME_COLS) * cell
    const sy = Math.floor(frame / FRAME_COLS) * (faceAtlasCanvas.height / FRAME_ROWS)

    // The atlas is an opaque white-on-black mask, so the tint is a `multiply`, not a
    // `source-in`: black stays black and the white features take the eye colour. Keying on
    // alpha instead would flood the whole cell, because every pixel in it is opaque.
    const t = this.avatarTmpCtx
    t.globalCompositeOperation = 'source-over'
    t.clearRect(0, 0, size, size)
    t.drawImage(faceAtlasCanvas, sx, sy, cell, cell, 0, 0, size, size)
    t.globalCompositeOperation = 'multiply'
    t.fillStyle = css
    t.fillRect(0, 0, size, size)
    t.globalCompositeOperation = 'source-over'

    const c = this.avatarCtx
    c.fillStyle = '#06070c'
    c.fillRect(0, 0, size, size)
    c.drawImage(this.avatarTmp, 0, 0)
    // Scanlines, so the card's face reads as the same little screen as the one in the world.
    c.globalAlpha = 0.2
    c.fillStyle = '#000'
    for (let y = 0; y < size; y += 3) c.fillRect(0, y, size, 1)
    c.globalAlpha = 1
  }

  setFps(perf, viewport, extra) {
    if (!this.settings.get('showFps')) return
    const el = this.$('.fps')
    const fps = Math.round(perf.fps)
    if (this._last.fps === fps && this._last.calls === perf.drawCalls) return
    this._last.fps = fps
    this._last.calls = perf.drawCalls
    el.innerHTML =
      `<b>${fps}</b> fps · ${perf.frameMs.toFixed(1)} ms<br>` +
      `${perf.drawCalls} draws · ${(perf.triangles / 1000).toFixed(0)}k tris<br>` +
      // The setting is a share of the display, so the readout is too — otherwise a retina
      // machine sitting exactly on the 100% slider reads back "200%".
      `${viewport.bw}×${viewport.bh} (${Math.round((viewport.scale / (window.devicePixelRatio || 1)) * 100)}%)` +
      (extra ? `<br>${extra}` : '')
  }

  hint(text, ms = 3200) {
    const el = this.$('.hint-pill')
    el.textContent = text
    el.classList.add('on')
    clearTimeout(this._hintTimer)
    this._hintTimer = setTimeout(() => el.classList.remove('on'), ms)
  }

  toast(message, kind = '') {
    const el = document.createElement('div')
    el.className = `toast panel ${kind}`
    el.textContent = message
    this.$('.toasts').appendChild(el)
    setTimeout(() => {
      el.classList.add('leaving')
      setTimeout(() => el.remove(), 260)
    }, 3600)
  }

  // ── visibility ──────────────────────────────────────────────────────────────────────

  /** Reflect orbit mode on the rail button. */
  setOrbit(on) {
    this.$('#btn-orbit').setAttribute('aria-pressed', String(Boolean(on)))
  }

  toggleSettings(force) {
    const panel = this.$('.settings')
    const open = force ?? panel.classList.contains('closed')
    panel.classList.toggle('closed', !open)
    this.$('#btn-settings').setAttribute('aria-pressed', String(open))
    // Both live in the same slot on the right; the sidebar steps aside rather than hides.
    this.$('.side').classList.toggle('shifted', open)
  }

  toggleHelp(force) {
    const el = this.$('.help')
    const open = force ?? !el.classList.contains('open')
    el.classList.toggle('open', open)
  }

  /**
   * Dismiss everything. This is the mode the game is really meant to be left in — the
   * colony carries its own state above the astronauts' heads, so the panels are for
   * setting things up, not for playing.
   */
  toggleUi(force) {
    this.visible = force ?? !this.visible
    this.el.classList.toggle('hidden', !this.visible)
    this.$('#btn-hide').innerHTML = this.visible ? ICON.eye : ICON.eyeOff
    this.actions.uiVisibility?.(this.visible)
    if (!this.visible) this.toggleHelp(false)
    return this.visible
  }

  openTaskBoard() {
    this.isTaskBoardOpen = true
    const modal = this.$('#task-board-modal')
    if (modal) {
      modal.classList.add('open')
      this.renderTaskBoard()
    }
  }

  closeTaskBoard() {
    this.isTaskBoardOpen = false
    const modal = this.$('#task-board-modal')
    if (modal) {
      modal.classList.remove('open')
    }
  }

  toggleTaskBoard(force) {
    const next = force ?? !this.isTaskBoardOpen
    if (next) this.openTaskBoard()
    else this.closeTaskBoard()
  }

  switchTaskBoardTab(tab) {
    this.activeTaskBoardTab = tab
    const tabTasksBtn = this.$('#tab-tasks-btn')
    const tabCronBtn = this.$('#tab-cron-btn')
    const tabConfigBtn = this.$('#tab-config-btn')
    const paneTasks = this.$('#pane-tasks')
    const paneCron = this.$('#pane-cron')
    const paneConfig = this.$('#pane-config')

    tabTasksBtn?.classList.toggle('active', tab === 'tasks')
    tabCronBtn?.classList.toggle('active', tab === 'cron')
    tabConfigBtn?.classList.toggle('active', tab === 'config')

    if (paneTasks) paneTasks.style.display = tab === 'tasks' ? 'block' : 'none'
    if (paneCron) paneCron.style.display = tab === 'cron' ? 'block' : 'none'
    if (paneConfig) paneConfig.style.display = tab === 'config' ? 'block' : 'none'

    if (tab === 'config') {
      this.renderTaskBoardConfig()
    } else {
      this.renderTaskBoard()
    }
  }

  setAuthBadge(data) {
    const brandbar = this.$('.brandbar')
    if (!brandbar || document.getElementById('user-rbac-pill')) return
    const pill = document.createElement('div')
    pill.id = 'user-rbac-pill'
    pill.style.cssText = `
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 9999px;
      background: rgba(255,255,255,0.06);
      border: 1px solid ${data.role === 'admin' ? '#00e5ff' : data.role === 'agent_manager' ? '#ffa726' : '#94a3b8'};
      color: ${data.role === 'admin' ? '#00e5ff' : data.role === 'agent_manager' ? '#ffa726' : '#94a3b8'};
      margin-left: 8px;
      font-family: monospace;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
    `
    pill.title = `Logged in as ${data.user?.email || 'Guest'} (${data.role.toUpperCase()}) — Click to open RBAC`
    pill.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;"></span><span>${data.user?.email?.split('@')[0] || 'User'}</span><span style="opacity:0.6;font-size:9px;">[${data.role}]</span>`
    pill.addEventListener('click', () => {
      this.openShop()
      this.switchShopTab('rbac')
    })
    const tasksBtn = this.$('#btn-tasks')
    if (tasksBtn) brandbar.insertBefore(pill, tasksBtn)
    else brandbar.appendChild(pill)
  }

  openShop() {
    this.isShopOpen = true
    const modal = this.$('#shop-modal')
    if (modal) {
      modal.classList.add('open')
      this.switchShopTab(this.activeShopTab || 'installed')
    }
  }

  closeShop() {
    this.isShopOpen = false
    const modal = this.$('#shop-modal')
    if (modal) {
      modal.classList.remove('open')
    }
  }

  toggleShop(force) {
    const next = force ?? !this.isShopOpen
    if (next) this.openShop()
    else this.closeShop()
  }

  switchShopTab(tab) {
    this.activeShopTab = tab
    const tabInstalledBtn = this.$('#tab-shop-installed-btn')
    const tabCatalogBtn = this.$('#tab-shop-catalog-btn')
    const tabRbacBtn = this.$('#tab-shop-rbac-btn')
    const paneInstalled = this.$('#pane-shop-installed')
    const paneCatalog = this.$('#pane-shop-catalog')
    const paneRbac = this.$('#pane-shop-rbac')

    tabInstalledBtn?.classList.toggle('active', tab === 'installed')
    tabCatalogBtn?.classList.toggle('active', tab === 'catalog')
    tabRbacBtn?.classList.toggle('active', tab === 'rbac')

    if (paneInstalled) paneInstalled.style.display = tab === 'installed' ? 'block' : 'none'
    if (paneCatalog) paneCatalog.style.display = tab === 'catalog' ? 'block' : 'none'
    if (paneRbac) paneRbac.style.display = tab === 'rbac' ? 'block' : 'none'

    if (tab === 'installed') this.renderShopInstalled()
    else if (tab === 'catalog') this.renderShopCatalog()
    else if (tab === 'rbac') this.renderShopRbac()
  }

  async renderShopInstalled() {
    const list = this.$('#shop-installed-list')
    if (!list) return
    list.innerHTML = `<div style="color: #94a3b8;">Loading installed plugins...</div>`
    try {
      const res = await fetch('/api/plugins')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const installed = Object.values(data.installed || {})

      const countBadge = this.$('#shop-installed-count')
      if (countBadge) countBadge.textContent = String(installed.length)

      if (installed.length === 0) {
        list.innerHTML = `<div style="color: #94a3b8; padding: 24px; text-align: center;">No plugins installed. Check the Addon Catalog!</div>`
        return
      }

      list.innerHTML = installed.map((p) => `
        <div style="background: rgba(22, 27, 38, 0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 16px; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
          <div style="display: flex; gap: 14px; align-items: center;">
            <div style="font-size: 28px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.04); border-radius: 8px;">
              ${p.id === 'billboard' ? '📋' : p.id === 'rbac' ? '🛡️' : '🔌'}
            </div>
            <div>
              <div style="font-size: 15px; font-weight: 600; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
                ${escapeHtml(p.name)}
                <span style="font-size: 10px; font-family: monospace; padding: 2px 6px; border-radius: 4px; background: ${p.enabled ? 'rgba(74,222,128,0.15)' : 'rgba(148,163,184,0.15)'}; color: ${p.enabled ? '#4ade80' : '#94a3b8'};">
                  ${p.enabled ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
                ${p.id === 'billboard' ? '3D Task Board Billboard & Work Tracker' : p.id === 'rbac' ? 'Multi-user role access control & Cloudflare Zero Trust' : 'Colony Extension Plugin'}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            ${p.id === 'billboard' ? `<button class="btn small ghost" id="btn-cfg-billboard-link">Configure ⚙️</button>` : ''}
            ${p.id === 'rbac' ? `<button class="btn small ghost" id="btn-cfg-rbac-link">Manage Users 👤</button>` : ''}
            <button class="btn small ${p.enabled ? 'danger' : 'primary'}" data-toggle-plugin="${p.id}" data-enabled="${p.enabled ? 'true' : 'false'}">
              ${p.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>
      `).join('')

      list.querySelectorAll('button[data-toggle-plugin]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.togglePlugin
          const currentlyEnabled = btn.dataset.enabled === 'true'
          btn.disabled = true
          btn.textContent = 'Updating...'
          try {
            const toggleRes = await fetch('/api/plugins/toggle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, enabled: !currentlyEnabled })
            })
            if (toggleRes.ok) {
              if (id === 'billboard' && window.botCrossing?.colony) {
                window.botCrossing.colony.setTaskBoardVisible(!currentlyEnabled)
              }
              this.renderShopInstalled()
            }
          } catch (err) {
            alert('Failed to toggle plugin: ' + err.message)
          }
        })
      })

      list.querySelector('#btn-cfg-billboard-link')?.addEventListener('click', () => {
        this.closeShop()
        this.openTaskBoard()
        this.switchTaskBoardTab('config')
      })

      list.querySelector('#btn-cfg-rbac-link')?.addEventListener('click', () => {
        this.switchShopTab('rbac')
      })

    } catch (err) {
      list.innerHTML = `<div style="color: #ef4444;">Failed to load plugins: ${escapeHtml(err.message)}</div>`
    }
  }

  async renderShopCatalog() {
    const list = this.$('#shop-catalog-list')
    if (!list) return
    list.innerHTML = `<div style="color: #94a3b8;">Loading plugin registry...</div>`
    try {
      const res = await fetch('/api/plugins')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const catalog = data.catalog || []

      list.innerHTML = `
        <div style="font-size: 13px; color: #94a3b8; margin-bottom: 8px;">
          Official plugins from <a href="https://github.com/BeerCanLabs/bot-crossing-plugins" target="_blank" style="color: #ffa726; text-decoration: underline;">BeerCanLabs/bot-crossing-plugins</a>.
        </div>
        ${catalog.map((cat) => `
          <div style="background: rgba(22, 27, 38, 0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 16px; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
            <div style="display: flex; gap: 14px; align-items: center;">
              <div style="font-size: 28px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.04); border-radius: 8px;">
                ${cat.icon || '🔌'}
              </div>
              <div>
                <div style="font-size: 15px; font-weight: 600; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
                  ${escapeHtml(cat.name)}
                  <span style="font-size: 10px; font-family: monospace; padding: 2px 6px; border-radius: 4px; background: rgba(255,167,38,0.15); color: #ffa726;">
                    v${cat.version}
                  </span>
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; max-width: 480px;">
                  ${escapeHtml(cat.description)}
                </div>
              </div>
            </div>
            <div>
              <span style="font-size: 12px; font-weight: 600; color: #4ade80; background: rgba(74,222,128,0.12); padding: 5px 12px; border-radius: 6px;">
                ✓ AVAILABLE
              </span>
            </div>
          </div>
        `).join('')}
      `
    } catch (err) {
      list.innerHTML = `<div style="color: #ef4444;">Failed to load catalog: ${escapeHtml(err.message)}</div>`
    }
  }

  async renderShopRbac() {
    const pane = this.$('#shop-rbac-list')
    if (!pane) return
    pane.innerHTML = `<div style="color: #94a3b8;">Loading RBAC settings...</div>`

    try {
      const [meRes, usersRes] = await Promise.all([
        fetch('/api/rbac/me'),
        fetch('/api/rbac/users')
      ])

      if (!meRes.ok) {
        pane.innerHTML = `<div style="color: #94a3b8; padding: 20px;">RBAC is currently disabled or unreachable. Enable it in the Installed Addons tab.</div>`
        return
      }

      const me = await meRes.json()
      if (!usersRes.ok) {
        pane.innerHTML = `
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 16px; color: #fca5a5;">
            <strong>Access Restricted:</strong> You are logged in as <code>${me.user?.email}</code> with role <code>${me.role}</code>. Only administrators can view and edit user roles.
          </div>
        `
        return
      }

      const { defaultRole, users } = await usersRes.json()
      const userList = Object.entries(users || {})
      const availableAgents = ['sm-castle', 'sm-donna', 'sm-archie', 'sm-switch', 'sm-geordi', 'sm-draftsman']

      pane.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
          <div>
            <div style="font-size: 14px; font-weight: 600; color: #f1f5f9;">Current User Identity</div>
            <div style="font-size: 12px; color: #38bdf8; font-family: monospace; margin-top: 2px;">
              ${escapeHtml(me.user?.email)} <span style="color: #ffa726;">(${me.role.toUpperCase()})</span>
            </div>
          </div>
          <div style="font-size: 12px; color: #94a3b8;">
            Default Unregistered Role: <strong style="color: #e2e8f0; text-transform: capitalize;">${escapeHtml(defaultRole)}</strong>
          </div>
        </div>

        <div style="margin-top: 8px;">
          <h3 style="font-size: 14px; color: #f1f5f9; margin-bottom: 10px;">User Role Directory (3 Roles)</h3>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left; color: #94a3b8;">
                  <th style="padding: 8px;">User Email</th>
                  <th style="padding: 8px;">Role</th>
                  <th style="padding: 8px;">Assigned Agents</th>
                  <th style="padding: 8px; text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${userList.map(([email, info]) => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 10px 8px; font-family: monospace; color: #e2e8f0;">${escapeHtml(email)}</td>
                    <td style="padding: 10px 8px;">
                      <select class="user-role-select" data-email="${escapeHtml(email)}" style="background: #0f172a; border: 1px solid rgba(80,200,255,0.3); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                        <option value="admin" ${info.role === 'admin' ? 'selected' : ''}>Admin (Full Control)</option>
                        <option value="agent_manager" ${info.role === 'agent_manager' ? 'selected' : ''}>Agent Manager</option>
                        <option value="spectator" ${info.role === 'spectator' ? 'selected' : ''}>Spectator (Read-Only)</option>
                      </select>
                    </td>
                    <td style="padding: 10px 8px;">
                      ${info.role === 'admin' ? '<span style="color: #00e5ff;">All Agents (*)</span>' : info.role === 'spectator' ? '<span style="color: #64748b;">None (Read-Only)</span>' : `
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                          ${availableAgents.map((ag) => `
                            <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #cbd5e1; cursor: pointer;">
                              <input type="checkbox" class="agent-check" data-email="${escapeHtml(email)}" data-agent="${ag}" ${(info.allowedAgents || []).includes(ag) ? 'checked' : ''} />
                              ${ag.replace(/^sm-/, '')}
                            </label>
                          `).join('')}
                        </div>
                      `}
                    </td>
                    <td style="padding: 10px 8px; text-align: right;">
                      <button class="btn small primary btn-save-user" data-email="${escapeHtml(email)}" style="margin-right: 6px;">Save</button>
                      <button class="btn small danger btn-del-user" data-email="${escapeHtml(email)}">${ICON.trash || 'Delete'}</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 14px; margin-top: 12px;">
          <h4 style="font-size: 13px; color: #f1f5f9; margin-bottom: 10px;">Add New User</h4>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <input type="email" id="new-user-email" placeholder="user@domain.com" style="background: #0f172a; border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; flex: 1; min-width: 200px;" />
            <select id="new-user-role" style="background: #0f172a; border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px;">
              <option value="spectator">Spectator (Read-Only)</option>
              <option value="agent_manager">Agent Manager</option>
              <option value="admin">Admin</option>
            </select>
            <button class="btn small primary" id="btn-add-user">Add User</button>
          </div>
        </div>
      `

      // Wire save buttons
      pane.querySelectorAll('.btn-save-user').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const email = btn.dataset.email
          const roleSelect = pane.querySelector(`.user-role-select[data-email="${email}"]`)
          const role = roleSelect?.value || 'spectator'
          const checks = pane.querySelectorAll(`.agent-check[data-email="${email}"]:checked`)
          const allowedAgents = Array.from(checks).map((c) => c.dataset.agent)

          btn.disabled = true
          btn.textContent = 'Saving...'
          try {
            const saveRes = await fetch('/api/rbac/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, role, allowedAgents })
            })
            if (saveRes.ok) {
              this.renderShopRbac()
            } else {
              const err = await saveRes.json()
              alert('Error: ' + err.error)
              btn.disabled = false
              btn.textContent = 'Save'
            }
          } catch (e) {
            alert('Failed: ' + e.message)
            btn.disabled = false
            btn.textContent = 'Save'
          }
        })
      })

      // Wire delete buttons
      pane.querySelectorAll('.btn-del-user').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const email = btn.dataset.email
          if (!confirm(`Revoke all access for ${email}?`)) return
          try {
            await fetch(`/api/rbac/users?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
            this.renderShopRbac()
          } catch (e) {
            alert('Failed: ' + e.message)
          }
        })
      })

      // Wire Add User
      pane.querySelector('#btn-add-user')?.addEventListener('click', async () => {
        const emailInput = pane.querySelector('#new-user-email')
        const roleSelect = pane.querySelector('#new-user-role')
        const email = emailInput?.value?.trim()
        const role = roleSelect?.value || 'spectator'
        if (!email) return alert('Please enter a valid user email')

        try {
          const addRes = await fetch('/api/rbac/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, role, allowedAgents: [] })
          })
          if (addRes.ok) {
            this.renderShopRbac()
          } else {
            const err = await addRes.json()
            alert('Error: ' + err.error)
          }
        } catch (e) {
          alert('Failed: ' + e.message)
        }
      })

    } catch (err) {
      pane.innerHTML = `<div style="color: #ef4444;">Failed to load RBAC: ${escapeHtml(err.message)}</div>`
    }
  }

  updateTaskBoard(data) {
    if (!data) return
    this.taskBoardData = data
    const taskCount = this.taskBoardData.tasks?.length || 0
    const cronCount = this.taskBoardData.cronjobs?.length || 0

    const taskBadge = this.$('#task-count-badge')
    if (taskBadge) taskBadge.textContent = String(taskCount)
    const cronBadge = this.$('#cron-count-badge')
    if (cronBadge) cronBadge.textContent = String(cronCount)

    if (this.isTaskBoardOpen) {
      this.renderTaskBoard()
    }
  }

  async renderTaskBoardConfig() {
    const configPane = this.$('#task-board-config-list')
    if (!configPane) return

    configPane.innerHTML = `<div style="padding: 24px; color: #94a3b8;">Loading provider configuration...</div>`
    try {
      const res = await fetch('/api/taskboard/config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { config, providers } = await res.json()
      const activeId = config?.active || 'github'
      const savedProviders = config?.providers || {}

      configPane.innerHTML = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px 0; display: flex; flex-direction: column; gap: 18px;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 13px; font-weight: 600; color: #cbd5e1;">Select Task Provider</label>
            <select id="cfg-provider-select" style="background: #0f172a; border: 1px solid rgba(80,200,255,0.3); color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 13px;">
              ${providers.map((p) => `<option value="${p.id}" ${p.id === activeId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div id="cfg-provider-desc" style="font-size: 13px; color: #94a3b8;"></div>
          <div id="cfg-fields-container" style="display: flex; flex-direction: column; gap: 14px;"></div>
          <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px;">
            <button type="button" class="btn small" id="btn-cfg-test">Test Connection</button>
            <button type="button" class="btn primary small" id="btn-cfg-save">Save Settings</button>
            <span id="cfg-status-msg" style="font-size: 13px;"></span>
          </div>
        </div>
      `

      const select = configPane.querySelector('#cfg-provider-select')
      const descEl = configPane.querySelector('#cfg-provider-desc')
      const fieldsContainer = configPane.querySelector('#cfg-fields-container')
      const testBtn = configPane.querySelector('#btn-cfg-test')
      const saveBtn = configPane.querySelector('#btn-cfg-save')
      const statusMsg = configPane.querySelector('#cfg-status-msg')

      const renderFields = () => {
        const curId = select.value
        const provider = providers.find((p) => p.id === curId)
        if (!provider) return
        descEl.textContent = provider.description || ''
        const currentVals = savedProviders[curId] || {}
        fieldsContainer.innerHTML = (provider.fields || []).map((f) => `
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 13px; font-weight: 500; color: #cbd5e1;">
              ${escapeHtml(f.label)} ${f.required ? '<span style="color:#ef4444">*</span>' : ''}
            </label>
            <input
              id="cfg-field-${f.key}"
              data-key="${f.key}"
              type="${f.type || 'text'}"
              placeholder="${escapeHtml(f.placeholder || '')}"
              value="${escapeHtml(currentVals[f.key] || '')}"
              style="background: #0f172a; border: 1px solid rgba(80,200,255,0.25); color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 13px;"
            />
          </div>
        `).join('')
      }

      select.addEventListener('change', renderFields)
      renderFields()

      const getInputs = () => {
        const vals = {}
        fieldsContainer.querySelectorAll('input').forEach((i) => {
          vals[i.dataset.key] = i.value
        })
        return vals
      }

      testBtn.addEventListener('click', async () => {
        statusMsg.style.color = '#94a3b8'
        statusMsg.textContent = 'Testing...'
        try {
          const res = await fetch('/api/taskboard/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId: select.value, config: getInputs() }),
          })
          const data = await res.json()
          if (data.ok) {
            statusMsg.style.color = '#4ade80'
            statusMsg.textContent = `✓ Connected${data.user ? ` (${data.user})` : ''}!`
          } else {
            statusMsg.style.color = '#f87171'
            statusMsg.textContent = `✕ Failed: ${data.error}`
          }
        } catch (err) {
          statusMsg.style.color = '#f87171'
          statusMsg.textContent = `✕ ${err.message}`
        }
      })

      saveBtn.addEventListener('click', async () => {
        statusMsg.style.color = '#94a3b8'
        statusMsg.textContent = 'Saving...'
        const updatedConfig = {
          active: select.value,
          providers: {
            ...savedProviders,
            [select.value]: getInputs(),
          },
        }
        try {
          const res = await fetch('/api/taskboard/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedConfig),
          })
          if (res.ok) {
            statusMsg.style.color = '#4ade80'
            statusMsg.textContent = '✓ Saved!'
            this.toast('Task provider settings saved!')
            const tasksRes = await fetch('/api/tasks').then((r) => r.json()).catch(() => null)
            if (tasksRes) {
              this.updateTaskBoard(tasksRes)
            }
          } else {
            statusMsg.style.color = '#f87171'
            statusMsg.textContent = '✕ Save failed'
          }
        } catch (err) {
          statusMsg.style.color = '#f87171'
          statusMsg.textContent = `✕ ${err.message}`
        }
      })
    } catch (err) {
      configPane.innerHTML = `<div style="padding: 24px; color: #f87171;">Failed to load config: ${escapeHtml(err.message)}</div>`
    }
  }

  renderTaskBoard() {
    const taskListEl = this.$('#task-board-task-list')
    const cronListEl = this.$('#task-board-cron-list')

    if (this.activeTaskBoardTab === 'tasks' && taskListEl) {
      const tasks = this.taskBoardData.tasks || []
      if (tasks.length === 0) {
        const providerName = this.taskBoardData.providerName || 'your configured task provider'
        taskListEl.innerHTML = `
          <div class="task-board-empty">
            <div class="empty-glyph">✓</div>
            <h3>All systems nominal</h3>
            <p>No active tasks in ${escapeHtml(providerName)}. The crew is standing by at their plots.</p>
            <button type="button" class="btn primary small" id="btn-empty-configure" style="margin-top: 14px;">Configure Task Provider ⚙️</button>
          </div>
        `
      } else {
        taskListEl.innerHTML = tasks
          .map((t) => {
            const rawAgent = t.agent || t.harness || 'agent'
            const agentName = rawAgent.charAt(0).toUpperCase() + rawAgent.slice(1)
            const color = getAgentColor(rawAgent)
            const initial = getAgentInitial(agentName)
            const status = t.running ? 'working' : t.unread ? 'waiting' : t.hasError ? 'blocked' : 'active'
            const statusLabel = t.running ? 'WORKING ⚒' : t.unread ? 'WAITING ON YOU ❓' : t.hasError ? 'BLOCKED ⚠️' : 'ACTIVE'
            const canChat = t.harness === 'submind'

            return `
              <div class="task-card">
                <div class="task-card-header">
                  <div class="task-agent-meta">
                    <span class="agent-avatar-circle" style="background:${color}">${initial}</span>
                    <div class="agent-labels">
                      <span class="agent-name">${escapeHtml(agentName)}</span>
                      <span class="agent-domain">${escapeHtml(t.project || 'Colony')}</span>
                    </div>
                  </div>
                  <span class="task-status-pill ${status}"><i class="pulse-dot"></i>${statusLabel}</span>
                </div>
                <div class="task-card-title">${escapeHtml(t.title || 'Untitled task')}</div>
                ${t.preview ? `<div class="task-card-preview">${escapeHtml(t.preview)}</div>` : ''}
                <div class="task-card-footer">
                  <span class="harness-badge">${escapeHtml(t.harnessName || t.harness || '')}</span>
                  <div class="task-card-actions">
                    <button type="button" class="btn small" data-action="locate" data-id="${t.id}">${ICON.locate} Locate</button>
                    ${t.url ? `<a class="btn small primary" href="${t.url}" target="_blank" rel="noopener noreferrer">${ICON.open} Open Task</a>` : ''}
                    ${canChat ? `<button type="button" class="btn small" data-action="chat" data-agent="${rawAgent}">${ICON.chat} Chat</button>` : ''}
                  </div>
                </div>
              </div>
            `
          })
          .join('')
      }
    }

    if (this.activeTaskBoardTab === 'cron' && cronListEl) {
      const crons = this.taskBoardData.cronjobs || []
      if (crons.length === 0) {
        cronListEl.innerHTML = `
          <div class="task-board-empty">
            <div class="empty-glyph">⏰</div>
            <h3>No scheduled cronjobs</h3>
            <p>No automated recurring schedules are currently detected.</p>
          </div>
        `
      } else {
        cronListEl.innerHTML = crons
          .map((j) => {
            const rawAgent = j.agent || 'fleet'
            const agentName = j.agentName || (rawAgent.charAt(0).toUpperCase() + rawAgent.slice(1))
            const color = getAgentColor(rawAgent)
            const initial = getAgentInitial(agentName)
            const humanCadence = formatCronHuman(j.schedule, j.tz)

            return `
              <div class="cron-card">
                <div class="cron-card-header">
                  <div class="task-agent-meta">
                    <span class="agent-avatar-circle" style="background:${color}">${initial}</span>
                    <div class="agent-labels">
                      <span class="agent-name">${escapeHtml(agentName)}</span>
                      <span class="agent-domain">${escapeHtml(j.domain || j.role || 'Automation')}</span>
                    </div>
                  </div>
                  <div class="cron-schedule-pills">
                    <code class="cron-code">${escapeHtml(j.schedule || '* * * * *')}</code>
                    <span class="cron-human-badge">${escapeHtml(humanCadence)}</span>
                  </div>
                </div>
                <div class="cron-card-title">${escapeHtml(j.name || 'Scheduled Job')}</div>
                <div class="cron-card-desc">${escapeHtml(j.task || '')}</div>
                <div class="cron-card-footer">
                  <span class="harness-badge">${escapeHtml(j.source || 'Scheduler')}</span>
                  <span class="cron-active-badge ${j.enabled ? 'active' : 'paused'}">● ${j.enabled ? 'ENABLED' : 'PAUSED'}</span>
                </div>
              </div>
            `
          })
          .join('')
      }
    }
  }

  openChat(thread, agent) {
    if (!thread) return
    this.chatThread = thread
    this.chatAgent = agent
    this.isChatOpen = true

    const drawer = this.$('#chat-drawer')
    if (!drawer) return
    drawer.style.display = 'flex'

    const agentName = (thread.ref?.agent || thread.id.replace(/^submind:/, '').replace(/^grok:/, '').replace(/^antigravity:/, '')).toLowerCase()
    this.chatAgentName = agentName

    const title = thread.title?.split('—')[0]?.trim() || agentName.toUpperCase()
    this.$('.chat-name').textContent = title
    this.$('.chat-role').textContent = thread.preview || thread.project || 'Autonomous Agent'

    const taskEl = this.$('#chat-task')
    if (taskEl) {
      if (thread.running || thread.title) {
        taskEl.style.display = 'flex'
        taskEl.innerHTML = `<span class="task-icon">⚒</span> <span class="task-text">${escapeHtml(thread.title || thread.project)}</span>`
      } else {
        taskEl.style.display = 'none'
      }
    }

    // Avatar canvas in chat drawer
    const cvs = this.$('.chat-avatar canvas')
    if (cvs && this.avatarTmp) {
      cvs.width = 108
      cvs.height = 108
      const cc = cvs.getContext('2d')
      cc.clearRect(0, 0, 108, 108)
      cc.drawImage(this.avatarTmp, 0, 0)
    }

    this.renderChatMessages()

    const canChat = !window.colonyRbac || window.colonyRbac.canChatWith(agentName)
    const input = this.$('#chat-input')
    const sendBtn = this.$('#btn-chat-send')

    if (input) {
      if (!canChat) {
        input.disabled = true
        input.placeholder = window.colonyRbac?.role === 'spectator'
          ? 'Spectator role: Chat is disabled (read-only)'
          : `Not authorized to message ${title}`
      } else {
        input.disabled = false
        input.placeholder = `Talk to ${title}...`
        setTimeout(() => input.focus(), 60)
      }
    }
    if (sendBtn) {
      sendBtn.disabled = !canChat
      sendBtn.style.opacity = canChat ? '1' : '0.4'
    }
  }

  closeChat() {
    this.isChatOpen = false
    const drawer = this.$('#chat-drawer')
    if (drawer) drawer.style.display = 'none'
  }

  getChatStorageKey() {
    return `colony_chat_${this.chatAgentName || 'default'}`
  }

  getChatHistory() {
    try {
      const key = this.getChatStorageKey()
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw)
    } catch {}
    const name = (this.chatAgentName || 'agent').toUpperCase()
    return [
      {
        role: 'agent',
        text: `Hello Dale! ${name} here. How can I help with ${this.chatThread?.project || 'our work'}?`,
        time: Date.now(),
      },
    ]
  }

  saveChatHistory(history) {
    try {
      localStorage.setItem(this.getChatStorageKey(), JSON.stringify(history.slice(-40)))
    } catch {}
  }

  clearChatHistory() {
    try {
      localStorage.removeItem(this.getChatStorageKey())
    } catch {}
    this.renderChatMessages()
    this.toast('Chat history cleared')
  }

  renderChatMessages() {
    const list = this.$('#chat-messages')
    if (!list) return
    const history = this.getChatHistory()
    list.innerHTML = history
      .map(
        (m) => `
      <div class="chat-msg ${m.role}">
        <div class="chat-bubble">
          <div class="chat-text">${escapeHtml(m.text)}</div>
          <div class="chat-time">${ago(m.time)}</div>
        </div>
      </div>
    `
      )
      .join('')
    list.scrollTop = list.scrollHeight
  }

  async sendCurrentChatMessage() {
    const input = this.$('#chat-input')
    if (!input || this.isSending) return
    if (window.colonyRbac && !window.colonyRbac.canChatWith(this.chatAgentName)) {
      this.toast('Access Denied: You do not have permission to message this agent', 'err')
      return
    }
    const text = input.value.trim()
    if (!text) return

    input.value = ''
    input.style.height = 'auto'

    const history = this.getChatHistory()
    history.push({ role: 'user', text, time: Date.now() })
    this.saveChatHistory(history)
    this.renderChatMessages()

    const list = this.$('#chat-messages')
    const typingEl = document.createElement('div')
    typingEl.className = 'chat-msg agent typing-msg'
    typingEl.innerHTML = `
      <div class="chat-bubble typing">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        <span class="typing-label">${this.chatAgentName || 'Agent'} is thinking...</span>
      </div>
    `
    list.appendChild(typingEl)
    list.scrollTop = list.scrollHeight

    this.isSending = true
    try {
      const res = await this.actions.sendChat?.(this.chatAgentName, text, 'colony-' + this.chatAgentName)
      typingEl.remove()
      if (res?.ok && res.text) {
        history.push({ role: 'agent', text: res.text, time: Date.now() })
        this.saveChatHistory(history)
        this.renderChatMessages()
        if (this.chatThread?.id) {
          this.actions.celebrate?.(this.chatThread.id)
        }
      } else {
        throw new Error(res?.error || 'No response from agent')
      }
    } catch (err) {
      typingEl.remove()
      history.push({ role: 'error', text: `Failed to contact agent: ${err.message}`, time: Date.now() })
      this.saveChatHistory(history)
      this.renderChatMessages()
    } finally {
      this.isSending = false
      if (input) input.focus()
    }
  }

  removeBoot() {
    const boot = document.querySelector('.boot')
    if (!boot) return
    boot.classList.add('gone')
    setTimeout(() => boot.remove(), 550)
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────────────

function group(title, child) {
  const el = document.createElement('div')
  el.className = 'group'
  el.innerHTML = `<h3>${title}</h3>`
  if (child) el.appendChild(child)
  return el
}

function chips(items, current, onPick, registry) {
  const wrap = document.createElement('div')
  wrap.className = 'chips'
  const buttons = []
  for (const item of items) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.textContent = item.label
    if (item.title) b.title = item.title
    b.addEventListener('click', () => onPick(item.id))
    wrap.appendChild(b)
    buttons.push([item.id, b])
  }
  registry.push({
    el: wrap,
    sync: () => {
      const now = current()
      for (const [id, b] of buttons) b.setAttribute('aria-pressed', String(id === now))
    },
  })
  return wrap
}

const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6)
/**
 * Eye colours are authored above 1.0 so the bloom pass catches them in the scene. For the
 * card they are normalised by the brightest channel — which keeps the hue the astronaut
 * actually has rather than clipping a 3.0-red down to the same white as a 3.0-blue.
 */
function cssFromGlow(color) {
  const peak = Math.max(color.r, color.g, color.b, 1)
  const enc = (v) => Math.round(Math.pow(Math.min(1, v / peak), 1 / 2.2) * 255)
  return `rgb(${enc(color.r)},${enc(color.g)},${enc(color.b)})`
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function getAgentInitial(name) {
  if (!name) return 'A'
  return name.trim().charAt(0).toUpperCase()
}

function getAgentColor(name) {
  const colors = [
    '#c96442', '#4f9a63', '#4f7ec9', '#b8942a', '#8b5cc9', '#c94f8b',
    '#3fa8a0', '#c97f4f', '#6f8f4f', '#5c7fc9', '#c95c5c', '#7f6fc9',
  ]
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]
}

function formatCronHuman(expr, tz = '') {
  if (!expr) return 'No schedule'
  const parts = expr.trim().split(/\s+/)
  if (parts.length < 5) return expr

  const [min, hour, dom, month, dow] = parts
  let timeStr = ''

  if (hour.startsWith('*/')) {
    const step = hour.slice(2)
    timeStr = `Every ${step} hours`
  } else if (hour === '*' && min === '0') {
    timeStr = 'Every hour'
  } else if (!isNaN(Number(hour)) && !isNaN(Number(min))) {
    const h = Number(hour)
    const m = Number(min)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const displayH = h % 12 === 0 ? 12 : h % 12
    const displayM = m === 0 ? '00' : String(m).padStart(2, '0')
    timeStr = `Daily at ${displayH}:${displayM} ${ampm}`
  } else {
    timeStr = `At ${hour}:${min}`
  }

  let cadence = timeStr
  if (tz) cadence += ` (${tz.replace(/_/g, ' ')})`
  return cadence
}


/** Status → the colour family the top-bar counters already use for it. */
function statusClass(status) {
  if (status === 'working') return 'working'
  if (status === 'waiting') return 'waiting'
  if (status === 'blocked') return 'blocked'
  if (status === 'celebrating') return 'done'
  return 'idle'
}

/**
 * A path that fits, trimmed from the *left* so the repo end survives — the deep end is the
 * part that identifies it. CSS can only ellipsise the tail, and `direction: rtl` mangles a
 * leading `~`, so the trim is done here and the whole path lives in the title attribute.
 */
function shortPath(dir, max = 30) {
  const home = dir.replace(/^\/Users\/[^/]+/, '~')
  if (home.length <= max) return home
  const parts = home.split('/')
  let out = parts.pop() || ''
  while (parts.length) {
    const next = parts.pop()
    if (out.length + next.length + 3 > max) break
    out = `${next}/${out}`
  }
  return `…/${out}`
}

function shortModel(model) {
  return String(model).replace(/^claude-/, '').replace(/-\d{8}$/, '')
}

function clockLabel(t) {
  const total = t * 24 * 60
  const h = Math.floor(total / 60) % 24
  const m = Math.floor(total % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function nearestTime(value) {
  let best = TIMES[0]
  let bestD = Infinity
  for (const t of TIMES) {
    // Wrap-aware, so 0.99 is nearest to dawn rather than to noon.
    const d = Math.min(Math.abs(t.value - value), 1 - Math.abs(t.value - value))
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  return bestD < 0.03 ? best.id : null
}

function ago(ts) {
  if (!ts) return 'never'
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const TEMPLATE = `
<aside class="side panel">
  <header class="brandbar">
    <div class="brand"><i class="dot"></i>Bot Crossing</div>
    <button class="btn icon ghost" id="btn-tasks" title="Colony Task Board (B)">${ICON.tasks}</button>
    <button class="btn icon ghost" id="btn-shop" title="Colony Depot & Plugins (D)">${ICON.shop}</button>
    <button class="btn icon ghost" id="btn-shot" title="Screenshot (P)">${ICON.camera}</button>
    <button class="btn icon ghost" id="btn-help" title="Help (?)">${ICON.help}</button>
    <button class="btn icon ghost" id="btn-hide" title="Hide all UI (H)">${ICON.eye}</button>
    <button class="btn icon ghost" id="btn-settings" title="Settings (S)" aria-pressed="false">${ICON.settings}</button>
  </header>

  <div class="stats"></div>

  <div class="side-body">
    <div class="projects-pane">
      <div class="sec-head"><span>Repos</span></div>
      <div class="projects"></div>
      <div class="hidden-block" hidden>
        <button type="button" class="hidden-toggle" id="btn-hidden-toggle" aria-expanded="false">
          <span class="label">0 hidden</span>
        </button>
        <div class="hidden-projects" hidden></div>
      </div>
    </div>

    <div class="project-detail">
      <button class="btn ghost back" id="btn-close-project" title="Back to every repo (Esc)">${ICON.back} All repos</button>
      <div class="who">
        <i class="swatch"></i>
        <div class="text">
          <div class="name"></div>
          <div class="path"></div>
        </div>
        <button class="btn icon ghost" id="btn-locate" title="Fly to this zone">${ICON.locate}</button>
      </div>
      <div class="project-actions">
        <button class="btn primary" id="btn-new-session" title="Start a new thread in this folder (C)">${ICON.plus} New conversation</button>
        <div class="pair">
          <button class="btn" id="btn-reveal" title="Show this folder in ${FILE_MANAGER}">${ICON.folder} ${FILE_MANAGER}</button>
          <button class="btn" id="btn-copy-path" title="Copy the folder path">${ICON.copy} Copy path</button>
        </div>
        <button class="btn" id="btn-hide-project" title="Hide this repo from the colony — does not archive its threads">${ICON.eyeOff} Hide from colony</button>
      </div>
      <div class="threads-head"></div>
      <div class="threads"></div>
    </div>
  </div>
</aside>

<div class="rail panel">
  <button class="btn icon" id="btn-home" title="Reset the view (0)">${ICON.home}</button>
  <button class="btn icon" id="btn-next" title="Next astronaut waiting on you (N)">${ICON.next}</button>
  <div class="sep"></div>
  <button class="btn icon" id="btn-orbit" title="Orbit mode — sweep around the colony (O)" aria-pressed="false">${ICON.orbit}</button>
  <button class="btn icon" id="btn-planet" title="Change planet (Tab)">${ICON.globe}</button>
  <button class="btn icon" id="btn-time" title="Change the time of day (L)">${ICON.sun}</button>
</div>

<div class="settings panel closed">
  <header>Settings <button class="btn icon ghost" id="btn-close-settings" title="Close">${ICON.close}</button></header>
  <div class="body"></div>
</div>

<div class="thread-pop panel">
  <i class="nib"></i>
  <div class="top">
    <div class="avatar"><canvas></canvas></div>
    <div class="info">
      <div class="title"></div>
      <div class="meta"></div>
    </div>
    <button class="btn icon ghost" id="btn-deselect" title="Deselect (Esc)">${ICON.close}</button>
  </div>
  <div class="progress"><i></i></div>
  <div class="cli-pill" title="Click to copy CLI resume command (T)">
    <span class="cli-prompt">$</span>
    <code class="cli-code"></code>
    <span class="cli-copy-icon">${ICON.copy}</span>
  </div>
  <div class="pair">
    <button class="btn primary" id="btn-chat" title="Engage and chat with this agent in real time (C)">${ICON.chat} Chat</button>
    <button class="btn" id="btn-open" title="Open this thread in the harness it came from (Enter)">${ICON.open} Open</button>
    <button class="btn" id="btn-copy-cli" title="Copy CLI resume command to clipboard (T)">${ICON.terminal} CLI</button>
    <button class="btn" id="btn-viewed" title="Stop this thread asking for you until it moves on again (V)">${ICON.eye} Viewed</button>
    <button class="btn" id="btn-archive" title="Archive — this astronaut walks back to the ship (A)">${ICON.archive} Archive</button>
  </div>
</div>

<div class="chat-drawer panel" id="chat-drawer" style="display: none;">
  <div class="chat-head">
    <div class="chat-agent-info">
      <div class="chat-avatar"><canvas></canvas></div>
      <div class="chat-meta">
        <div class="chat-name"></div>
        <div class="chat-role"></div>
      </div>
    </div>
    <div class="chat-actions">
      <button class="btn icon ghost" id="btn-chat-clear" title="Clear chat history">${ICON.trash}</button>
      <button class="btn icon ghost" id="btn-chat-close" title="Close chat (Esc)">${ICON.close}</button>
    </div>
  </div>

  <div class="chat-task" id="chat-task" style="display: none;"></div>

  <div class="chat-messages" id="chat-messages"></div>

  <div class="chat-suggestions" id="chat-suggestions">
    <button class="chat-chip" data-msg="Status update on your current task?">Status update</button>
    <button class="chat-chip" data-msg="What are you working on right now?">What are you working on?</button>
    <button class="chat-chip" data-msg="Are there any blockers or questions?">Any blockers?</button>
  </div>

  <div class="chat-input-box">
    <textarea id="chat-input" placeholder="Message agent..." rows="1"></textarea>
    <button class="btn primary icon" id="btn-chat-send" title="Send message (Enter)">${ICON.send}</button>
  </div>
</div>

<div class="toasts"></div>
<div class="fps panel"></div>
<div class="hint-pill panel"></div>

<div class="task-board-modal" id="task-board-modal">
  <div class="task-board-backdrop"></div>
  <div class="task-board-window panel">
    <div class="task-board-head">
      <div class="task-board-title-group">
        <div class="task-board-badge"><i class="task-dot"></i> THE SUBMIND</div>
        <div class="task-board-title-text">
          <h2>The Submind</h2>
          <span class="task-board-subtitle">Active operations deck &amp; agent task queue</span>
        </div>
      </div>
      <div class="task-board-head-actions">
        <button class="btn ghost small" id="btn-task-board-locate" title="Fly camera to the billboard next to the spaceship">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: -2px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
          <span>Locate Billboard</span>
        </button>
        <button class="btn icon ghost" id="btn-task-board-close" title="Close Task Board (Esc)">${ICON.close}</button>
      </div>
    </div>

    <div class="task-board-tabs">
      <button class="task-tab active" data-tab="tasks" id="tab-tasks-btn">
        <span>In-Flight Tasks</span>
        <span class="tab-count" id="task-count-badge">0</span>
      </button>
      <button class="task-tab" data-tab="cron" id="tab-cron-btn">
        <span>Cronjobs Across All Agents</span>
        <span class="tab-count" id="cron-count-badge">0</span>
      </button>
      <button class="task-tab" data-tab="config" id="tab-config-btn">
        <span>Configure ⚙️</span>
      </button>
    </div>

    <div class="task-board-content">
      <div class="task-tab-pane active" id="pane-tasks">
        <div class="task-list" id="task-board-task-list"></div>
      </div>
      <div class="task-tab-pane" id="pane-cron" style="display: none;">
        <div class="cron-list" id="task-board-cron-list"></div>
      </div>
      <div class="task-tab-pane" id="pane-config" style="display: none;">
        <div class="config-list" id="task-board-config-list"></div>
      </div>
    </div>
  </div>
</div>

<div class="task-board-modal" id="shop-modal">
  <div class="task-board-backdrop" id="shop-backdrop"></div>
  <div class="task-board-window panel" style="box-shadow: 0 24px 64px rgba(0, 0, 0, 0.75), 0 0 32px rgba(255, 167, 38, 0.2);">
    <div class="task-board-head">
      <div class="task-board-title-group">
        <div class="task-board-badge" style="border-color: #ffa726; color: #ffa726;"><i class="task-dot" style="background: #ffa726;"></i> THE DEPOT</div>
        <div class="task-board-title-text">
          <h2>Colony Workshop &amp; Depot</h2>
          <span class="task-board-subtitle">Install, toggle, and configure Colony plugins &amp; RBAC security</span>
        </div>
      </div>
      <div class="task-board-head-actions">
        <button class="btn ghost small" id="btn-shop-locate" title="Fly camera to the Depot kiosk next to the spaceship">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: -2px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
          <span>Locate Depot</span>
        </button>
        <button class="btn icon ghost" id="btn-shop-close" title="Close Depot (Esc)">${ICON.close}</button>
      </div>
    </div>

    <div class="task-board-tabs">
      <button class="task-tab active" data-tab="installed" id="tab-shop-installed-btn">
        <span>Installed Addons</span>
        <span class="tab-count" id="shop-installed-count">2</span>
      </button>
      <button class="task-tab" data-tab="catalog" id="tab-shop-catalog-btn">
        <span>Addon Catalog</span>
      </button>
      <button class="task-tab" data-tab="rbac" id="tab-shop-rbac-btn">
        <span>RBAC &amp; Access 🛡️</span>
      </button>
    </div>

    <div class="task-board-content" style="overflow-y: auto; max-height: calc(100vh - 220px);">
      <div class="task-tab-pane active" id="pane-shop-installed">
        <div class="installed-plugins-list" id="shop-installed-list" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;"></div>
      </div>
      <div class="task-tab-pane" id="pane-shop-catalog" style="display: none;">
        <div class="catalog-plugins-list" id="shop-catalog-list" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;"></div>
      </div>
      <div class="task-tab-pane" id="pane-shop-rbac" style="display: none;">
        <div class="rbac-config-pane" id="shop-rbac-list" style="padding: 20px; display: flex; flex-direction: column; gap: 18px;"></div>
      </div>
    </div>
  </div>
</div>

<div class="help">
  <div class="sheet panel">
    <h2>Bot Crossing</h2>
    <p class="sub">Every coding-agent thread on this machine is an astronaut. They walk out of the ship, claim a plot for their repo, and build. Click one to open its thread; click a zone — its deck or its name — for the repo itself, and start a new conversation there. Hide a repo from that panel if you would rather not see it — its threads stay in your harness, and you can show it again from the list. Navigation works like Google Earth — drag the ground itself, right-drag to tilt, scroll to zoom in on whatever is under the cursor.</p>
    <div class="cols">
      <div>
        <div class="k"><span>Drag the ground</span><kbd>drag</kbd></div>
        <div class="k"><span>Tilt &amp; rotate</span><kbd>right-drag</kbd></div>
        <div class="k"><span>&nbsp;</span><kbd>⌃ or ⇧ + drag</kbd></div>
        <div class="k"><span>Zoom to cursor</span><kbd>scroll</kbd></div>
        <div class="k"><span>Move / zoom</span><kbd>arrows</kbd> <kbd>+ −</kbd></div>
        <div class="k"><span>Reset view</span><kbd>0</kbd></div>
        <div class="k"><span>Task board</span><kbd>B</kbd></div>
        <div class="k"><span>Hide all UI</span><kbd>H</kbd> <kbd>${IS_MAC ? '⌘' : 'Ctrl'}\\</kbd></div>
        <div class="k"><span>Settings</span><kbd>S</kbd></div>
        <div class="k"><span>Screenshot</span><kbd>P</kbd></div>
      </div>
      <div>
        <div class="k"><span>Next needing you</span><kbd>N</kbd></div>
        <div class="k"><span>Open thread</span><kbd>Enter</kbd></div>
        <div class="k"><span>Copy CLI command</span><kbd>T</kbd></div>
        <div class="k"><span>Mark viewed</span><kbd>V</kbd></div>
        <div class="k"><span>Archive</span><kbd>A</kbd></div>
        <div class="k"><span>New conversation</span><kbd>C</kbd></div>
        <div class="k"><span>Orbit mode</span><kbd>O</kbd></div>
        <div class="k"><span>Change planet</span><kbd>Tab</kbd></div>
        <div class="k"><span>Time of day</span><kbd>L</kbd></div>
        <div class="k"><span>Deselect</span><kbd>Esc</kbd></div>
        <div class="k"><span>This sheet</span><kbd>?</kbd></div>
      </div>
    </div>
    <div style="margin-top:16px">
      <div class="legend-row"><i class="badge" style="background:#1a2b46;color:#8fb4ee">?</i> waiting on your reply — click to open the thread</div>
      <div class="legend-row"><i class="badge" style="background:#3d1c1c;color:#e88b8b">!</i> the session hit an error</div>
      <div class="legend-row"><i class="badge" style="background:#16301f;color:#7fd39a">⚒</i> running right now, building</div>
      <div class="legend-row"><i class="badge" style="background:#332b12;color:#e6c67f">✓</i> its pull request landed</div>
      <div class="legend-row"><i class="badge" style="background:#1d1f2e;color:#a9a8c0">z</i> nothing for three days</div>
    </div>
    <div style="margin-top:18px;display:flex;justify-content:flex-end">
      <button class="btn primary" id="btn-help-close">Got it</button>
    </div>
  </div>
</div>
`
