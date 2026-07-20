import { buildApiUrl } from '../config/api'

const ACTIVITY_LOGS_ENDPOINT = '/api/activity-logs'

export const createActivityLog = async ({ username, actionType, target, details }) => {
  const response = await fetch(buildApiUrl(ACTIVITY_LOGS_ENDPOINT), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      username: username || null,
      action_type: actionType,
      target,
      details: details || null,
    }),
  })

  let payload = {}

  try {
    payload = await response.json()
  } catch {
    payload = {}
  }

  if (!response.ok) {
    const detail = payload?.detail
    throw new Error(typeof detail === 'string' && detail.trim() ? detail : 'Failed to create activity log')
  }

  return payload
}

export const fetchActivityLogs = async ({ role, page = 1, pageSize = 25 }) => {
  const query = new URLSearchParams({
    requester_role: role,
    page: String(page),
    page_size: String(pageSize),
  })

  const response = await fetch(buildApiUrl(`${ACTIVITY_LOGS_ENDPOINT}?${query.toString()}`), {
    headers: {
      Accept: 'application/json',
    },
  })

  let payload = {}

  try {
    payload = await response.json()
  } catch {
    payload = {}
  }

  if (!response.ok) {
    const detail = payload?.detail
    throw new Error(typeof detail === 'string' && detail.trim() ? detail : 'Failed to fetch activity logs')
  }

  return payload
}
