import { AdministratorApiError } from '@aiventrahealth/administrator-ui'
import { apiFetch } from '../services/apiClient'

function unwrap(payload) {
  return payload?.data ?? payload?.result ?? payload
}

async function request(endpoint, options = {}) {
  const response = await apiFetch(endpoint, options)
  let payload = {}

  try {
    payload = await response.json()
  } catch {
    payload = {}
  }

  if (!response.ok || payload?.success === false) {
    const message = payload?.detail || payload?.message || payload?.error || `Request failed with status ${response.status}`
    throw new AdministratorApiError({ message, status: response.status, originalError: payload })
  }

  return unwrap(payload)
}

function mapUser(user) {
  return {
    ...user,
    fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    active: Boolean(user.active),
    roles: user.roles || [],
  }
}

function mapRole(role) {
  return {
    ...role,
    userCount: Number(role.userCount || 0),
  }
}

export const administratorApi = {
  async getDashboard() {
    const dashboard = await request('/api/administrator/dashboard')
    return {
      ...dashboard,
      totalUsers: Number(dashboard?.totalUsers || 0),
      activeUsers: Number(dashboard?.activeUsers || 0),
      inactiveUsers: Number(dashboard?.inactiveUsers || 0),
      adminUsers: Number(dashboard?.adminUsers || 0),
      usersByRole: dashboard?.usersByRole || [],
      recentActivity: dashboard?.recentActivity || [],
    }
  },

  async getUsers(query) {
    const result = await request(`/api/administrator/users${query ? `?${new URLSearchParams(query)}` : ''}`)
    return Array.isArray(result) ? result.map(mapUser) : { ...result, content: (result?.content || []).map(mapUser) }
  },

  async getUser(id) {
    return mapUser(await request(`/api/administrator/users/${encodeURIComponent(id)}`))
  },

  async createUser(body) {
    return mapUser(await request('/api/administrator/users', { method: 'POST', body }))
  },

  async updateUser(id, body) {
    return mapUser(await request(`/api/administrator/users/${encodeURIComponent(id)}`, { method: 'PUT', body }))
  },

  async activateUser(id) {
    await request(`/api/administrator/users/${encodeURIComponent(id)}/activate`, { method: 'POST' })
  },

  async deactivateUser(id) {
    await request(`/api/administrator/users/${encodeURIComponent(id)}/deactivate`, { method: 'POST' })
  },

  async resetPassword(id, body) {
    await request(`/api/administrator/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST', body })
  },

  async getRoles() {
    const result = await request('/api/administrator/roles')
    return (Array.isArray(result) ? result : result?.content || []).map(mapRole)
  },

  async getRole(id) {
    return mapRole(await request(`/api/administrator/roles/${encodeURIComponent(id)}`))
  },

  async createRole(body) {
    return mapRole(await request('/api/administrator/roles', { method: 'POST', body }))
  },

  async updateRole(id, body) {
    return mapRole(await request(`/api/administrator/roles/${encodeURIComponent(id)}`, { method: 'PUT', body }))
  },

  async setRoleStatus(id, status) {
    return mapRole(await request(`/api/administrator/roles/${encodeURIComponent(id)}/status?status=${encodeURIComponent(status)}`, { method: 'PATCH' }))
  },

  async getRolePermissions(id) {
    const result = await request(`/api/administrator/roles/${encodeURIComponent(id)}/permissions`)
    return Array.isArray(result) ? result : result?.content || []
  },

  async saveRolePermissions(id, permissions) {
    const result = await request(`/api/administrator/roles/${encodeURIComponent(id)}/permissions`, { method: 'PUT', body: permissions })
    return Array.isArray(result) ? result : result?.content || []
  },

  async getUserRoleAssignments(id) {
    const result = await request(`/api/administrator/users/${encodeURIComponent(id)}/role-assignments`)
    return Array.isArray(result) ? result : result?.content || []
  },

  async saveUserRoleAssignments(id, assignments) {
    return mapUser(await request(`/api/administrator/users/${encodeURIComponent(id)}/role-assignments`, { method: 'PUT', body: assignments }))
  },
}
