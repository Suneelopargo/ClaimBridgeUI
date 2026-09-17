import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { API_BASE_URL, buildApiUrl } from './config/api'
import Footer from './components/Footer'
import LoadingOverlay from './components/LoadingOverlay'
import { DashboardSkeleton, DashboardWidget, EmptyState, PageHeader, KpiCard, StatusBadge } from './design-system'
import ClaimValidationsPage from './components/ClaimValidationsPage'
import ClaimPacketProcessingPage from './components/ClaimPacketProcessingPage'
import ReconciliationRecordsPage from './components/ReconciliationRecordsPage'
import AdministratorPage from './pages/AdministratorPage'
import {
  authenticateLogin,
  extractRolesFromAuthPayload,
  extractTokenFromAuthPayload,
  extractUserFromAuthPayload,
} from './services/authApi'
import {
  AUTH_ROLES_STORAGE_KEY,
  AUTH_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  API_LOADING_EVENT,
  getActiveApiRequests,
  UNAUTHORIZED_EVENT,
  apiFetch,
  clearAllAuthData,
  setAuthToken,
} from './services/apiClient'
import { createActivityLog, fetchActivityLogs } from './services/activityLogApi'
import './App.css'
const ENABLE_IDLE_AUTO_LOGOUT = String(
  import.meta.env.VITE_ENABLE_IDLE_AUTO_LOGOUT ?? 'false',
).toLowerCase() === 'true'
const IDLE_TIMEOUT_MS = 10 * 60 * 1000
const IDLE_WARNING_LEAD_MS = 2 * 60 * 1000
const IDLE_WARNING_TIMEOUT_MS = IDLE_TIMEOUT_MS - IDLE_WARNING_LEAD_MS
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
const IDLE_WARNING_LEAD_SECONDS = Math.floor(IDLE_WARNING_LEAD_MS / 1000)
const GLOBAL_LOADER_SHOW_DELAY_MS = 140
const GLOBAL_LOADER_MIN_VISIBLE_MS = 360
const GLOBAL_LOADER_REQUEST_GRACE_MS = 180
const IHX_SYNC_ENDPOINT = buildApiUrl('/api/ihx/sync')
const DASHBOARD_SUMMARY_ENDPOINT = buildApiUrl('/api/dashboard/claim-status-summary')
const API_DOCS_URL = buildApiUrl('/docs')
const BACKEND_TARGET_LABEL = API_BASE_URL || 'the current host /api path'

const STATUS_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)']
const CLAIMED_BAR_COLOR = 'var(--chart-1)'
const APPROVED_BAR_COLOR = 'var(--chart-2)'
const REFRESH_OPTIONS = [0, 30, 60, 300]

const WORKSPACE_TABS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Claim volumes, status mix, and amount trends at a glance.',
  },
  {
    id: 'administrator',
    label: 'Administration',
    description: 'Manage users, roles, and platform configuration.',
  },
  {
    id: 'claim-packet-processing',
    label: 'Packet Processing',
    description: 'Process and track inbound claim packet submissions.',
  },
  {
    id: 'ihx-sync',
    label: 'IHX Ingestion',
    description: 'Trigger and monitor IHX claim data synchronization.',
  },
  {
    id: 'claim-validations',
    label: 'Claim Validations',
    description: 'Review validation outcomes across submitted claims.',
  },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    description: 'Reconcile claim records against portal ledgers.',
  },
  {
    id: 'activity-log',
    label: 'Activity Log',
    description: 'Audit trail of user actions across the workspace.',
  },
]

const MODULE_ICON_PATHS = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.4" />
      <rect x="13.5" y="10.5" width="7" height="10" rx="1.4" />
      <rect x="3.5" y="13" width="7" height="7.5" rx="1.4" />
    </>
  ),
  administrator: (
    <>
      <path d="M12 3.5l7 2.6v5.4c0 4.4-3 8.4-7 9.6-4-1.2-7-5.2-7-9.6V6.1z" />
      <path d="M9.3 12.2l1.9 1.9 3.6-3.9" />
    </>
  ),
  'claim-packet-processing': (
    <>
      <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5V8h4" />
      <path d="M8.5 12.5h7M8.5 16h7" />
    </>
  ),
  'ihx-sync': (
    <>
      <path d="M4.5 9.5a7.5 7.5 0 0 1 12.6-4.2l1.9 1.8" />
      <path d="M19.5 14.5a7.5 7.5 0 0 1-12.6 4.2l-1.9-1.8" />
      <path d="M17.4 3.8v3.6H13.8" />
      <path d="M6.6 20.2v-3.6h3.6" />
    </>
  ),
  'claim-validations': (
    <>
      <path d="M12 3.5l7 2.6v5.4c0 4.4-3 8.4-7 9.6-4-1.2-7-5.2-7-9.6V6.1z" />
      <path d="M9 12l2.1 2.1L15.4 9.8" />
    </>
  ),
  reconciliation: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.6" />
      <path d="M3.5 9.5h17" />
      <path d="M9.2 9.5V20" />
    </>
  ),
  'activity-log': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 1.9" />
    </>
  ),
}

function ModuleIcon({ moduleId }) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      {MODULE_ICON_PATHS[moduleId] ?? <circle cx="12" cy="12" r="8.5" />}
    </svg>
  )
}

function getInitials(name) {
  const trimmed = String(name || '').trim()

  if (!trimmed) {
    return 'CB'
  }

  const parts = trimmed.split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')

  return initials || trimmed.slice(0, 2).toUpperCase()
}

const DASHBOARD_SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
        <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.4" />
        <rect x="13.5" y="10.5" width="7" height="10" rx="1.4" />
        <rect x="3.5" y="13" width="7" height="7.5" rx="1.4" />
      </>
    ),
  },
  {
    id: 'status-distribution',
    label: 'Status Distribution',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5V12l6 3.4" />
      </>
    ),
  },
  {
    id: 'amount-comparison',
    label: 'Amount Comparison',
    icon: (
      <>
        <path d="M4.5 20V10" />
        <path d="M12 20V4.5" />
        <path d="M19.5 20v-7" />
        <path d="M3.5 20h17" />
      </>
    ),
  },
  {
    id: 'status-snapshot',
    label: 'Status Snapshot',
    icon: (
      <>
        <path d="M5 6.5h14" />
        <path d="M5 12h14" />
        <path d="M5 17.5h9" />
      </>
    ),
  },
  {
    id: 'source-details',
    label: 'Source Details',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 10.5v6" />
        <circle cx="12" cy="7.8" r="0.6" fill="currentColor" stroke="none" />
      </>
    ),
  },
]

function SidebarIcon({ children }) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      {children}
    </svg>
  )
}

const TOOLBAR_ICON_PATHS = {
  refresh: (
    <>
      <path d="M4.5 9.5a7.5 7.5 0 0 1 12.6-4.2l1.9 1.8" />
      <path d="M19.5 14.5a7.5 7.5 0 0 1-12.6 4.2l-1.9-1.8" />
      <path d="M17.4 3.8v3.6H13.8" />
      <path d="M6.6 20.2v-3.6h3.6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 10.5v6" />
      <circle cx="12" cy="7.8" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  filter: (
    <>
      <path d="M4 5.5h16l-6 7.4V19l-4 1.5v-7.6z" />
    </>
  ),
  claims: (
    <>
      <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5V8h4" />
      <path d="M8.5 12.5h7M8.5 16h4.5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.5" y="6" width="17" height="13" rx="2" />
      <path d="M3.5 10h17" />
      <circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.3l2.3 2.3L15.6 9.6" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 15.5a8 8 0 1 1 16 0" />
      <path d="M12 15.5l3.2-4.4" />
      <circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
}

function ToolbarIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      {TOOLBAR_ICON_PATHS[name] ?? null}
    </svg>
  )
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatCompactNumber = (value) =>
  new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0))

const formatCurrencyCompact = (value) => {
  const amount = Number(value || 0)
  const absoluteAmount = Math.abs(amount)

  if (absoluteAmount >= 10000000) {
    return `₹${(amount / 10000000).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Cr`
  }

  if (absoluteAmount >= 100000) {
    return `₹${(amount / 100000).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} L`
  }

  return formatCurrency(amount)
}

const formatPercent = (value) => `${value.toFixed(1)}%`

const formatStatusTick = (value) => {
  const label = String(value ?? '')
  return label.length > 14 ? `${label.slice(0, 12)}..` : label
}

function getStoredAuth() {
  return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true'
}

function getStoredRoles() {
  try {
    const rawValue = sessionStorage.getItem(AUTH_ROLES_STORAGE_KEY)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue)

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue
      .map((role) => String(role || '').trim())
      .filter((role) => role.length > 0)
  } catch {
    return []
  }
}

function getStoredUser() {
  try {
    const rawValue = sessionStorage.getItem(AUTH_USER_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (!parsedValue || typeof parsedValue !== 'object') {
      return null
    }

    return parsedValue
  } catch {
    return null
  }
}

function hasSuperuserRole(roles) {
  return roles.some((role) => role.toLowerCase() === 'superuser')
}

function clearClientStorage() {
  clearAllAuthData()
}

function resolveUserName(userData) {
  const userNameCandidates = [
    userData?.username,
    userData?.userName,
    userData?.fullName,
    userData?.name,
  ]

  const firstValidUserName = userNameCandidates.find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  )

  return firstValidUserName ? firstValidUserName.trim() : null
}

function resolvePrimaryRole(roles) {
  return roles.find((role) => typeof role === 'string' && role.trim().length > 0) || ''
}

function ProtectedRoute({ isAuthenticated, children, onUnauthorized }) {
  const location = useLocation()

  useEffect(() => {
    if (!isAuthenticated) {
      onUnauthorized?.()
    }
  }, [isAuthenticated, onUnauthorized])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

function LoginPage({ isAuthenticated, onLogin }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const payload = await authenticateLogin(formData)

      if (!payload?.success) {
        throw new Error('Invalid credentials.')
      }

      onLogin(payload)
      const redirectPath = location.state?.from?.pathname || '/dashboard'
      navigate(redirectPath, { replace: true })
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to authenticate login details.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel auth-panel--intro">
        <span className="eyebrow">ClaimBridge Analytics</span>
        <h1>Claims monitoring built for faster operational decisions.</h1>
        <p>
          Sign in to review claim volumes, status distribution, and amount trends from the
          live dashboard summary API.
        </p>

        <div className="auth-feature-grid">
          <article>
            <strong>Live status mix</strong>
            <span>Track active claim outcomes in a single view.</span>
          </article>
          <article>
            <strong>Financial visibility</strong>
            <span>Compare claimed and approved amounts by status.</span>
          </article>
          <article>
            <strong>Secure routing</strong>
            <span>Protected dashboard access with admin sign-in.</span>
          </article>
        </div>
      </section>

      <section className="auth-panel auth-panel--form">
        <div className="auth-card">
          <div>
            
            <h2>Welcome back</h2>
            <p className="auth-copy">Use the demo administrator credentials to continue.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              <span>Username</span>
              <input
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                placeholder="Username"
                autoComplete="username"
              />
            </label>

            <label>
              <span>Password</span>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="password"
                autoComplete="current-password"
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}

function DashboardPage({ isActive = true }) {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshInterval, setRefreshInterval] = useState(60)
  const [isCompactChart, setIsCompactChart] = useState(() =>
    window.matchMedia('(max-width: 960px)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 960px)')
    const handleMediaChange = (event) => {
      setIsCompactChart(event.matches)
    }

    mediaQuery.addEventListener('change', handleMediaChange)

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  }, [])

  const fetchDashboard = async (showLoader = true) => {
    if (showLoader) {
      setLoading(true)
    }
    setError('')

    try {
      const response = await apiFetch('/api/dashboard/claim-status-summary')

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const payload = await response.json()

      setDashboardData(payload)
      setLastUpdated(new Date())
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to load dashboard data.',
      )
    } finally {
      if (showLoader) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!isActive) {
      return undefined
    }

    let active = true

    const loadDashboard = async (showLoader = true) => {
      if (!active) {
        return
      }

      if (showLoader) {
        setLoading(true)
      }
      setError('')

      try {
        const response = await apiFetch('/api/dashboard/claim-status-summary')

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()

        if (!active) {
          return
        }

        setDashboardData(payload)
        setLastUpdated(new Date())
      } catch (requestError) {
        if (!active) {
          return
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load dashboard data.',
        )
      } finally {
        if (active && showLoader) {
          setLoading(false)
        }
      }
    }

    loadDashboard()

    if (refreshInterval > 0) {
      const timerId = window.setInterval(() => {
        loadDashboard(false)
      }, refreshInterval * 1000)

      return () => {
        active = false
        window.clearInterval(timerId)
      }
    }

    return () => {
      active = false
    }
  }, [refreshInterval, isActive])

  const statusData = useMemo(() => dashboardData?.statuses ?? [], [dashboardData])

  const totals = useMemo(() => {
    return statusData.reduce(
      (summary, statusItem) => ({
        claimedAmount: summary.claimedAmount + Number(statusItem.claimedAmount || 0),
        approvedAmount: summary.approvedAmount + Number(statusItem.approvedAmount || 0),
      }),
      { claimedAmount: 0, approvedAmount: 0 },
    )
  }, [statusData])

  const statusDistribution = useMemo(() => {
    const totalCount = statusData.reduce((sum, statusItem) => sum + Number(statusItem.count || 0), 0)

    return statusData.map((statusItem) => {
      const count = Number(statusItem.count || 0)
      const percentage = totalCount ? (count / totalCount) * 100 : 0

      return {
        ...statusItem,
        percentage,
      }
    })
  }, [statusData])

  const approvalRatio = totals.claimedAmount
    ? Math.round((totals.approvedAmount / totals.claimedAmount) * 100)
    : 0

  // These are derived from the live status summary. No lifecycle counts or
  // operational labels are invented when the API does not return a matching state.
  const processingStates = statusDistribution.filter(({ status }) =>
    /pre auth submitted|submitted to payer|pre auth in progress|pre auth approved|claim approved|settled/i.test(status),
  )
  const attentionStates = statusDistribution.filter(({ status }) =>
    /denied|cancelled|in progress|submitted to payer|rejected|pending/i.test(status),
  )

  const lastUpdatedLabel = lastUpdated
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(lastUpdated)
    : 'Not refreshed yet'

  return (
    <main className="dashboard-shell dashboard-layout">
      <section className="dashboard-main">
        <div className="breadcrumb-bar">
          <div className="breadcrumb-bar__path">
            <span className="breadcrumb-bar__icon" aria-hidden="true">
              <SidebarIcon>{DASHBOARD_SECTIONS[0].icon}</SidebarIcon>
            </span>
            <span>Dashboard</span>
            <span className="breadcrumb-bar__sep">/</span>
            <strong>Overview</strong>
          </div>

          <div className="breadcrumb-bar__actions">
            <select
              className="toolbar-select"
              value={refreshInterval}
              onChange={(event) => setRefreshInterval(Number(event.target.value))}
              title="Auto-refresh cadence"
            >
              {REFRESH_OPTIONS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds === 0 ? 'Auto-refresh off' : `Refresh every ${seconds}s`}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button"
              title="Refresh dashboard data"
              onClick={() => fetchDashboard(Boolean(!dashboardData))}
            >
              <ToolbarIcon name="refresh" />
            </button>
            <button
              type="button"
              className="icon-button"
              title={`Last sync: ${lastUpdatedLabel}`}
            >
              <ToolbarIcon name="info" />
            </button>
            <button
              type="button"
              className="icon-button"
              disabled
              title="Date range filters require backend support"
            >
              <ToolbarIcon name="filter" />
            </button>
          </div>
        </div>

        <header className="topbar" id="overview">
          <div>
            <span className="eyebrow">Operations Dashboard</span>
          </div>
        </header>

        {error ? (
          <EmptyState
            tone="error"
            title="Unable to load claims"
            description={`${error} Make sure the backend is reachable at ${BACKEND_TARGET_LABEL}.`}
            action={<button type="button" className="secondary-button" onClick={() => fetchDashboard(true)}>Retry</button>}
          />
        ) : null}

        {loading && !dashboardData ? (
          <section className="dashboard-loading-grid" aria-live="polite">
            {Array.from({ length: 4 }).map((_, index) => <DashboardSkeleton key={index} variant="kpi" />)}
            {Array.from({ length: 2 }).map((_, index) => <DashboardSkeleton key={`chart-${index}`} />)}
          </section>
        ) : null}

        {!error && dashboardData ? (
          <>
            <section className="stats-grid">
              <KpiCard
                label="Total Claims"
                value={dashboardData.totalClaims}
                helpText="Across all returned statuses"
                icon={<ToolbarIcon name="claims" />}
                tone="blue"
              />
              <KpiCard
                label="Claimed Amount"
                value={formatCurrencyCompact(totals.claimedAmount)}
                helpText={`${formatCurrency(totals.claimedAmount)} total claimed value`}
                icon={<ToolbarIcon name="wallet" />}
                tone="amber"
              />
              <KpiCard
                label="Approved Amount"
                value={formatCurrencyCompact(totals.approvedAmount)}
                helpText={`${formatCurrency(totals.approvedAmount)} approved so far`}
                icon={<ToolbarIcon name="check" />}
                tone="green"
              />
              <KpiCard
                label="Approval Ratio"
                value={`${approvalRatio}%`}
                helpText="Approved vs claimed value"
                icon={<ToolbarIcon name="gauge" />}
                tone="violet"
                progress={approvalRatio}
              />
            </section>

            <section className="chart-grid">
              <DashboardWidget className="chart-panel" id="status-distribution" title="Claims by status" subtitle="Share of total claims by current status." actions={
                <button type="button" className="icon-button icon-button--ghost" title="Share of total claims by current status">
                  <ToolbarIcon name="info" />
                </button>
              }>

              <div className="chart-area chart-area--pie">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [value, 'Claims']}
                      position={{ y: 8 }}
                      wrapperStyle={{ zIndex: 30 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="chart-area__center-label" aria-hidden="true">
                  <strong>{dashboardData.totalClaims}</strong>
                  <span>Total claims</span>
                </div>
              </div>

              <div className="status-distribution-legend" aria-label="Status distribution breakdown">
                {statusDistribution.map((statusItem, index) => (
                  <article className="status-distribution-legend__item" key={`${statusItem.status}-legend`}>
                    <span
                      className="status-dot"
                      style={{ backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length] }}
                    ></span>
                    <span className="status-distribution-legend__label">{statusItem.status}</span>
                    <span className="status-distribution-legend__metrics">
                      {statusItem.count} ({formatPercent(statusItem.percentage)})
                    </span>
                  </article>
                ))}
              </div>
              </DashboardWidget>

              <DashboardWidget className="chart-panel" id="amount-comparison" title="Claim value by status" subtitle="Claimed and approved values grouped by status." actions={
                <button type="button" className="icon-button icon-button--ghost" title="Claimed and approved values grouped by status">
                  <ToolbarIcon name="info" />
                </button>
              }>

              <div className="chart-area">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} barGap={10}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis
                      dataKey="status"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatStatusTick}
                      interval="preserveStartEnd"
                      angle={isCompactChart ? -24 : 0}
                      textAnchor={isCompactChart ? 'end' : 'middle'}
                      tickMargin={isCompactChart ? 12 : 8}
                      height={isCompactChart ? 64 : 36}
                    />
                    <YAxis tickFormatter={formatCompactNumber} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend align="left" verticalAlign="bottom" />
                    <Bar
                      dataKey="claimedAmount"
                      name="Claimed Amount"
                      radius={[10, 10, 0, 0]}
                      fill={CLAIMED_BAR_COLOR}
                    />
                    <Bar
                      dataKey="approvedAmount"
                      name="Approved Amount"
                      radius={[10, 10, 0, 0]}
                      fill={APPROVED_BAR_COLOR}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              </DashboardWidget>
          </section>

            <section className="chart-grid chart-grid--secondary">
              <DashboardWidget id="status-snapshot" title="Processing pipeline" subtitle="Live lifecycle states returned by the claims summary." actions={
                <button type="button" className="icon-button icon-button--ghost" title="Live lifecycle states returned by the claims summary">
                  <ToolbarIcon name="info" />
                </button>
              }>
                {processingStates.length ? <div className="pipeline-list">
                  {processingStates.map((item) => <div className="pipeline-list__item" key={item.status}>
                    <StatusBadge status={item.status} />
                    <strong>{formatCompactNumber(item.count)}</strong>
                    <span>{formatPercent(item.percentage)}</span>
                  </div>)}
                </div> : <EmptyState title="Pipeline data unavailable" description="The current summary does not expose lifecycle status detail." />}
              </DashboardWidget>

              <DashboardWidget title="Operational attention" subtitle="States that may need review, based on their current status.">
                {attentionStates.length ? <div className="attention-list">
                  {attentionStates.map((item) => <div className="attention-list__item" key={item.status}>
                    <StatusBadge status={item.status} />
                    <span>{formatCompactNumber(item.count)} claims</span>
                    <strong>{formatPercent(item.percentage)}</strong>
                  </div>)}
                </div> : <EmptyState title="No attention states returned" description="The current summary does not include pending, denied, cancelled, or rejected statuses." />}
              </DashboardWidget>
            </section>

            <section className="dashboard-widget dashboard-source" id="source-details">
              <details className="data-source-disclosure">
                <summary>
                  <span>Data source</span>
                  <small>Connected to the live claim summary endpoint</small>
                </summary>

                <dl className="info-list">
                  <div>
                    <dt>Endpoint</dt>
                    <dd>/api/dashboard/claim-status-summary</dd>
                  </div>
                  <div>
                    <dt>Auth mode</dt>
                    <dd>Backend login API with protected routes</dd>
                  </div>
                  <div>
                    <dt>Refresh model</dt>
                    <dd>{refreshInterval === 0 ? 'Manual refresh only' : `Automatic every ${refreshInterval} seconds`}</dd>
                  </div>
                  <div>
                    <dt>Date filters</dt>
                    <dd>Waiting for backend date-range support</dd>
                  </div>
                </dl>
              </details>
            </section>
        </>
      ) : null}
      </section>
    </main>
  )
}

function IhxSyncPage() {
  const [startPage, setStartPage] = useState('1')
  const [maxPages, setMaxPages] = useState('130')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [syncResult, setSyncResult] = useState(null)
  const [lastRunAt, setLastRunAt] = useState(null)

  const runLabel = lastRunAt
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(lastRunAt)
    : 'Not run yet'

  const syncPath = useMemo(() => {
    const query = new URLSearchParams({
      start_page: startPage || '1',
      max_pages: maxPages || '1',
    })

    return `${IHX_SYNC_ENDPOINT}?${query.toString()}`
  }, [startPage, maxPages])

  const handleSyncSubmit = async (event) => {
    event.preventDefault()

    const parsedStartPage = Number(startPage)
    const parsedMaxPages = Number(maxPages)

    if (!Number.isInteger(parsedStartPage) || parsedStartPage < 1) {
      setSyncError('Start page must be a positive whole number.')
      return
    }

    if (!Number.isInteger(parsedMaxPages) || parsedMaxPages < 1) {
      setSyncError('Max pages must be a positive whole number.')
      return
    }

    setIsSyncing(true)
    setSyncError('')

    try {
      const response = await apiFetch(syncPath, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Sync request failed with status ${response.status}`)
      }

      const responseText = await response.text()
      const payload = responseText ? JSON.parse(responseText) : {}
      setSyncResult(payload)
      setLastRunAt(new Date())
    } catch (requestError) {
      setSyncError(
        requestError instanceof Error ? requestError.message : 'Unable to run IHX sync.',
      )
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <main className="dashboard-shell ihx-sync-shell">
      <LoadingOverlay isVisible={isSyncing} />

      <section className="panel ihx-sync-panel">
        <div className="panel-heading">
          <div>
            <h2>Run ingestion</h2>
            <p>
              Run staged IHX pulls into ClaimBridge and continue work in other tabs without losing
              request context or API output.
            </p>
          </div>
        </div>

        <div className="ihx-sync-context">
          <article>
            <h3>Why this screen</h3>
            <p>
              Use this for controlled backfill and re-sync operations when claims are delayed,
              corrected, or newly available from IHX.
            </p>
          </article>
          <article>
            <h3>How it runs</h3>
            <p>
              Sends a POST request to the backend sync API with page-range query params and shows
              the latest response payload for review.
            </p>
          </article>
        </div>

        <form className="ihx-sync-form" onSubmit={handleSyncSubmit}>
          <label>
            <span>Start page (from IHX)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={startPage}
              onChange={(event) => setStartPage(event.target.value)}
              placeholder="1"
            />
          </label>

          <label>
            <span>Max pages to ingest</span>
            <input
              type="number"
              min="1"
              step="1"
              value={maxPages}
              onChange={(event) => setMaxPages(event.target.value)}
              placeholder="130"
            />
          </label>

          <button type="submit" className="primary-button" disabled={isSyncing}>
            {isSyncing ? 'Ingestion in progress...' : 'Start IHX Ingestion'}
          </button>
        </form>

        {syncError ? <p className="form-error">{syncError}</p> : null}

        <div className="ihx-sync-meta">
        
          <p>
            <strong>Last run:</strong> {runLabel}
          </p>
        </div>
      </section>

      <section className="panel ihx-sync-result">
        <div className="panel-heading">
          <div>
            <h2>Ingestion response log</h2>
            <p>Latest backend response for IHX ingestion verification and troubleshooting.</p>
          </div>
        </div>

        {syncResult ? (
          <pre>{JSON.stringify(syncResult, null, 2)}</pre>
        ) : (
          <p>No sync result yet. Run sync to view response data here.</p>
        )}
      </section>
    </main>
  )
}

function ActivityLogPage({ isActive = false, currentRole }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [userFilter, setUserFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [targetFilter, setTargetFilter] = useState('all')
  const [ipFilter, setIpFilter] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const allLogs = []
      let currentPage = 1
      let totalFromApi = 0

      while (true) {
        const payload = await fetchActivityLogs({
          page: currentPage,
          pageSize: 200,
        })

        const pageItems = Array.isArray(payload?.items) ? payload.items : []
        const payloadTotal = Number(payload?.total || 0)

        if (payloadTotal > 0) {
          totalFromApi = payloadTotal
        }

        allLogs.push(...pageItems)

        if (!pageItems.length) {
          break
        }

        if (totalFromApi > 0 && allLogs.length >= totalFromApi) {
          break
        }

        if (pageItems.length < 200) {
          break
        }

        currentPage += 1

        if (currentPage > 1000) {
          throw new Error('Stopped loading activity logs after 1000 pages to avoid an infinite loop.')
        }
      }

      setLogs(allLogs)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to load activity logs.',
      )
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [currentRole])

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadLogs()
  }, [isActive, loadLogs])

  useEffect(() => {
    setPage(1)
  }, [pageSize, searchQuery, userFilter, actionFilter, targetFilter, ipFilter])

  const userOptions = useMemo(() => {
    const values = logs
      .map((item) => item.username)
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')

    return Array.from(new Set(values.map((value) => String(value)))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [logs])

  const actionOptions = useMemo(() => {
    const values = logs
      .map((item) => item.action_type)
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')

    return Array.from(new Set(values.map((value) => String(value)))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [logs])

  const targetOptions = useMemo(() => {
    const values = logs
      .map((item) => item.target)
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')

    return Array.from(new Set(values.map((value) => String(value)))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [logs])

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    const normalizedIpFilter = ipFilter.trim().toLowerCase()

    return logs.filter((item) => {
      const matchesUser = userFilter === 'all' ? true : String(item.username || '') === userFilter
      const matchesAction = actionFilter === 'all' ? true : String(item.action_type || '') === actionFilter
      const matchesTarget = targetFilter === 'all' ? true : String(item.target || '') === targetFilter
      const matchesIp = normalizedIpFilter.length
        ? String(item.ip_address || '').toLowerCase().includes(normalizedIpFilter)
        : true

      if (!matchesUser || !matchesAction || !matchesTarget || !matchesIp) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const timestampLabel = item.timestamp
        ? new Date(item.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : ''

      const searchableText = [
        item.username,
        item.action_type,
        item.target,
        item.details,
        item.ip_address,
        timestampLabel,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')

      return searchableText.includes(normalizedSearch)
    })
  }, [logs, searchQuery, userFilter, actionFilter, targetFilter, ipFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paginatedLogs = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return filteredLogs.slice(startIndex, startIndex + pageSize)
  }, [filteredLogs, page, pageSize])

  return (
    <main className="dashboard-shell activity-log-shell">
      <section className="panel activity-log-panel">
        <div className="panel-heading">
          <div>
            <h2>Access &amp; action history</h2>
            <p>Superuser view of tracked screen access and user actions.</p>
          </div>
        </div>

        <div className="activity-log-controls">
          <label className="activity-log-search">
            <span>Overall Search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search user, action, target, details, ip..."
            />
          </label>

        

          

          


          <label>
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>

          <button type="button" className="secondary-button" onClick={loadLogs} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="activity-log-table-wrap">
          <table className="activity-log-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="activity-log-empty">
                    {loading ? 'Loading activity logs...' : 'No activity logs found for current filters.'}
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.timestamp
                        ? new Date(item.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                        : '-'}
                    </td>
                    <td>{item.username || '-'}</td>
                    <td>{item.action_type}</td>
                    <td>{item.target}</td>
                    <td>{item.details || '-'}</td>
                    <td>{item.ip_address || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="activity-log-pagination">
          <span>Showing {filteredLogs.length} records · Page {page} of {totalPages}</span>
          <div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages || loading}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function WorkspacePage({ onLogout, isSuperuser, currentRole, username }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard')
  const lastLoggedTabRef = useRef('')

  const visibleTabs = useMemo(
    () => WORKSPACE_TABS.filter((tab) => {
      if (
        tab.id === 'administrator' ||
        tab.id === 'ihx-sync' ||
        tab.id === 'activity-log' ||
        tab.id === 'claim-packet-processing'
      ) {
        return isSuperuser
      }

      return true
    }),
    [isSuperuser],
  )

  useEffect(() => {
    if (!activeTab || activeTab === lastLoggedTabRef.current) {
      return
    }

    if (activeTab === 'activity-log') {
      return
    }

    const matchingTab = visibleTabs.find((tab) => tab.id === activeTab)

    if (!matchingTab) {
      return
    }

    lastLoggedTabRef.current = activeTab

    createActivityLog({
      username,
      actionType: 'screen_access',
      target: activeTab,
      details: `Opened workspace tab: ${matchingTab.label}`,
    }).catch(() => {
      // Non-blocking by design: access logging failures should not break UI usage.
    })
  }, [activeTab, currentRole, username, visibleTabs])

  useEffect(() => {
    const pathSegment = location.pathname.split('/').filter(Boolean).at(-1) || 'dashboard'
    const requestedTab = WORKSPACE_TABS.some((tab) => tab.id === pathSegment)
      ? pathSegment
      : 'dashboard'

    if (requestedTab !== activeTab) {
      setActiveTab(requestedTab)
    }
  }, [activeTab, location.pathname])

  useEffect(() => {
    const hasActiveTab = visibleTabs.some((tab) => tab.id === activeTab)

    if (!hasActiveTab) {
      setActiveTab('dashboard')
      navigate('/dashboard', { replace: true })
    }
  }, [activeTab, navigate, visibleTabs])

  const activeModule = useMemo(
    () => visibleTabs.find((tab) => tab.id === activeTab) ?? visibleTabs[0],
    [activeTab, visibleTabs],
  )

  return (
    <div className="workspace-shell">
      <header className="module-navbar">
        <div className="module-navbar__inner">
          <div className="module-navbar__brand">
            <span className="module-navbar__logo" aria-hidden="true">CB</span>
            <div className="module-navbar__brand-text">
              <strong>ClaimBridge</strong>
              <span>Claims Operations Suite</span>
            </div>
          </div>

          <nav className="module-navbar__nav" role="tablist" aria-label="ClaimBridge modules">
            {visibleTabs.map((tab) => {
              const isSelected = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`module-nav-item ${isSelected ? 'module-nav-item--active' : ''}`}
                  onClick={(event) => {
                    setActiveTab(tab.id)
                    navigate(tab.id === 'dashboard' ? '/dashboard' : `/dashboard/${tab.id}`)
                    event.currentTarget.scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                      inline: 'nearest',
                    })
                  }}
                >
                  <span className="module-nav-item__icon">
                    <ModuleIcon moduleId={tab.id} />
                  </span>
                  <span className="module-nav-item__label">{tab.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="module-navbar__profile">
            <div className="module-navbar__user" title={currentRole || undefined}>
              <span className="module-navbar__avatar" aria-hidden="true">{getInitials(username)}</span>
              <div className="module-navbar__user-text">
                <strong>{username || 'User'}</strong>
                <span>{currentRole || 'Member'}</span>
              </div>
            </div>

            <button
              type="button"
              className="module-navbar__logout"
              onClick={onLogout}
              title="Logout"
              aria-label="Logout"
            >
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path d="M15 3h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2" />
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <PageHeader title={activeModule?.label} description={activeModule?.description} />

      <section className={`workspace-view ${activeTab === 'dashboard' ? 'workspace-view--active' : ''}`}>
        <DashboardPage isActive={activeTab === 'dashboard'} />
      </section>

      {isSuperuser ? (
        <section className={`workspace-view ${activeTab === 'administrator' ? 'workspace-view--active' : ''}`}>
          <AdministratorPage />
        </section>
      ) : null}

      {isSuperuser ? (
        <section className={`workspace-view ${activeTab === 'claim-packet-processing' ? 'workspace-view--active' : ''}`}>
          <ClaimPacketProcessingPage />
        </section>
      ) : null}

      {isSuperuser ? (
        <section className={`workspace-view ${activeTab === 'ihx-sync' ? 'workspace-view--active' : ''}`}>
          <IhxSyncPage />
        </section>
      ) : null}

      <section className={`workspace-view ${activeTab === 'claim-validations' ? 'workspace-view--active' : ''}`}>
        <ClaimValidationsPage isActive={activeTab === 'claim-validations'} />
      </section>

      <section className={`workspace-view ${activeTab === 'reconciliation' ? 'workspace-view--active' : ''}`}>
        <ReconciliationRecordsPage
          isActive={activeTab === 'reconciliation'}
          canSyncFromPortal={isSuperuser}
        />
      </section>

      {isSuperuser ? (
        <section className={`workspace-view ${activeTab === 'activity-log' ? 'workspace-view--active' : ''}`}>
          <ActivityLogPage
            isActive={activeTab === 'activity-log'}
            currentRole={currentRole}
          />
        </section>
      ) : null}
    </div>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(getStoredAuth)
  const [roles, setRoles] = useState(getStoredRoles)
  const [userData, setUserData] = useState(getStoredUser)
  const [showIdleWarning, setShowIdleWarning] = useState(false)
  const [idleCountdownSeconds, setIdleCountdownSeconds] = useState(IDLE_WARNING_LEAD_SECONDS)
  const [isGlobalLoading, setIsGlobalLoading] = useState(() => getActiveApiRequests() > 0)
  const idleWarningRef = useRef(false)
  const idleWarningTimeoutRef = useRef(null)
  const idleLogoutTimeoutRef = useRef(null)
  const idleCountdownIntervalRef = useRef(null)
  const globalLoaderVisibleRef = useRef(getActiveApiRequests() > 0)
  const globalLoaderVisibleAtRef = useRef(getActiveApiRequests() > 0 ? Date.now() : 0)
  const globalLoaderShowTimeoutRef = useRef(null)
  const globalLoaderHideTimeoutRef = useRef(null)

  useEffect(() => {
    const clearGlobalLoaderTimer = (timerRef) => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const showGlobalLoader = () => {
      clearGlobalLoaderTimer(globalLoaderHideTimeoutRef)

      if (globalLoaderVisibleRef.current || globalLoaderShowTimeoutRef.current) return

      globalLoaderShowTimeoutRef.current = window.setTimeout(() => {
        globalLoaderShowTimeoutRef.current = null
        globalLoaderVisibleRef.current = true
        globalLoaderVisibleAtRef.current = Date.now()
        setIsGlobalLoading(true)
      }, GLOBAL_LOADER_SHOW_DELAY_MS)
    }

    const hideGlobalLoader = () => {
      clearGlobalLoaderTimer(globalLoaderShowTimeoutRef)
      if (!globalLoaderVisibleRef.current) return

      clearGlobalLoaderTimer(globalLoaderHideTimeoutRef)
      const elapsed = Date.now() - globalLoaderVisibleAtRef.current
      const delay = Math.max(GLOBAL_LOADER_REQUEST_GRACE_MS, GLOBAL_LOADER_MIN_VISIBLE_MS - elapsed)

      globalLoaderHideTimeoutRef.current = window.setTimeout(() => {
        globalLoaderHideTimeoutRef.current = null
        if (getActiveApiRequests() > 0) return
        globalLoaderVisibleRef.current = false
        setIsGlobalLoading(false)
      }, delay)
    }

    const handleApiLoading = (event) => {
      const activeCount = Number(event.detail?.active)
      const requestCount = Number.isFinite(activeCount) ? activeCount : getActiveApiRequests()
      if (requestCount > 0) showGlobalLoader()
      else hideGlobalLoader()
    }

    window.addEventListener(API_LOADING_EVENT, handleApiLoading)
    handleApiLoading({ detail: { active: getActiveApiRequests() } })

    return () => {
      window.removeEventListener(API_LOADING_EVENT, handleApiLoading)
      clearGlobalLoaderTimer(globalLoaderShowTimeoutRef)
      clearGlobalLoaderTimer(globalLoaderHideTimeoutRef)
    }
  }, [])

  const clearIdleTimeouts = useCallback(() => {
    if (idleWarningTimeoutRef.current) {
      window.clearTimeout(idleWarningTimeoutRef.current)
      idleWarningTimeoutRef.current = null
    }

    if (idleLogoutTimeoutRef.current) {
      window.clearTimeout(idleLogoutTimeoutRef.current)
      idleLogoutTimeoutRef.current = null
    }

    if (idleCountdownIntervalRef.current) {
      window.clearInterval(idleCountdownIntervalRef.current)
      idleCountdownIntervalRef.current = null
    }
  }, [])

  const executeLogout = useCallback(() => {
    clearIdleTimeouts()
    setShowIdleWarning(false)
    clearClientStorage()
    setIsAuthenticated(false)
    setRoles([])
    setUserData(null)
  }, [clearIdleTimeouts])

  const isSuperuser = useMemo(() => hasSuperuserRole(roles), [roles])
  const currentRole = useMemo(() => resolvePrimaryRole(roles), [roles])
  const currentUsername = useMemo(() => resolveUserName(userData), [userData])

  const scheduleIdleTimeouts = useCallback(() => {
    clearIdleTimeouts()

    idleWarningTimeoutRef.current = window.setTimeout(() => {
      setIdleCountdownSeconds(IDLE_WARNING_LEAD_SECONDS)
      setShowIdleWarning(true)
    }, IDLE_WARNING_TIMEOUT_MS)

    idleLogoutTimeoutRef.current = window.setTimeout(() => {
      executeLogout()
    }, IDLE_TIMEOUT_MS)
  }, [clearIdleTimeouts, executeLogout])

  const handleContinueSession = useCallback(() => {
    setShowIdleWarning(false)
    scheduleIdleTimeouts()
  }, [scheduleIdleTimeouts])

  useEffect(() => {
    idleWarningRef.current = showIdleWarning
  }, [showIdleWarning])

  useEffect(() => {
    if (!showIdleWarning) {
      if (idleCountdownIntervalRef.current) {
        window.clearInterval(idleCountdownIntervalRef.current)
        idleCountdownIntervalRef.current = null
      }

      return undefined
    }

    idleCountdownIntervalRef.current = window.setInterval(() => {
      setIdleCountdownSeconds((current) => (current > 0 ? current - 1 : 0))
    }, 1000)

    return () => {
      if (idleCountdownIntervalRef.current) {
        window.clearInterval(idleCountdownIntervalRef.current)
        idleCountdownIntervalRef.current = null
      }
    }
  }, [showIdleWarning])

  const idleCountdownLabel = useMemo(() => {
    const minutes = Math.floor(idleCountdownSeconds / 60)
    const seconds = idleCountdownSeconds % 60
    const paddedSeconds = String(seconds).padStart(2, '0')

    return `${minutes}:${paddedSeconds}`
  }, [idleCountdownSeconds])

  useEffect(() => {
    const handleUnauthorized = () => {
      executeLogout()
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    }
  }, [executeLogout])

  const handleLogin = (payload) => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'true')
    const token = extractTokenFromAuthPayload(payload)
    if (token) {
      setAuthToken(token)
    }
    const nextRoles = extractRolesFromAuthPayload(payload)
    const nextUserData = extractUserFromAuthPayload(payload)
    sessionStorage.setItem(AUTH_ROLES_STORAGE_KEY, JSON.stringify(nextRoles))
    sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(nextUserData))
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      localStorage.removeItem(AUTH_ROLES_STORAGE_KEY)
      localStorage.removeItem(AUTH_USER_STORAGE_KEY)
    } catch {
      // Ignore storage failures in restricted contexts.
    }
    setShowIdleWarning(false)
    setIsAuthenticated(true)
    setRoles(nextRoles)
    setUserData(nextUserData)

    createActivityLog({
      username: resolveUserName(nextUserData),
      actionType: 'login',
      target: 'dashboard',
      details: 'User logged in successfully',
    }).catch(() => {
      // Non-blocking by design: login should proceed even if logging fails.
    })
  }

  const handleLogout = () => {
    createActivityLog({
      username: currentUsername,
      actionType: 'logout',
      target: 'session',
      details: 'User logged out',
    }).catch(() => {
      // Non-blocking by design: logout should proceed even if logging fails.
    })

    executeLogout()
  }

  useEffect(() => {
    if (!ENABLE_IDLE_AUTO_LOGOUT) {
      setShowIdleWarning(false)
      clearIdleTimeouts()

      return undefined
    }

    if (!isAuthenticated) {
      clearIdleTimeouts()

      return undefined
    }

    const handleUserActivity = () => {
      if (idleWarningRef.current) {
        return
      }

      scheduleIdleTimeouts()
    }

    scheduleIdleTimeouts()

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, { passive: true })
    })

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity)
      })

      clearIdleTimeouts()
    }
  }, [clearIdleTimeouts, isAuthenticated, scheduleIdleTimeouts])

  return (
    <div className="app-layout">
      <LoadingOverlay
        isVisible={isGlobalLoading}
        title="Loading ClaimBridge"
        description="Retrieving the latest information from the server."
      />
      <div className="app-layout__content">
        <Routes>
          <Route
            path="/login"
            element={<LoginPage isAuthenticated={isAuthenticated} onLogin={handleLogin} />}
          />
          <Route
            path="/dashboard/*"
            element={(
              <ProtectedRoute isAuthenticated={isAuthenticated} onUnauthorized={executeLogout}>
                <WorkspacePage
                  onLogout={handleLogout}
                  isSuperuser={isSuperuser}
                  currentRole={currentRole}
                  username={currentUsername}
                />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/administrator"
            element={(
              <ProtectedRoute isAuthenticated={isAuthenticated} onUnauthorized={executeLogout}>
                {isSuperuser ? <AdministratorPage /> : <Navigate to="/dashboard" replace />}
              </ProtectedRoute>
            )}
          />
          <Route
            path="*"
            element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
          />
        </Routes>
      </div>

      {isAuthenticated && showIdleWarning ? (
        <section className="idle-warning-overlay" role="dialog" aria-modal="true" aria-labelledby="idle-warning-title">
          <div className="idle-warning-card panel">
            <span className="eyebrow">Session Timeout Alert</span>
            <h3 id="idle-warning-title">Do you want to continue your session?</h3>
            <p>
              You have been inactive for {IDLE_TIMEOUT_MS - IDLE_WARNING_LEAD_MS} minutes. You will be logged out in 2 minutes if there
              is no response.
            </p>
            <p><strong>Time remaining: {idleCountdownLabel}</strong></p>

            <div className="idle-warning-actions">
              <button type="button" className="primary-button" onClick={handleContinueSession}>
                Continue Session
              </button>
              <button type="button" className="secondary-button" onClick={handleLogout}>
                Logout Now
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <Footer />
    </div>
  )
}

export default App
