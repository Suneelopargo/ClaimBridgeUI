import { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import LoadingOverlay from './LoadingOverlay'
import './ReconciliationRecordsPage.css'

const RECONCILIATION_ENDPOINT = '/api/reconciliation/records'
const RECONCILIATION_DOWNLOAD_ENDPOINT = '/api/reconciliation/download'
const RECONCILIATION_IMPORT_ENDPOINT = '/api/reconciliation/import'
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const GRID_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'ihxRefId', label: 'IHX Ref ID' },
  { key: 'patientName', label: 'Patient Name' },
  { key: 'admittedDate', label: 'Admitted Date' },
  { key: 'dischargedDate', label: 'Discharged Date' },
  { key: 'payorCompanyName', label: 'Payor Company' },
  { key: 'policyNumber', label: 'Policy Number' },
  { key: 'claimAuthNumber', label: 'Claim Auth Number' },
  { key: 'billAmount', label: 'Bill Amount' },
  { key: 'payorAmount', label: 'Payor Amount' },
  { key: 'patientAmount', label: 'Patient Amount' },
  { key: 'amountReceivable', label: 'Amount Receivable' },
  { key: 'claimStatus', label: 'Claim Status' },
  { key: 'hospitalName', label: 'Hospital Name' },
  { key: 'updatedAt', label: 'Updated At' },
]

const CURRENCY_COLUMNS = new Set([
  'billAmount',
  'payorAmount',
  'patientAmount',
  'amountReceivable',
])

const DATE_COLUMNS = new Set(['admittedDate', 'dischargedDate'])
const DATETIME_COLUMNS = new Set(['updatedAt', 'lastSeenAt'])
const EDITABLE_COLUMNS = new Set([
  'patientName',
  'payorCompanyName',
  'policyNumber',
  'claimAuthNumber',
  'billAmount',
  'payorAmount',
  'patientAmount',
  'amountReceivable',
  'claimStatus',
  'hospitalName',
])

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

const formatDate = (value) => {
  if (!value) {
    return '-'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.valueOf())) {
    return String(value)
  }

  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(parsedDate)
}

const formatDateTime = (value) => {
  if (!value) {
    return '-'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.valueOf())) {
    return String(value)
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate)
}

const formatCellValue = (key, value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  if (CURRENCY_COLUMNS.has(key)) {
    return formatCurrency(value)
  }

  if (DATE_COLUMNS.has(key)) {
    return formatDate(value)
  }

  if (DATETIME_COLUMNS.has(key)) {
    return formatDateTime(value)
  }

  return String(value)
}

export default function ReconciliationRecordsPage({ isActive = true }) {
  const [records, setRecords] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [hospitalFilter, setHospitalFilter] = useState('all')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'updatedAt', direction: 'desc' })
  const [isSyncingPortal, setIsSyncingPortal] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncError, setSyncError] = useState('')
  const [editingRowId, setEditingRowId] = useState(null)
  const [draftRow, setDraftRow] = useState({})

  const fetchRecords = useCallback(async ({ showLoader = true } = {}) => {
    if (showLoader) {
      setLoading(true)
    }

    setError('')

    try {
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      })

      const response = await fetch(`${RECONCILIATION_ENDPOINT}?${query.toString()}`)

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const payload = await response.json()
      const nextRecords = Array.isArray(payload.items) ? payload.items : []
      const nextTotal = Number(payload.total ?? payload.total_count ?? 0)
      const nextTotalPages =
        Number(payload.total_pages ?? payload.totalPages ?? 0) ||
        Math.max(1, Math.ceil((nextTotal || nextRecords.length) / pageSize))

      setRecords(nextRecords)
      setTotal(nextTotal || nextRecords.length)
      setTotalPages(nextTotalPages)
      setLastUpdated(new Date())
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load reconciliation records.',
      )
      setRecords([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      if (showLoader) {
        setLoading(false)
      }
    }
  }, [page, pageSize])

  useEffect(() => {
    if (!isActive) {
      return undefined
    }

    let active = true

    const load = async () => {
      if (!active) {
        return
      }

      await fetchRecords({ showLoader: true })
    }

    load()

    return () => {
      active = false
    }
  }, [isActive, fetchRecords])

  const claimStatuses = useMemo(() => {
    const values = records
      .map((record) => record.claimStatus)
      .filter((value) => value !== null && value !== undefined && value !== '')

    return Array.from(new Set(values)).sort((left, right) =>
      String(left).localeCompare(String(right)),
    )
  }, [records])

  const hospitals = useMemo(() => {
    const values = records
      .map((record) => record.hospitalName)
      .filter((value) => value !== null && value !== undefined && value !== '')

    return Array.from(new Set(values)).sort((left, right) =>
      String(left).localeCompare(String(right)),
    )
  }, [records])

  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return records.filter((record) => {
      const matchesStatus =
        statusFilter === 'all' ? true : String(record.claimStatus || '') === statusFilter
      const matchesHospital =
        hospitalFilter === 'all' ? true : String(record.hospitalName || '') === hospitalFilter

      if (!matchesStatus || !matchesHospital) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return GRID_COLUMNS.some(({ key }) => {
        const value = record[key]
        return value !== null &&
          value !== undefined &&
          String(value).toLowerCase().includes(normalizedQuery)
      })
    })
  }, [records, hospitalFilter, searchQuery, statusFilter])

  const sortedRecords = useMemo(() => {
    const { key, direction } = sortConfig

    const sortableRecords = [...filteredRecords]

    const normalizeValue = (value, columnKey) => {
      if (value === null || value === undefined || value === '') {
        return null
      }

      if (CURRENCY_COLUMNS.has(columnKey)) {
        const numericValue = Number(value)
        return Number.isNaN(numericValue) ? null : numericValue
      }

      if (DATE_COLUMNS.has(columnKey) || DATETIME_COLUMNS.has(columnKey)) {
        const dateValue = new Date(value).valueOf()
        return Number.isNaN(dateValue) ? null : dateValue
      }

      const numericValue = Number(value)
      if (!Number.isNaN(numericValue) && String(value).trim() !== '') {
        return numericValue
      }

      return String(value).toLowerCase()
    }

    sortableRecords.sort((left, right) => {
      const leftValue = normalizeValue(left[key], key)
      const rightValue = normalizeValue(right[key], key)

      if (leftValue === null && rightValue === null) {
        return 0
      }

      if (leftValue === null) {
        return 1
      }

      if (rightValue === null) {
        return -1
      }

      if (leftValue < rightValue) {
        return direction === 'asc' ? -1 : 1
      }

      if (leftValue > rightValue) {
        return direction === 'asc' ? 1 : -1
      }

      return 0
    })

    return sortableRecords
  }, [filteredRecords, sortConfig])

  const paginationItems = useMemo(() => {
    const items = []

    if (totalPages <= 7) {
      for (let index = 1; index <= totalPages; index += 1) {
        items.push(index)
      }

      return items
    }

    items.push(1)

    if (page > 4) {
      items.push('left-ellipsis')
    }

    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)

    for (let index = start; index <= end; index += 1) {
      items.push(index)
    }

    if (page < totalPages - 3) {
      items.push('right-ellipsis')
    }

    items.push(totalPages)

    return items
  }, [page, totalPages])

  const hasPreviousPage = page > 1
  const hasNextPage = page < totalPages

  const toggleSort = (columnKey) => {
    setSortConfig((current) => {
      if (current.key !== columnKey) {
        return {
          key: columnKey,
          direction: 'asc',
        }
      }

      return {
        key: columnKey,
        direction: current.direction === 'asc' ? 'desc' : 'asc',
      }
    })
  }

  const syncFromPortal = async () => {
    setSyncError('')
    setSyncMessage('')
    setIsSyncingPortal(true)

    try {
      setSyncMessage('Downloading latest reconciliation report from portal...')
      const downloadResponse = await fetch(RECONCILIATION_DOWNLOAD_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: '*/*',
        },
      })

      if (!downloadResponse.ok) {
        throw new Error(`Download failed with status ${downloadResponse.status}`)
      }

      await downloadResponse.blob()

      setSyncMessage('Importing downloaded report into reconciliation table...')
      const importResponse = await fetch(RECONCILIATION_IMPORT_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      })

      if (!importResponse.ok) {
        throw new Error(`Import failed with status ${importResponse.status}`)
      }

      await fetchRecords({ showLoader: true })

      setSyncMessage('Portal sync completed and grid refreshed successfully.')
    } catch (requestError) {
      setSyncError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to sync reconciliation data from portal.',
      )
    } finally {
      setIsSyncingPortal(false)
    }
  }

  const beginInlineEdit = (record) => {
    const nextDraft = {}

    EDITABLE_COLUMNS.forEach((columnKey) => {
      nextDraft[columnKey] = record[columnKey] ?? ''
    })

    setEditingRowId(record.id)
    setDraftRow(nextDraft)
  }

  const cancelInlineEdit = () => {
    setEditingRowId(null)
    setDraftRow({})
  }

  const updateDraftField = (field, value) => {
    setDraftRow((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const saveInlineEdit = (recordId) => {
    const nextRecord = { ...draftRow }

    CURRENCY_COLUMNS.forEach((columnKey) => {
      if (!(columnKey in nextRecord)) {
        return
      }

      const rawValue = String(nextRecord[columnKey]).trim()

      if (rawValue === '') {
        nextRecord[columnKey] = null
        return
      }

      const parsed = Number(rawValue)
      nextRecord[columnKey] = Number.isNaN(parsed) ? null : parsed
    })

    setRecords((current) =>
      current.map((record) =>
        record.id === recordId
          ? {
              ...record,
              ...nextRecord,
              updatedAt: new Date().toISOString(),
            }
          : record,
      ),
    )

    setLastUpdated(new Date())
    cancelInlineEdit()
  }

  const handleExport = () => {
    if (!filteredRecords.length) {
      return
    }

    const exportRows = filteredRecords.map((record) => {
      const row = {}

      GRID_COLUMNS.forEach(({ key, label }) => {
        row[label] = formatCellValue(key, record[key])
      })

      return row
    })

    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reconciliation Records')

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    XLSX.writeFile(workbook, `reconciliation-records-page-${page}-${stamp}.xlsx`)
  }

  const lastUpdatedLabel = lastUpdated
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(lastUpdated)
    : 'Not refreshed yet'

  return (
    <main className="dashboard-shell reconciliation-shell">
      <LoadingOverlay
        isVisible={loading || isSyncingPortal}
        title={isSyncingPortal ? 'Syncing reconciliation data' : 'Loading reconciliation records'}
        description={
          isSyncingPortal
            ? syncMessage || 'Downloading and importing latest portal report.'
            : 'Fetching latest records from reconciliation API.'
        }
      />

      <section className="panel reconciliation-panel">
        <div className="panel-heading reconciliation-heading">
          <div>
            <span className="eyebrow">Reconciliation Records</span>
            <h2>Reconciliation API Grid</h2>
            <p>Search, filter, paginate, and export records from the backend reconciliation endpoint.</p>
          </div>
          <div className="reconciliation-heading-meta">
            <span className="status-pill">Page {page} of {totalPages}</span>
            <span className="status-pill status-pill--soft">Last sync: {lastUpdatedLabel}</span>
          </div>
        </div>

        <div className="reconciliation-controls">
          <label>
            <span>Search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search patient, status, policy, IHX ref..."
            />
          </label>

          <label>
            <span>Claim Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              {claimStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Hospital</span>
            <select
              value={hospitalFilter}
              onChange={(event) => setHospitalFilter(event.target.value)}
            >
              <option value="all">All hospitals</option>
              {hospitals.map((hospital) => (
                <option key={hospital} value={hospital}>{hospital}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Page size</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="secondary-button"
            onClick={() => fetchRecords({ showLoader: true })}
            disabled={isSyncingPortal}
          >
            Refresh
          </button>

          <button
            type="button"
            className="secondary-button reconciliation-sync-button"
            onClick={syncFromPortal}
            disabled={isSyncingPortal}
          >
            {isSyncingPortal ? 'Syncing from portal...' : 'Sync From Portal'}
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={handleExport}
            disabled={!filteredRecords.length || isSyncingPortal}
          >
            Export XLSX
          </button>
        </div>

        {syncError ? <p className="form-error reconciliation-sync-feedback">{syncError}</p> : null}
        {!syncError && syncMessage && !isSyncingPortal ? (
          <p className="reconciliation-sync-feedback reconciliation-sync-feedback--success">{syncMessage}</p>
        ) : null}

        {error ? (
          <section className="panel panel--error reconciliation-error">
            <h3>Unable to load records</h3>
            <p>{error}</p>
            <p>Make sure backend is running at http://127.0.0.1:8001.</p>
          </section>
        ) : null}

        <div className="reconciliation-summary">
          <span>Total records (server): {total}</span>
          <span>Records shown (after filter): {sortedRecords.length}</span>
        </div>

        <div className="reconciliation-grid-wrap">
          <table className="reconciliation-grid">
            <thead>
              <tr>
                <th scope="col">Actions</th>
                {GRID_COLUMNS.map((column) => (
                  <th key={column.key} scope="col">
                    <button
                      type="button"
                      className={`reconciliation-sort ${sortConfig.key === column.key ? 'reconciliation-sort--active' : ''}`}
                      onClick={() => toggleSort(column.key)}
                    >
                      <span>{column.label}</span>
                      <span className="reconciliation-sort-indicator" aria-hidden="true">
                        {sortConfig.key === column.key
                          ? sortConfig.direction === 'asc'
                            ? '▲'
                            : '▼'
                          : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRecords.length ? (
                sortedRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="reconciliation-row-actions">
                      {editingRowId === record.id ? (
                        <>
                          <button
                            type="button"
                            className="reconciliation-icon-button reconciliation-icon-button--save"
                            onClick={() => saveInlineEdit(record.id)}
                            title="Save row"
                            aria-label="Save row"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className="reconciliation-icon-button reconciliation-icon-button--cancel"
                            onClick={cancelInlineEdit}
                            title="Cancel edit"
                            aria-label="Cancel edit"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="reconciliation-icon-button reconciliation-icon-button--edit"
                          onClick={() => beginInlineEdit(record)}
                          title="Edit row"
                          aria-label="Edit row"
                        >
                          ✎
                        </button>
                      )}
                    </td>
                    {GRID_COLUMNS.map((column) => (
                      <td key={`${record.id}-${column.key}`}>
                        {editingRowId === record.id && EDITABLE_COLUMNS.has(column.key) ? (
                          column.key === 'claimStatus' ? (
                            <select
                              className="reconciliation-cell-editor"
                              value={draftRow[column.key] ?? ''}
                              onChange={(event) => updateDraftField(column.key, event.target.value)}
                            >
                              {Array.from(new Set([
                                ...claimStatuses,
                                String(record.claimStatus || ''),
                              ]))
                                .filter((value) => value)
                                .map((status) => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                          ) : (
                            <input
                              className="reconciliation-cell-editor"
                              type={CURRENCY_COLUMNS.has(column.key) ? 'number' : 'text'}
                              step={CURRENCY_COLUMNS.has(column.key) ? '0.01' : undefined}
                              value={draftRow[column.key] ?? ''}
                              onChange={(event) => updateDraftField(column.key, event.target.value)}
                            />
                          )
                        ) : (
                          formatCellValue(column.key, record[column.key])
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={GRID_COLUMNS.length + 1} className="reconciliation-grid-empty">
                    No records match current filters on this page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="reconciliation-pagination">
          <button
            type="button"
            className="secondary-button"
            aria-label="Go to previous page"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={!hasPreviousPage}
          >
            Previous
          </button>

          <div className="reconciliation-page-numbers" role="navigation" aria-label="Page numbers">
            {paginationItems.map((item) => {
              if (typeof item === 'string') {
                return (
                  <span key={item} className="reconciliation-page-ellipsis" aria-hidden="true">
                    ...
                  </span>
                )
              }

              const isCurrent = item === page

              return (
                <button
                  key={item}
                  type="button"
                  className={`reconciliation-page-button ${isCurrent ? 'reconciliation-page-button--active' : ''}`}
                  onClick={() => setPage(item)}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {item}
                </button>
              )
            })}
          </div>

          <span className="reconciliation-page-meta">Page {page} of {totalPages}</span>
          <button
            type="button"
            className="secondary-button"
            aria-label="Go to next page"
            onClick={() => setPage((current) => current + 1)}
            disabled={!hasNextPage}
          >
            Next
          </button>
        </div>
      </section>
    </main>
  )
}
