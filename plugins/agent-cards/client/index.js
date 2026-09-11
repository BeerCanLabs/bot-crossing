/**
 * Custom Agent Cards Plugin for Bot Crossing
 *
 * Provides enhanced astronaut cards with:
 * - Direct Talk / Chat trigger (opens native Bot Crossing chat drawer)
 * - Agent-specific scheduled cron routines with manual 'Run Now' triggers
 * - Direct link to the agent's backlog and task board
 * - Interactive 'Add Task' dispatcher to inject tasks into the agent's backlog
 */

;(function initCustomAgentCards() {
  if (!window.botCrossing || !window.botCrossing.on) {
    console.warn('[AgentCards] Bot Crossing Plugin Engine not detected. Apply colony-plugin-engine.patch to enable.')
    return
  }

  const escapeHtml = (s) => (s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '')
  const hex = (n) => `#${(n ?? 0).toString(16).padStart(6, '0')}`

  const AGENT_REPOS = {
    higgins: 'BeerCanLabs/SM-higgins',
    donna: 'BeerCanLabs/SM-donna',
    castle: 'BeerCanLabs/SM-castle',
    archie: 'BeerCanLabs/SM-archie',
    switch: 'BeerCanLabs/SM-switch',
    geordi: 'BeerCanLabs/SM-geordi',
    draftsman: 'BeerCanLabs/ev-draftsman',
    'alc-support': 'dsackr/american-lutheran-church-kellogg',
  }

  window.botCrossing.on('card:render', ({ agent, thread, card, hud }) => {
    if (!agent || !thread || !card) return false

    const rawAgent = (thread.ref?.agent || thread.id.replace(/^submind:/, '').replace(/^grok:/, '').replace(/^claude-code:/, '')).toLowerCase().replace(/^sm-/, '').trim()
    const targetRepo = thread.ref?.repo || AGENT_REPOS[rawAgent] || `BeerCanLabs/SM-${rawAgent}`
    const backlogUrl = thread.ref?.url ? (thread.ref.url.includes('/issues/') ? thread.ref.url : `${thread.ref.url}/issues`) : `https://github.com/${targetRepo}/issues`
    const title = thread.title || `${rawAgent.toUpperCase()} — Autonomous Agent`
    const swatchColor = hex(agent.trim?.getHex ? agent.trim.getHex() : 0x00e5ff)

    card.style.background = 'transparent'
    card.style.border = 'none'
    card.style.boxShadow = 'none'
    card.style.padding = '0'

    card.innerHTML = `
      <div style="padding: 14px 16px; background: rgba(14, 18, 25, 0.96); border: 1px solid rgba(255,255,255,0.14); border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,0.65), 0 0 24px rgba(0,229,255,0.12); width: 340px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box;">
        <!-- Top Agent Identity Header -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="swatch" style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${swatchColor}; box-shadow: 0 0 8px ${swatchColor}; flex-shrink: 0;"></i>
            <div>
              <div style="font-weight: 700; font-size: 14px; color: #f8fafc; line-height: 1.2;">
                ${escapeHtml(rawAgent.toUpperCase())}
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                ${escapeHtml(thread.preview || thread.project || 'Autonomous Agent')}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
              ${thread.model ? `<span style="font-size: 9px; font-family: monospace; background: rgba(255,255,255,0.06); color: #cbd5e1; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08);">${escapeHtml(thread.model)}</span>` : ''}
              ${thread.project ? `<span style="font-size: 9px; font-family: monospace; background: rgba(56,189,248,0.12); color: #38bdf8; padding: 2px 6px; border-radius: 4px;">${escapeHtml(thread.project)}</span>` : ''}
            </div>
            <button id="btn-custom-card-close" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; padding: 2px 6px; line-height: 1; border-radius: 4px; margin-left: 4px;" title="Close (Esc)">✕</button>
          </div>
        </div>

        <!-- Task Info & Progress -->
        ${thread.running || thread.title ? `
          <div style="background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 10px; margin-bottom: 10px;">
            <div style="font-size: 11px; color: #e2e8f0; font-weight: 500; display: flex; align-items: center; gap: 6px;">
              <span>${thread.running ? '⚒' : '📌'}</span>
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(thread.title)}</span>
            </div>
            <div style="height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 6px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.round((hud.actions?.progressFor?.(thread.id) ?? 0.5) * 100)}%; background: ${swatchColor};"></div>
            </div>
          </div>
        ` : ''}

        <!-- Primary Action Buttons -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 12px;">
          <button class="btn small primary" id="btn-card-talk" style="font-size: 11px; padding: 6px 4px; justify-content: center; gap: 4px;">
            <span>💬</span> Talk
          </button>
          <a href="${escapeHtml(backlogUrl)}" target="_blank" rel="noopener noreferrer" class="btn small ghost" style="font-size: 11px; padding: 6px 4px; justify-content: center; text-decoration: none; text-align: center; gap: 4px;">
            <span>📋</span> Backlog
          </a>
          <button class="btn small ghost" id="btn-card-cli" title="Copy CLI resume command" style="font-size: 11px; padding: 6px 4px; justify-content: center; gap: 4px;">
            <span>💻</span> CLI
          </button>
        </div>

        <!-- Scheduled Routines (Cron) Section -->
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Scheduled Routines</span>
            <span id="cron-loading-indicator" style="font-size: 10px; color: #64748b;">Loading...</span>
          </div>
          <div id="agent-cron-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 130px; overflow-y: auto;">
          </div>
        </div>

        <!-- Add Task to Agent Section -->
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: #94a3b8;">Assign new action:</span>
            <button class="btn small ghost" id="btn-toggle-add-task" style="font-size: 10px; padding: 2px 8px;">+ New Task</button>
          </div>
          <div id="add-task-form" style="display: none; margin-top: 8px; flex-direction: column; gap: 6px;">
            <input type="text" id="input-task-title" placeholder="Describe task for ${rawAgent}..." style="background: #0f172a; border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 5px 8px; border-radius: 4px; font-size: 11px;" />
            <div style="display: flex; justify-content: flex-end; gap: 6px;">
              <button class="btn small ghost" id="btn-cancel-add-task" style="font-size: 10px; padding: 3px 8px;">Cancel</button>
              <button class="btn small primary" id="btn-submit-add-task" style="font-size: 10px; padding: 3px 8px;">Dispatch</button>
            </div>
          </div>
        </div>
      </div>
    `

    // Wire Close button
    card.querySelector('#btn-custom-card-close')?.addEventListener('click', () => {
      hud.actions?.select?.(null) || hud.setSelection(null, null)
    })

    // Wire Talk / Chat Button
    card.querySelector('#btn-card-talk')?.addEventListener('click', () => {
      if (typeof hud.openChat === 'function') {
        hud.openChat(thread, agent)
      } else if (hud.actions?.openChatForAgent) {
        hud.actions.openChatForAgent(agent)
      }
    })

    // Wire Copy CLI Button
    card.querySelector('#btn-card-cli')?.addEventListener('click', async () => {
      const cmd = thread.cliCommand || `gcloud run services describe sm-${rawAgent} --region=us-central1 --project=submind-matrix`
      try {
        await navigator.clipboard.writeText(cmd)
        hud.toast(`Copied CLI command: ${cmd}`)
      } catch {
        hud.toast('Failed to copy to clipboard', 'err')
      }
    })

    // Wire Add Task toggle
    const toggleBtn = card.querySelector('#btn-toggle-add-task')
    const addForm = card.querySelector('#add-task-form')
    const cancelBtn = card.querySelector('#btn-cancel-add-task')
    const submitBtn = card.querySelector('#btn-submit-add-task')
    const inputTitle = card.querySelector('#input-task-title')

    toggleBtn?.addEventListener('click', () => {
      const isVisible = addForm.style.display === 'flex'
      addForm.style.display = isVisible ? 'none' : 'flex'
      if (!isVisible) inputTitle?.focus()
    })

    cancelBtn?.addEventListener('click', () => {
      addForm.style.display = 'none'
      if (inputTitle) inputTitle.value = ''
    })

    submitBtn?.addEventListener('click', async () => {
      const titleText = inputTitle?.value?.trim()
      if (!titleText) return
      submitBtn.disabled = true
      submitBtn.textContent = 'Dispatching...'
      try {
        const res = await fetch('/api/agent-cards/tasks/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: rawAgent, title: titleText })
        })
        const data = await res.json()
        if (res.ok) {
          hud.toast(`Task dispatched to ${rawAgent.toUpperCase()}'s backlog!`, 'ok')
          addForm.style.display = 'none'
          if (inputTitle) inputTitle.value = ''
        } else {
          hud.toast(data.error || 'Failed to dispatch task', 'err')
        }
      } catch (err) {
        hud.toast('Task dispatch error: ' + err.message, 'err')
      } finally {
        submitBtn.disabled = false
        submitBtn.textContent = 'Dispatch'
      }
    })

    // Load & Render Agent's Specific Scheduled Cron Routines
    ;(async () => {
      const listEl = card.querySelector('#agent-cron-list')
      const indicator = card.querySelector('#cron-loading-indicator')
      if (!listEl) return

      try {
        const res = await fetch(`/api/agent-cards/cron?agent=${encodeURIComponent(rawAgent)}`)
        const data = await res.json()
        const jobs = data.jobs || []

        if (indicator) indicator.textContent = `${jobs.length} scheduled`

        if (jobs.length === 0) {
          listEl.innerHTML = `<div style="font-size: 11px; color: #64748b; font-style: italic;">No automated cron routines scheduled.</div>`
          return
        }

        listEl.innerHTML = jobs.map((job) => `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div style="min-width: 0; flex: 1;">
              <div style="font-size: 11px; font-weight: 500; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(job.name)}
              </div>
              <div style="font-size: 9px; font-family: monospace; color: #38bdf8;">
                ${escapeHtml(job.schedule)} ${job.tz ? `(${job.tz.split('/')[1] || job.tz})` : ''}
              </div>
            </div>
            <button class="btn small ghost btn-run-cron" data-job-id="${escapeHtml(job.id)}" style="font-size: 10px; padding: 3px 6px; white-space: nowrap;">
              ▶ Run Now
            </button>
          </div>
        `).join('')

        listEl.querySelectorAll('.btn-run-cron').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const jobId = btn.dataset.jobId
            btn.disabled = true
            btn.textContent = 'Running...'
            try {
              const runRes = await fetch('/api/agent-cards/cron/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent: rawAgent, jobId })
              })
              const runData = await runRes.json()
              if (runRes.ok) {
                btn.textContent = '✓ Done'
                hud.toast(`Triggered routine '${jobId}' for ${rawAgent.toUpperCase()}`, 'ok')
                setTimeout(() => {
                  btn.disabled = false
                  btn.textContent = '▶ Run Now'
                }, 3000)
              } else {
                btn.textContent = 'Failed'
                hud.toast(runData.error || 'Failed to trigger cron routine', 'err')
                btn.disabled = false
              }
            } catch (e) {
              btn.textContent = 'Failed'
              btn.disabled = false
              hud.toast('Trigger error: ' + e.message, 'err')
            }
          })
        })

      } catch (err) {
        if (indicator) indicator.textContent = 'Error'
        listEl.innerHTML = `<div style="font-size: 10px; color: #ef4444;">Could not load routines.</div>`
      }
    })()

    return true // Handled by plugin
  })
})()
