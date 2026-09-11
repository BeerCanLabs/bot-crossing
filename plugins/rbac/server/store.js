import fs from 'node:fs'
import path from 'node:path'

export class RbacStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir || process.cwd(), 'rbac-users.json')
    this.data = {
      defaultRole: 'spectator',
      users: {}
    }
    this.load()
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
        this.data = {
          defaultRole: raw.defaultRole || 'spectator',
          users: raw.users || {}
        }
      } else {
        // If file doesn't exist, create initial bootstrap with admin
        const initialAdmin = process.env.COLONY_ADMIN_EMAIL || 'dale@sackrider.com'
        this.data.users[initialAdmin.toLowerCase()] = {
          role: 'admin',
          allowedAgents: ['*'],
          updatedAt: new Date().toISOString()
        }
        this.save()
      }
    } catch (err) {
      console.error('[RBAC] Failed to load rbac-users.json:', err.message)
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      console.error('[RBAC] Failed to save rbac-users.json:', err.message)
    }
  }

  getUser(email) {
    if (!email) return { role: 'spectator', allowedAgents: [] }
    const normalized = email.toLowerCase().trim()
    
    // If table is completely empty, make the first user admin
    const userKeys = Object.keys(this.data.users)
    if (userKeys.length === 0) {
      this.setUser(normalized, 'admin', ['*'])
      return this.data.users[normalized]
    }

    if (this.data.users[normalized]) {
      return this.data.users[normalized]
    }

    // Unregistered user falls back to defaultRole
    return {
      role: this.data.defaultRole || 'spectator',
      allowedAgents: []
    }
  }

  setUser(email, role, allowedAgents = []) {
    if (!email) return
    const normalized = email.toLowerCase().trim()
    const validRoles = ['admin', 'agent_manager', 'spectator']
    const assignedRole = validRoles.includes(role) ? role : 'spectator'
    
    this.data.users[normalized] = {
      role: assignedRole,
      allowedAgents: assignedRole === 'admin' ? ['*'] : (Array.isArray(allowedAgents) ? allowedAgents : []),
      updatedAt: new Date().toISOString()
    }
    this.save()
    return this.data.users[normalized]
  }

  deleteUser(email) {
    if (!email) return false
    const normalized = email.toLowerCase().trim()
    if (this.data.users[normalized]) {
      delete this.data.users[normalized]
      this.save()
      return true
    }
    return false
  }

  getAllUsers() {
    return {
      defaultRole: this.data.defaultRole,
      users: this.data.users
    }
  }
}
