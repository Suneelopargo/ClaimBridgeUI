import { buildApiUrl } from '../config/api'

const LOGIN_ENDPOINT = '/api/auth/login'

export const authenticateLogin = async ({ username, password }) => {
  const response = await fetch(buildApiUrl(LOGIN_ENDPOINT), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  let payload = {}

  try {
    payload = await response.json()
  } catch {
    payload = {}
  }

  if (!response.ok) {
    const detail = payload?.detail

    if (typeof detail === 'string' && detail.trim()) {
      throw new Error(detail)
    }

    throw new Error(`Login failed with status ${response.status}`)
  }

  return payload
}
