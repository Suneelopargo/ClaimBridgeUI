import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import * as XLSX from 'xlsx'
import { API_BASE_URL, buildApiUrl } from '../config/api'
import LoadingOverlay from './LoadingOverlay'
import './ReconciliationRecordsPage.css'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

const RECONCILIATION_ENDPOINT = buildApiUrl('/api/reconciliation/records')
const RECONCILIATION_DOWNLOAD_ENDPOINT = buildApiUrl('/api/reconciliation/download')
const RECONCILIATION_IMPORT_ENDPOINT = buildApiUrl('/api/reconciliation/import')
const BACKEND_TARGET_LABEL = API_BASE_URL || 'the current host /api path'
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const API_FETCH_PAGE_SIZE = 100

ModuleRegistry.registerModules([AllCommunityModule])

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
const EDITABLE_COLUMNS = new Set(['patientName', 'payorCompanyName', 'policyNumber', 'claimAuthNumber', 'billAmount', 'payorAmount', 'patientAmount', 'amountReceivable', 'claimStatus', 'hospitalName'])

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

export default function ReconciliationRecordsPage({ isActive = true, canSyncFromPortal = false }) {
  const gridApiRef = useRef(null)
  const [records, setRecords] = useState([])
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [displayedRowCount, setDisplayedRowCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [hospitalFilter, setHospitalFilter] = useState('all')
  const [payorFilter, setPayorFilter] = useState('all')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isSyncingPortal, setIsSyncingPortal] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncError, setSyncError] = useState('')

  const fetchRecords = useCallback(async ({ showLoader = true } = {}) => {
    if (showLoader) {
      setLoading(true)
    }

    setError('')

    try {
      const collectedRecords = []
      let currentPage = 1
      let totalFromApi = 0
      let totalPagesFromApi = 0

      while (true) {
        const query = new URLSearchParams({
          page: String(currentPage),
          page_size: String(API_FETCH_PAGE_SIZE),
        })

        const response = await fetch(`${RECONCILIATION_ENDPOINT}?${query.toString()}`)

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const pageItems = Array.isArray(payload.items) ? payload.items : []
        const payloadTotal = Number(payload.totalRecords ?? payload.total ?? payload.total_count ?? 0)
        const payloadTotalPages = Number(payload.total_pages ?? payload.totalPages ?? 0)

        if (payloadTotal > 0) {
          totalFromApi = payloadTotal
        }

        if (payloadTotalPages > 0) {
          totalPagesFromApi = payloadTotalPages
        }

        collectedRecords.push(...pageItems)

        if (totalPagesFromApi > 0 && currentPage >= totalPagesFromApi) {
          break
        }

        if (!pageItems.length) {
          break
        }

        if (totalFromApi > 0 && collectedRecords.length >= totalFromApi) {
          break
        }

        if (pageItems.length < API_FETCH_PAGE_SIZE) {
          break
        }

        currentPage += 1

        if (currentPage > 1000) {
          throw new Error('Stopped loading records after 1000 pages to avoid an infinite loop.')
        }
      }

      setRecords(collectedRecords)
      setTotal(totalFromApi || collectedRecords.length)
      setDisplayedRowCount(collectedRecords.length)
      setLastUpdated(new Date())
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load reconciliation records.',
      )
      setRecords([])
      setTotal(0)
      setDisplayedRowCount(0)
    } finally {
      if (showLoader) {
        setLoading(false)
      }
    }
  }, [])

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

  const payorCompanies = useMemo(() => {
    const values = records
      .map((record) => record.payorCompanyName)
      .filter((value) => value !== null && value !== undefined && value !== '')

    return Array.from(new Set(values)).sort((left, right) =>
      String(left).localeCompare(String(right)),
    )
  }, [records])

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesStatus =
        statusFilter === 'all' ? true : String(record.claimStatus || '') === statusFilter
      const matchesHospital =
        hospitalFilter === 'all' ? true : String(record.hospitalName || '') === hospitalFilter
      const matchesPayor =
        payorFilter === 'all' ? true : String(record.payorCompanyName || '') === payorFilter

      if (!matchesStatus || !matchesHospital || !matchesPayor) {
        return false
      }

      return true
    })
  }, [records, hospitalFilter, payorFilter, statusFilter])

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

  const handleExport = () => {
    const exportSourceRows = []

    if (gridApiRef.current) {
      gridApiRef.current.forEachNodeAfterFilterAndSort((node) => {
        if (node.data) {
          exportSourceRows.push(node.data)
        }
      })
    }

    const rowsToExport = exportSourceRows.length ? exportSourceRows : filteredRecords

    if (!rowsToExport.length) {
      return
    }

    const exportRows = rowsToExport.map((record) => {
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
    XLSX.writeFile(workbook, `reconciliation-records-${stamp}.xlsx`)
  }

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      floatingFilter: true,
      resizable: true,
      minWidth: 140,
      flex: 1,
    }),
    [],
  )

  const noRowsOverlayTemplate = useMemo(
    () => '<span class="reconciliation-grid-empty-message">No records match the current filters.</span>',
    [],
  )

  const columnDefs = useMemo(
    () =>
      GRID_COLUMNS.map((column) => {
        const isCurrency = CURRENCY_COLUMNS.has(column.key)
        const isDate = DATE_COLUMNS.has(column.key)
        const isDateTime = DATETIME_COLUMNS.has(column.key)
        const isEditable = EDITABLE_COLUMNS.has(column.key)

        const baseDef = {
          field: column.key,
          headerName: column.label,
          editable: isEditable,
        }

        if (isCurrency) {
          return {
            ...baseDef,
            type: 'numericColumn',
            cellClass: 'reconciliation-cell--numeric',
            valueFormatter: (params) => formatCellValue(column.key, params.value),
            valueParser: (params) => {
              const rawValue = String(params.newValue ?? '').trim()

              if (rawValue === '') {
                return null
              }

              const parsed = Number(rawValue)
              return Number.isNaN(parsed) ? params.oldValue : parsed
            },
          }
        }

        if (isDate || isDateTime) {
          return {
            ...baseDef,
            valueFormatter: (params) => formatCellValue(column.key, params.value),
            comparator: (left, right) => {
              const leftValue = new Date(left).valueOf()
              const rightValue = new Date(right).valueOf()

              if (Number.isNaN(leftValue) && Number.isNaN(rightValue)) {
                return 0
              }

              if (Number.isNaN(leftValue)) {
                return 1
              }

              if (Number.isNaN(rightValue)) {
                return -1
              }

              return leftValue - rightValue
            },
          }
        }

        if (column.key === 'claimStatus') {
          return {
            ...baseDef,
            cellEditor: 'agSelectCellEditor',
            filter: 'agSetColumnFilter',
            cellEditorParams: {
              values: claimStatuses,
            },
          }
        }

        return {
          ...baseDef,
        }
      }),
    [claimStatuses],
  )

  const handleGridReady = useCallback((params) => {
    gridApiRef.current = params.api
    setDisplayedRowCount(params.api.getDisplayedRowCount())
  }, [])

  const handleGridFilterChanged = useCallback(() => {
    if (!gridApiRef.current) {
      return
    }

    setDisplayedRowCount(gridApiRef.current.getDisplayedRowCount())
  }, [])

  const handleCellValueChanged = useCallback((event) => {
    const updatedRecord = event.data

    setRecords((current) =>
      current.map((record) =>
        record.id === updatedRecord.id
          ? {
              ...updatedRecord,
              updatedAt: new Date().toISOString(),
            }
          : record,
      ),
    )
    setLastUpdated(new Date())
  }, [])

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
            <span className="status-pill">AG Grid client pagination</span>
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
            <span>Payor Company</span>
            <select
              value={payorFilter}
              onChange={(event) => setPayorFilter(event.target.value)}
            >
              <option value="all">All payor companies</option>
              {payorCompanies.map((payor) => (
                <option key={payor} value={payor}>{payor}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Page size</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
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

          {canSyncFromPortal ? (
            <button
              type="button"
              className="secondary-button reconciliation-sync-button"
              onClick={syncFromPortal}
              disabled={isSyncingPortal}
            >
              {isSyncingPortal ? 'Syncing from portal...' : 'Sync From Portal'}
            </button>
          ) : null}

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
            <p>Make sure backend is reachable at {BACKEND_TARGET_LABEL}.</p>
          </section>
        ) : null}

        <div className="reconciliation-summary">
          <span>Total records (all pages loaded): {total}</span>
          <span>Records shown (after filter): {displayedRowCount}</span>
        </div>

        <div className="reconciliation-grid-wrap claimbridge-ag-grid-shell">
          <div className="ag-theme-quartz claimbridge-ag-grid reconciliation-ag-grid">
            <AgGridReact
              rowData={filteredRecords}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              quickFilterText={searchQuery}
              pagination
              paginationPageSize={pageSize}
              paginationPageSizeSelector={PAGE_SIZE_OPTIONS}
              overlayNoRowsTemplate={noRowsOverlayTemplate}
              rowHeight={42}
              headerHeight={46}
              getRowId={(params) => String(params.data.id)}
              onGridReady={handleGridReady}
              onFilterChanged={handleGridFilterChanged}
              onFirstDataRendered={handleGridFilterChanged}
              onModelUpdated={handleGridFilterChanged}
              onCellValueChanged={handleCellValueChanged}
              animateRows
            />
          </div>
        </div>
      </section>
    </main>
  )
}
