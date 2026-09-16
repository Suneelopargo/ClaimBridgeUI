import { useMemo } from 'react'
import { Administrator, AdministratorProvider } from '@aiventrahealth/administrator-ui'
import { administratorApi } from '../adapters/administratorApi'
import { AUTH_ROLES_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from '../services/apiClient'

function readStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem(AUTH_USER_STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

function readStoredRoles() {
  try {
    const roles = JSON.parse(sessionStorage.getItem(AUTH_ROLES_STORAGE_KEY) || '[]')
    return Array.isArray(roles) ? roles : []
  } catch {
    return []
  }
}

export default function AdministratorPage() {
  const user = readStoredUser()
  const roles = readStoredRoles()

  const auth = useMemo(
    () => ({
      getCurrentUser: () =>
        user
          ? {
              id: user.id,
              username: user.username || user.userName || '',
              name: user.fullName || user.name || user.username || '',
              email: user.email,
              roles,
            }
          : null,
      hasAdministratorAccess: () =>
        roles.some((role) =>
          ['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN', 'SUPERUSER'].includes(
            String(role).toUpperCase(),
          ),
        ),
    }),
    [roles, user],
  )

  return (
    <div className="administrator-module">
      <AdministratorProvider
        api={administratorApi}
        auth={auth}
        config={{
          title: 'ClaimBridge Administration',
          subtitle: 'Manage administrator accounts, roles, and permissions for claims operations.',
          features: {
            dashboard: true,
            users: true,
            roles: true,
            providerMapping: false,
            locationAccess: false,
            auditTrail: false,
          },
        }}
      >
        <Administrator />
      </AdministratorProvider>
    </div>
  )
}
