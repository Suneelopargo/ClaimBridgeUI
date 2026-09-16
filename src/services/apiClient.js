import { buildApiUrl } from '../config/api'

export const AUTH_STORAGE_KEY = 'claimbridge-admin-auth'
export const AUTH_ROLES_STORAGE_KEY = 'claimbridge-user-roles'
export const AUTH_USER_STORAGE_KEY = 'claimbridge-user-data'
export const AUTH_TOKEN_STORAGE_KEY = 'claimbridge-auth-token'

export const UNAUTHORIZED_EVENT = 'claimbridge:unauthorized'

export function getAuthToken() {
  try {
    const token = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    if (token && typeof token === 'string' && token.trim().length > 0) {
      return token.trim()
    }
  } catch {
    // Ignore storage read failures in restricted environments
  }
  return null
}

export function setAuthToken(token) {
  try {
    if (typeof token === 'string' && token.trim().length > 0) {
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token.trim())
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    }
  } catch {
    // Ignore storage write failures
  }
}

export function removeAuthToken() {
  try {
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  } catch {
    // Ignore storage deletion failures
  }
}

export function clearAllAuthData() {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    sessionStorage.removeItem(AUTH_ROLES_STORAGE_KEY)
    sessionStorage.removeItem(AUTH_USER_STORAGE_KEY)
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  } catch {
    // Ignore storage failures
  }

  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(AUTH_ROLES_STORAGE_KEY)
    localStorage.removeItem(AUTH_USER_STORAGE_KEY)
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  } catch {
    // Ignore storage failures
  }
}

export function extractErrorMessage(payload, fallbackMessage = 'Request failed') {
  const candidate =
    payload?.detail ||
    payload?.error ||
    payload?.message ||
    payload?.result?.error ||
    payload?.result?.message

  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim()
  }

  if (Array.isArray(candidate) && candidate.length > 0) {
    const first = candidate[0]
    if (typeof first === 'string') return first
    if (first?.msg) return first.msg
  }

  return fallbackMessage
}

export async function apiFetch(endpointOrUrl, options = {}) {
  const isAbsoluteUrl = /^https?:\/\//i.test(endpointOrUrl)
  const fullUrl = isAbsoluteUrl ? endpointOrUrl : buildApiUrl(endpointOrUrl)

  const headers = new Headers(options.headers || {})

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  const token = getAuthToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let body = options.body
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const isSearchParams = typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams

  if (body && !isFormData && !isSearchParams && typeof body === 'object' && !(body instanceof Blob)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    body = JSON.stringify(body)
  }

  const fetchOptions = {
    ...options,
    headers,
    body,
  }

  if (!fetchOptions.credentials && fetchOptions.credentials !== 'omit') {
    fetchOptions.credentials = 'include'
  }

  const response = await fetch(fullUrl, fetchOptions)

  if (response.status === 401 && !options.skipAuthEvent) {
    try {
      window.dispatchEvent(
        new CustomEvent(UNAUTHORIZED_EVENT, {
          detail: { url: fullUrl, status: 401 },
        }),
      )
    } catch {
      // Ignore event dispatch failures
    }
  }

  return response
}

export async function apiFetchJson(endpointOrUrl, options = {}) {
  const response = await apiFetch(endpointOrUrl, options)

  let payload = {}
  try {
    payload = await response.json()
  } catch {
    payload = {}
  }

  if (!response.ok) {
    const defaultMsg = `Request failed with status ${response.status}`
    throw new Error(extractErrorMessage(payload, defaultMsg))
  }

  return payload
}
