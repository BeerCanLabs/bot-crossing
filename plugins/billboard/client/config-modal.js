/**
 * Renders and handles the provider configuration view inside the Task Board modal.
 */
export function renderConfigTab(containerEl, onSaveSuccess) {
  containerEl.innerHTML = `
    <div class="config-container">
      <div class="config-field">
        <label for="provider-select">Select Task Provider</label>
        <select id="provider-select"></select>
      </div>
      <div id="provider-description" style="font-size: 13px; color: #94a3b8;"></div>
      <div id="provider-fields-container" style="display: flex; flex-direction: column; gap: 14px;"></div>
      <div class="config-actions">
        <button type="button" class="config-btn secondary" id="btn-test-connection">Test Connection</button>
        <button type="button" class="config-btn primary" id="btn-save-config">Save Settings</button>
        <span id="config-status" class="config-status-msg"></span>
      </div>
    </div>
  `

  const providerSelect = containerEl.querySelector('#provider-select')
  const descriptionEl = containerEl.querySelector('#provider-description')
  const fieldsContainer = containerEl.querySelector('#provider-fields-container')
  const testBtn = containerEl.querySelector('#btn-test-connection')
  const saveBtn = containerEl.querySelector('#btn-save-config')
  const statusEl = containerEl.querySelector('#config-status')

  let currentProviders = []
  let currentConfig = { active: 'github', providers: {} }

  async function loadData() {
    try {
      const res = await fetch('/api/taskboard/config')
      if (!res.ok) return
      const data = await res.json()
      currentProviders = data.providers || []
      currentConfig = data.config || { active: 'github', providers: {} }

      providerSelect.innerHTML = currentProviders
        .map((p) => `<option value="${p.id}" ${p.id === currentConfig.active ? 'selected' : ''}>${p.name}</option>`)
        .join('')

      renderSelectedProvider()
    } catch (err) {
      statusEl.className = 'config-status-msg err'
      statusEl.textContent = `Failed to load config: ${err.message}`
    }
  }

  async function renderSelectedProvider() {
    const selectedId = providerSelect.value
    const provider = currentProviders.find((p) => p.id === selectedId)
    if (!provider) return

    descriptionEl.textContent = provider.description || ''
    const savedValues = currentConfig.providers?.[selectedId] || {}

    let oauthHtml = ''
    if (selectedId === 'notion') {
      try {
        const oauthRes = await fetch('/api/taskboard/oauth/notion/connect?json=1')
        const oauthData = await oauthRes.json()
        if (oauthData.ok && oauthData.authUrl) {
          oauthHtml = `
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 6px; padding: 12px; margin-bottom: 14px;">
              <div style="font-weight: 600; color: #60a5fa; margin-bottom: 4px;">1-Click Connect</div>
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;">Connect your Notion workspace directly without copying or pasting any secrets or IDs.</div>
              <a href="${oauthData.authUrl}" class="config-btn primary" style="display: inline-block; text-decoration: none; text-align: center;">⚡ Connect with Notion</a>
            </div>
          `
        }
      } catch {}
    }

    fieldsContainer.innerHTML = oauthHtml + (provider.fields || [])
      .map((f) => {
        const val = savedValues[f.key] || ''
        const isDbField = selectedId === 'notion' && f.key === 'databaseId'
        return `
          <div class="config-field">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label for="field-${f.key}">${f.label} ${f.required ? '<span style="color:#ef4444">*</span>' : ''}</label>
              ${isDbField ? '<button type="button" id="btn-discover-dbs" style="background:none; border:none; color:#38bdf8; font-size:11px; cursor:pointer; text-decoration:underline;">🔍 Auto-Discover</button>' : ''}
            </div>
            <input
              id="field-${f.key}"
              data-key="${f.key}"
              type="${f.type || 'text'}"
              placeholder="${f.placeholder || ''}"
              value="${escapeAttr(val)}"
            />
            <div id="field-${f.key}-helper" style="font-size: 11px; color: #64748b; margin-top: 3px;"></div>
          </div>
        `
      })
      .join('')

    const discoverBtn = fieldsContainer.querySelector('#btn-discover-dbs')
    if (discoverBtn) {
      discoverBtn.addEventListener('click', async () => {
        discoverBtn.textContent = 'Searching Notion...'
        try {
          const res = await fetch('/api/taskboard/databases?providerId=notion')
          const data = await res.json()
          if (data.ok && data.databases?.length > 0) {
            const dbInput = fieldsContainer.querySelector('#field-databaseId')
            const helper = fieldsContainer.querySelector('#field-databaseId-helper')
            if (dbInput) {
              dbInput.value = data.databases[0].id
            }
            if (helper) {
              helper.style.color = '#34d399'
              helper.textContent = `✓ Auto-selected "${data.databases[0].title}" (${data.databases.length} found)`
            }
            discoverBtn.textContent = '✓ Discovered'
          } else {
            discoverBtn.textContent = 'No databases found'
          }
        } catch {
          discoverBtn.textContent = 'Discovery failed'
        }
      })
    }
  }

  function getFormValues() {
    const values = {}
    const inputs = fieldsContainer.querySelectorAll('input')
    for (const input of inputs) {
      values[input.dataset.key] = input.value
    }
    return values
  }

  providerSelect.addEventListener('change', renderSelectedProvider)

  testBtn.addEventListener('click', async () => {
    const selectedId = providerSelect.value
    statusEl.className = 'config-status-msg'
    statusEl.textContent = 'Testing connection...'
    try {
      const res = await fetch('/api/taskboard/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedId,
          config: getFormValues(),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        statusEl.className = 'config-status-msg ok'
        const detail = data.message || (data.name ? `"${data.name}"` : data.user || '')
        statusEl.textContent = `✓ Connected successfully${detail ? `: ${detail}` : ''}`

        // If database was auto-discovered during test, populate it in the field
        if (data.databaseId) {
          const dbInput = fieldsContainer.querySelector('#field-databaseId')
          if (dbInput && !dbInput.value) {
            dbInput.value = data.databaseId
          }
        }
      } else {
        statusEl.className = 'config-status-msg err'
        statusEl.textContent = `✕ Connection failed: ${data.error}`
      }
    } catch (err) {
      statusEl.className = 'config-status-msg err'
      statusEl.textContent = `✕ Network error: ${err.message}`
    }
  })

  saveBtn.addEventListener('click', async () => {
    const selectedId = providerSelect.value
    statusEl.className = 'config-status-msg'
    statusEl.textContent = 'Saving...'

    if (!currentConfig.providers) currentConfig.providers = {}
    currentConfig.active = selectedId
    currentConfig.providers[selectedId] = getFormValues()

    try {
      const res = await fetch('/api/taskboard/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfig),
      })
      if (res.ok) {
        statusEl.className = 'config-status-msg ok'
        statusEl.textContent = '✓ Saved successfully!'
        if (onSaveSuccess) onSaveSuccess()
      } else {
        statusEl.className = 'config-status-msg err'
        statusEl.textContent = '✕ Failed to save'
      }
    } catch (err) {
      statusEl.className = 'config-status-msg err'
      statusEl.textContent = `✕ ${err.message}`
    }
  })

  loadData()
}

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;')
}
