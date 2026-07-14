const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || ''

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '')

export const buildApiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (!API_BASE_URL) {
    return normalizedPath
  }

  return `${API_BASE_URL}${normalizedPath}`
}
