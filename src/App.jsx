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
import ClaimValidationsPage from './components/ClaimValidationsPage'
import ReconciliationRecordsPage from './components/ReconciliationRecordsPage'
import { authenticateLogin } from './services/authApi'
import './App.css'

const AUTH_STORAGE_KEY = 'claimbridge-admin-auth'
const IDLE_TIMEOUT_MS = 10 * 60 * 1000
const IDLE_WARNING_LEAD_MS = 2 * 60 * 1000
const IDLE_WARNING_TIMEOUT_MS = IDLE_TIMEOUT_MS - IDLE_WARNING_LEAD_MS
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
const IDLE_WARNING_LEAD_SECONDS = Math.floor(IDLE_WARNING_LEAD_MS / 1000)
const IHX_SYNC_ENDPOINT = buildApiUrl('/api/ihx/sync')
const DASHBOARD_SUMMARY_ENDPOINT = buildApiUrl('/api/dashboard/claim-status-summary')
const API_DOCS_URL = buildApiUrl('/docs')
const BACKEND_TARGET_LABEL = API_BASE_URL || 'the current host /api path'

const STATUS_COLORS = ['#1d4ed8', '#d97706', '#059669', '#dc2626', '#7c3aed', '#db2777', '#0f766e', '#334155']
const CLAIMED_BAR_COLOR = '#2563eb'
const APPROVED_BAR_COLOR = '#ea580c'
const REFRESH_OPTIONS = [0, 30, 60, 300]

const WORKSPACE_TABS = [
  { id: 'dashboard', label: 'Claims Dashboard' },
  { id: 'ihx-sync', label: 'IHX Ingestion' },
  { id: 'claim-validations', label: 'Claim Validations' },
  { id: 'reconciliation', label: 'Reconciliation Grid' },
]

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
  return localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
}

function clearClientStorage() {
  try {
    localStorage.clear()
  } catch {
    // Ignore storage failures in restricted contexts.
  }

  try {
    sessionStorage.clear()
  } catch {
    // Ignore storage failures in restricted contexts.
  }
}

function ProtectedRoute({ isAuthenticated, children }) {
  const location = useLocation()

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

      onLogin()
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
            <span className="badge">Admin Access</span>
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

function DashboardPage({ onLogout, isActive = true }) {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshInterval, setRefreshInterval] = useState(60)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
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

  const closeSidebarOnMobile = () => {
    if (window.matchMedia('(max-width: 960px)').matches) {
      setIsSidebarOpen(false)
    }
  }

  const fetchDashboard = async (showLoader = true) => {
    if (showLoader) {
      setLoading(true)
    }
    setError('')

    try {
      const response = await fetch(DASHBOARD_SUMMARY_ENDPOINT)

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
        const response = await fetch(DASHBOARD_SUMMARY_ENDPOINT)

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

  const lastUpdatedLabel = lastUpdated
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(lastUpdated)
    : 'Not refreshed yet'

  return (
    <main className="dashboard-shell dashboard-layout">
      <LoadingOverlay isVisible={loading} />

      <aside
        className={`sidebar panel ${isSidebarOpen ? 'sidebar--open' : ''}`}
        id="dashboard-control-panel"
      >
        <div className="sidebar-brand">
          <span className="eyebrow">ClaimBridge</span>
          <h2>Control Panel</h2>
          <p>Monitor current claim outcomes and keep the dashboard synced with the API.</p>
        </div>

        <nav className="sidebar-nav" aria-label="Dashboard sections">
          <a href="#overview" className="sidebar-link" onClick={closeSidebarOnMobile}>Overview</a>
          <a href="#status-distribution" className="sidebar-link" onClick={closeSidebarOnMobile}>Status Distribution</a>
          <a href="#amount-comparison" className="sidebar-link" onClick={closeSidebarOnMobile}>Amount Comparison</a>
          <a href="#status-snapshot" className="sidebar-link" onClick={closeSidebarOnMobile}>Status Snapshot</a>
          <a href="#source-details" className="sidebar-link" onClick={closeSidebarOnMobile}>Source Details</a>
        </nav>

        <section className="sidebar-section">
          <h3>Refresh cadence</h3>
          <label className="control-field">
            <span>Auto-refresh</span>
            <select
              value={refreshInterval}
              onChange={(event) => setRefreshInterval(Number(event.target.value))}
            >
              {REFRESH_OPTIONS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds === 0 ? 'Off' : `Every ${seconds} seconds`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary-button sidebar-button"
            onClick={() => fetchDashboard(true)}
          >
            Refresh now
          </button>
          <p className="sidebar-meta">Last updated: {lastUpdatedLabel}</p>
        </section>

        <section className="sidebar-section sidebar-section--muted">
          <h3>Date filters</h3>
          <div className="control-field control-field--disabled">
            <span>Date range</span>
            <select disabled defaultValue="backend-required">
              <option value="backend-required">Requires backend date filter support</option>
            </select>
          </div>
          <p className="sidebar-meta">
            The current API returns status aggregates only, so date filtering needs a backend
            endpoint update before it can be applied correctly.
          </p>
        </section>

        <div className="sidebar-actions">
          <a
            className="secondary-button"
            href={API_DOCS_URL}
            target="_blank"
            rel="noreferrer"
          >
            API Docs
          </a>
          <button type="button" className="primary-button sidebar-logout" onClick={onLogout}>
            <span className="logout-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M15 3h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2" />
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
              </svg>
            </span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="topbar" id="overview">
          <div>
            <span className="eyebrow">Operations Dashboard</span>
            <h1>Claim status command center</h1>
            <p>
              Operational view of current claims, status mix, and approved value performance.
            </p>
            <button
              type="button"
              className="secondary-button mobile-controls-toggle"
              onClick={() => setIsSidebarOpen((current) => !current)}
              aria-expanded={isSidebarOpen}
              aria-controls="dashboard-control-panel"
            >
              {isSidebarOpen ? 'Hide controls' : 'Show controls'}
            </button>
          </div>

          <div className="topbar-actions topbar-actions--stacked">
            <span className="status-pill">
              {refreshInterval === 0 ? 'Auto-refresh paused' : `Auto-refresh every ${refreshInterval}s`}
            </span>
            <span className="status-pill status-pill--soft">Last sync: {lastUpdatedLabel}</span>
          </div>
        </header>

        {error ? (
          <section className="panel panel--error">
            <h2>Dashboard unavailable</h2>
            <p>{error}</p>
            <p>Make sure the FastAPI backend is reachable at {BACKEND_TARGET_LABEL}.</p>
          </section>
        ) : null}

        {!loading && !error && dashboardData ? (
          <>
            <section className="stats-grid">
            <article className="stat-card">
              <span>Total Claims</span>
              <strong>{dashboardData.totalClaims}</strong>
              <small>Across all returned statuses</small>
            </article>
            <article className="stat-card">
              <span>Claimed Amount</span>
              <strong>{formatCurrencyCompact(totals.claimedAmount)}</strong>
              <small>{formatCurrency(totals.claimedAmount)} total claimed value</small>
            </article>
            <article className="stat-card">
              <span>Approved Amount</span>
              <strong>{formatCurrencyCompact(totals.approvedAmount)}</strong>
              <small>{formatCurrency(totals.approvedAmount)} approved so far</small>
            </article>
            <article className="stat-card">
              <span>Approval Ratio</span>
              <strong>{approvalRatio}%</strong>
              <small>Approved vs claimed value</small>
            </article>
          </section>

            <section className="chart-grid">
              <article className="panel chart-panel" id="status-distribution">
              <div className="panel-heading">
                <div>
                  <h2>Status distribution</h2>
                  <p>Share of total claims by current status.</p>
                </div>
              </div>

              <div className="chart-area chart-area--pie">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={78}
                      outerRadius={118}
                      paddingAngle={4}
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Claims']} />
                  </PieChart>
                </ResponsiveContainer>
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
            </article>

              <article className="panel chart-panel" id="amount-comparison">
              <div className="panel-heading">
                <div>
                  <h2>Amount comparison</h2>
                  <p>Claimed and approved values grouped by status.</p>
                </div>
              </div>

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
            </article>
          </section>

            <section className="chart-grid chart-grid--secondary">
              <article className="panel" id="status-snapshot">
              <div className="panel-heading">
                <div>
                  <h2>Status snapshot</h2>
                  <p>Quick operational breakdown for each claim state.</p>
                </div>
              </div>

              <div className="status-list">
                {statusData.map((statusItem, index) => (
                  <article className="status-row" key={statusItem.status}>
                    <div className="status-row__main">
                      <span
                        className="status-dot"
                        style={{ backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length] }}
                      ></span>
                      <div>
                        <strong>{statusItem.status}</strong>
                        <small>
                          {statusItem.count} claims ({formatPercent(statusDistribution[index]?.percentage || 0)})
                        </small>
                      </div>
                    </div>

                    <div className="status-row__metrics">
                      <span>{formatCurrency(statusItem.claimedAmount)}</span>
                      <span>{formatCurrency(statusItem.approvedAmount)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </article>

              <article className="panel panel--highlight" id="source-details">
              <div className="panel-heading">
                <div>
                  <h2>Dashboard source</h2>
                  <p>Connected to the live claim summary endpoint.</p>
                </div>
              </div>

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
            </article>
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
      const response = await fetch(syncPath, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
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
            <span className="eyebrow">IHX Connector</span>
            <h2>IHX Claims Ingestion Control</h2>
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

function WorkspacePage({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="workspace-shell">
      <header className="workspace-header panel">
        <div>
          <span className="eyebrow">ClaimBridge Workspace</span>
          <h2>Claims Operations Workspace</h2>
          <p>
            Monitor claim outcomes, run IHX ingestion, and validate claim packets from one place
            with persistent tab state.
          </p>
        </div>

        <div className="workspace-actions">
          <div className="workspace-tabs" role="tablist" aria-label="ClaimBridge workspace tabs">
            {WORKSPACE_TABS.map((tab) => {
              const isSelected = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`workspace-tab ${isSelected ? 'workspace-tab--active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="secondary-button workspace-logout workspace-logout--enhanced"
            onClick={onLogout}
          >
            <span className="logout-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M15 3h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2" />
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
              </svg>
            </span>
            <span>Logout</span>
          </button>
        </div>
      </header>

      <section className={`workspace-view ${activeTab === 'dashboard' ? 'workspace-view--active' : ''}`}>
        <DashboardPage onLogout={onLogout} isActive={activeTab === 'dashboard'} />
      </section>

      <section className={`workspace-view ${activeTab === 'ihx-sync' ? 'workspace-view--active' : ''}`}>
        <IhxSyncPage />
      </section>

      <section className={`workspace-view ${activeTab === 'claim-validations' ? 'workspace-view--active' : ''}`}>
        <ClaimValidationsPage />
      </section>

      <section className={`workspace-view ${activeTab === 'reconciliation' ? 'workspace-view--active' : ''}`}>
        <ReconciliationRecordsPage isActive={activeTab === 'reconciliation'} />
      </section>
    </div>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(getStoredAuth)
  const [showIdleWarning, setShowIdleWarning] = useState(false)
  const [idleCountdownSeconds, setIdleCountdownSeconds] = useState(IDLE_WARNING_LEAD_SECONDS)
  const idleWarningRef = useRef(false)
  const idleWarningTimeoutRef = useRef(null)
  const idleLogoutTimeoutRef = useRef(null)
  const idleCountdownIntervalRef = useRef(null)

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
  }, [clearIdleTimeouts])

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

  const handleLogin = () => {
    localStorage.setItem(AUTH_STORAGE_KEY, 'true')
    setShowIdleWarning(false)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    executeLogout()
  }

  useEffect(() => {
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
      <div className="app-layout__content">
        <Routes>
          <Route
            path="/login"
            element={<LoginPage isAuthenticated={isAuthenticated} onLogin={handleLogin} />}
          />
          <Route
            path="/dashboard"
            element={(
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <WorkspacePage onLogout={handleLogout} />
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
