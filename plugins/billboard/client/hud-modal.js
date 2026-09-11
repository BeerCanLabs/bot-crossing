import { renderConfigTab } from './config-modal.js'

/**
 * Creates and manages the Task Board HUD modal and brandbar button.
 */
export function createHudModal(onRefreshNeeded) {
  // Inject modal markup into body
  const modalEl = document.createElement('div')
  modalEl.className = 'taskboard-modal'
  modalEl.id = 'taskboard-modal'
  modalEl.innerHTML = `
    <div class="taskboard-dialog">
      <div class="taskboard-header">
        <div class="taskboard-title-group">
          <h2>OPERATIONS // TASK BOARD</h2>
          <div class="taskboard-nav">
            <button type="button" class="taskboard-tab-btn active" id="tb-tab-tasks">Tasks</button>
            <button type="button" class="taskboard-tab-btn" id="tb-tab-config">Configure ⚙️</button>
          </div>
        </div>
        <button type="button" class="taskboard-close-btn" id="tb-close-btn">&times;</button>
      </div>
      <div class="taskboard-body" id="tb-body-tasks">
        <div class="taskboard-grid" id="tb-task-list">
          <div style="color: #94a3b8; font-size: 14px; padding: 20px 0;">Loading tasks...</div>
        </div>
      </div>
      <div class="taskboard-body" id="tb-body-config" style="display: none;">
        <!-- Dynamically rendered by renderConfigTab -->
      </div>
    </div>
  `
  document.body.appendChild(modalEl)

  // Attach Brandbar button
  const brandbar = document.querySelector('.brandbar') || document.querySelector('#brandbar')
  let hudBtn = null
  if (brandbar) {
    hudBtn = document.createElement('button')
    hudBtn.type = 'button'
    hudBtn.className = 'taskboard-hud-btn'
    hudBtn.innerHTML = `<span>📋 Tasks</span> <span class="badge" id="tb-count-badge">0</span>`
    hudBtn.addEventListener('click', () => open())
    brandbar.appendChild(hudBtn)
  }

  // Event handlers
  const closeBtn = modalEl.querySelector('#tb-close-btn')
  closeBtn.addEventListener('click', () => close())

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) close()
  })

  const tabTasks = modalEl.querySelector('#tb-tab-tasks')
  const tabConfig = modalEl.querySelector('#tb-tab-config')
  const bodyTasks = modalEl.querySelector('#tb-body-tasks')
  const bodyConfig = modalEl.querySelector('#tb-body-config')
  const taskListEl = modalEl.querySelector('#tb-task-list')
  const countBadge = modalEl.querySelector('#tb-count-badge')

  tabTasks.addEventListener('click', () => {
    tabTasks.classList.add('active')
    tabConfig.classList.remove('active')
    bodyTasks.style.display = 'block'
    bodyConfig.style.display = 'none'
  })

  tabConfig.addEventListener('click', () => {
    tabConfig.classList.add('active')
    tabTasks.classList.remove('active')
    bodyTasks.style.display = 'none'
    bodyConfig.style.display = 'block'
    renderConfigTab(bodyConfig, () => {
      if (onRefreshNeeded) onRefreshNeeded()
    })
  })

  // Keyboard shortcut: B
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'b' || e.key === 'B') && !e.target.matches('input, textarea, select')) {
      toggle()
    }
    if (e.key === 'Escape' && modalEl.classList.contains('open')) {
      close()
    }
  })

  function open() {
    modalEl.classList.add('open')
  }

  function close() {
    modalEl.classList.remove('open')
  }

  function toggle() {
    if (modalEl.classList.contains('open')) close()
    else open()
  }

  function renderTasks(tasks = [], providerName = '') {
    if (countBadge) countBadge.textContent = String(tasks.length)

    if (tasks.length === 0) {
      taskListEl.innerHTML = `
        <div style="text-align: center; padding: 48px 20px;">
          <div style="font-size: 32px; margin-bottom: 12px; color: #38bdf8;">✓</div>
          <h3 style="margin: 0 0 8px 0; color: #f8fafc; font-size: 16px;">All systems nominal</h3>
          <p style="margin: 0; color: #94a3b8; font-size: 13px;">No active tasks in ${providerName || 'your configured provider'}. Click "Configure ⚙️" to connect Notion, Jira, GitHub, or Paperclip.</p>
        </div>
      `
      return
    }

    taskListEl.innerHTML = tasks
      .map((t) => {
        const isProgress = t.status === 'in_progress'
        return `
          <div class="task-item-card">
            <div class="task-item-header">
              <span class="task-item-title">${escapeHtml(t.title)}</span>
              <span class="task-status-pill ${t.status}">${isProgress ? '⚒ Working' : '⏳ Pending'}</span>
            </div>
            ${t.preview ? `<div class="task-item-preview">${escapeHtml(t.preview)}</div>` : ''}
            <div class="task-item-footer">
              <div class="task-item-meta">
                <span class="source-badge">${escapeHtml(t.sourceName || t.source)}</span>
                <span class="assignee">👤 ${escapeHtml(t.assignee || 'Unassigned')}</span>
                <span class="project">📁 ${escapeHtml(t.project || '')}</span>
              </div>
              <div class="task-item-actions">
                ${t.url ? `<a href="${t.url}" target="_blank" rel="noopener noreferrer">Open Ticket ↗</a>` : ''}
              </div>
            </div>
          </div>
        `
      })
      .join('')
  }

  return {
    open,
    close,
    toggle,
    renderTasks,
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
