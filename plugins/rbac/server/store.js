import fs from 'node:fs'
import path from 'node:path'

const BARRED_EMAILS = new Set(['dale@sackrider.com'])

const ROOT_ADMIN_EMAILS = new Set([
  'dale.sackrider@gmail.com',
  'dalesackrider@gmail.com',
  'dsackrider@gmail.com'
])

export class RbacStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir || process.cwd(), 'rbac-users.json')
    this.data = {
      defaultRole: 'unauthorized', // Strict invite-only: no uninvited visitors allowed
      users: {}
    }
    this.load()
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
        this.data = {
          defaultRole: raw.defaultRole || 'unauthorized',
          users: raw.users || {}
        }
      }

      // Ensure root admin always exists
      const rootEmail = process.env.COLONY_ADMIN_EMAIL || 'dale.sackrider@gmail.com'
      const normalizedRoot = rootEmail.toLowerCase().trim()
      if (!this.data.users[normalizedRoot]) {
        this.data.users[normalizedRoot] = {
          role: 'admin',
          allowedAgents: ['*'],
          updatedAt: new Date().toISOString()
        }
      }

      // Guarantee barred email is purged
      for (const barred of BARRED_EMAILS) {
        if (this.data.users[barred]) {
          delete this.data.users[barred]
        }
      }
      this.save()
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
    if (!email) {
      return { role: 'unauthorized', allowedAgents: [] }
    }
    const normalized = email.toLowerCase().trim()

    // Explicitly barred emails never get access (not even spectator)
    if (BARRED_EMAILS.has(normalized)) {
      return { role: 'unauthorized', allowedAgents: [], barred: true }
    }

    // Recognize root admin emails
    if (ROOT_ADMIN_EMAILS.has(normalized)) {
      return {
        role: 'admin',
        allowedAgents: ['*']
      }
    }

    if (this.data.users[normalized]) {
      return this.data.users[normalized]
    }

    // Strict invite-only: uninvited visitors are unauthorized
    return {
      role: this.data.defaultRole || 'unauthorized',
      allowedAgents: []
    }
  }

  setUser(email, role, allowedAgents = []) {
    if (!email) throw new Error('Email is required.')
    const normalized = email.toLowerCase().trim()
    if (BARRED_EMAILS.has(normalized)) {
      throw new Error('This email address is barred from this colony.')
    }
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
    if (ROOT_ADMIN_EMAILS.has(normalized)) {
      throw new Error('Root administrator cannot be deleted.')
    }
    if (this.data.users[normalized]) {
      delete this.data.users[normalized]
      this.save()
      return true
    }
    return false
  }

  getAllUsers() {
    return {
      defaultRole: this.data.defaultRole || 'unauthorized',
      users: this.data.users
    }
  }
}
