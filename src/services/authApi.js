import { apiFetchJson } from './apiClient'

const LOGIN_ENDPOINT = '/api/auth/login'

export const authenticateLogin = async ({ username, password }) => {
  return await apiFetchJson(LOGIN_ENDPOINT, {
    method: 'POST',
    body: { username, password },
    skipAuthEvent: true,
  })
}

export function extractTokenFromAuthPayload(payload) {
  const tokenCandidates = [
    payload?.access_token,
    payload?.accessToken,
    payload?.token,
    payload?.jwtToken,
    payload?.jwt,
    payload?.data?.access_token,
    payload?.data?.accessToken,
    payload?.data?.token,
    payload?.data?.jwt,
    payload?.auth?.token,
    payload?.auth?.access_token,
  ]

  const foundToken = tokenCandidates.find(
    (item) => typeof item === 'string' && item.trim().length > 0,
  )

  return foundToken ? foundToken.trim() : null
}

export function extractRolesFromAuthPayload(payload) {
  const roleCandidates = [
    payload?.roles,
    payload?.data?.roles,
    payload?.user?.roles,
  ]

  const roleList = roleCandidates.find((item) => Array.isArray(item))

  if (Array.isArray(roleList)) {
    return roleList
      .map((role) => String(role || '').trim())
      .filter((role) => role.length > 0)
  }

  const singleRoleCandidates = [
    payload?.role,
    payload?.data?.role,
    payload?.user?.role,
    payload?.roleDescription,
    payload?.data?.roleDescription,
    payload?.user?.roleDescription,
  ]

  const singleRole = singleRoleCandidates.find(
    (item) => typeof item === 'string' && item.trim().length > 0,
  )

  return singleRole ? [singleRole.trim()] : []
}

export function extractUserFromAuthPayload(payload) {
  if (payload?.user && typeof payload.user === 'object' && !Array.isArray(payload.user)) {
    return payload.user
  }

  if (payload?.data?.user && typeof payload.data.user === 'object' && !Array.isArray(payload.data.user)) {
    return payload.data.user
  }

  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }

  return null
}
