/**
 * Bot Crossing RBAC Client Adapter
 */
const normAgent = (a) => (a || '').toLowerCase().replace(/^sm-/, '').replace(/^submind:/, '').trim()

;(async function initColonyRbac() {
  try {
    const res = await fetch('/api/rbac/me')
    if (!res.ok) return
    const me = await res.json()

    window.colonyRbac = {
      ...me,
      canChatWith(agentName) {
        if (me.isAdmin || me.role === 'admin') return true
        if (me.role === 'agent_manager') {
          const list = me.allowedAgents || []
          if (list.includes('*')) return true
          const target = normAgent(agentName)
          return list.some((allowed) => normAgent(allowed) === target)
        }
        return false // Spectator or unauthorized
      }
    }

    // Mount user identity pill to the brandbar / HUD
    const mountBadge = () => {
      if (document.getElementById('colony-rbac-badge')) return
      const badge = document.createElement('div')
      badge.id = 'colony-rbac-badge'
      badge.style.cssText = `
        position: fixed;
        top: 14px;
        right: 140px;
        background: rgba(14, 18, 25, 0.88);
        border: 1px solid ${me.role === 'admin' ? '#00e5ff' : me.role === 'agent_manager' ? '#ffd166' : me.role === 'spectator' ? '#8892b0' : '#ef4444'};
        color: #e2e8f0;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        font-weight: 600;
        padding: 5px 12px;
        border-radius: 9999px;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 6px;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        letter-spacing: 0.5px;
      `

      const roleColors = {
        admin: '#00e5ff',
        agent_manager: '#ffd166',
        spectator: '#a0aec0',
        unauthorized: '#ef4444'
      }

      badge.innerHTML = `
        <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${roleColors[me.role] || '#fff'};"></span>
        <span>${me.user?.email || 'Guest'}</span>
        <span style="opacity:0.6; text-transform:uppercase; font-size:10px; margin-left:2px;">[${me.role}]</span>
      `
      document.body.appendChild(badge)
    }

    if (document.body) mountBadge()
    else window.addEventListener('DOMContentLoaded', mountBadge)

  } catch (err) {
    console.warn('[RBAC] Client auth init error:', err)
  }
})()
