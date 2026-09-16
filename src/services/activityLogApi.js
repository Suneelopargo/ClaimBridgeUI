import { apiFetchJson } from './apiClient'

const ACTIVITY_LOGS_ENDPOINT = '/api/activity-logs'

export const createActivityLog = async ({ username, actionType, target, details }) => {
  return await apiFetchJson(ACTIVITY_LOGS_ENDPOINT, {
    method: 'POST',
    body: {
      username: username || null,
      action_type: actionType,
      target,
      details: details || null,
    },
  })
}

export const fetchActivityLogs = async ({ page = 1, pageSize = 25 } = {}) => {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })

  return await apiFetchJson(`${ACTIVITY_LOGS_ENDPOINT}?${query.toString()}`, {
    method: 'GET',
  })
}
