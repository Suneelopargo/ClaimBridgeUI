import { useEffect, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import {
  processCustomerClaimPacket,
  validateCustomerDispatchChecklist,
} from '../services/claimPacketApi'
import LoadingOverlay from './LoadingOverlay'
import './ClaimValidationsPage.css'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

ModuleRegistry.registerModules([AllCommunityModule])

function Metric({ label, value, onClick }) {
  if (onClick) {
    return (
      <button
        type="button"
        className="claim-metric claim-metric--interactive"
        onClick={onClick}
        aria-label={`Open ${label} details`}
      >
        <span>{label}</span>
        <strong>{value}</strong>
      </button>
    )
  }

  return (
    <article className="claim-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function StatusBadge({ value }) {
  const normalizedValue = String(value || '').toUpperCase()
  const className =
    normalizedValue === 'READY' || normalizedValue === 'AVAILABLE' || normalizedValue === 'PROCESSED'
      ? 'claim-status-badge claim-status-badge--good'
      : normalizedValue === 'MISSING' || normalizedValue === 'REVIEW_REQUIRED'
        ? 'claim-status-badge claim-status-badge--warn'
        : 'claim-status-badge claim-status-badge--neutral'

  return <span className={className}>{value || '—'}</span>
}

export default function ClaimValidationsPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [validating, setValidating] = useState(false)
  const [packetResult, setPacketResult] = useState(null)
  const [validationResult, setValidationResult] = useState(null)
  const [error, setError] = useState('')
  const [isReviewModalOpen, setReviewModalOpen] = useState(false)

  const packet = packetResult?.result || null
  const validation = validationResult?.result || null

  const processClaim = async () => {
    if (!selectedFile) {
      setError('Please select a PDF claim packet.')
      return
    }

    try {
      setProcessing(true)
      setError('')
      setPacketResult(null)
      setValidationResult(null)

      const result = await processCustomerClaimPacket(selectedFile)
      setPacketResult(result)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Claim processing failed.',
      )
    } finally {
      setProcessing(false)
    }
  }

  const validateClaim = async () => {
    const claimId = packet?.claimId

    if (!claimId) {
      setError('Process the claim packet before validation.')
      return
    }

    try {
      setValidating(true)
      setError('')

      const result = await validateCustomerDispatchChecklist(claimId)
      setValidationResult(result)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Validation failed.',
      )
    } finally {
      setValidating(false)
    }
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
    setPacketResult(null)
    setValidationResult(null)
    setError('')
  }

  const groupedDocuments = packet?.groupedDocuments || []
  const checklistStatus = packet?.checklistStatus || []
  const checklistValidation = validation?.checklistValidation || []
  const reviewRequiredPages = validation?.reviewRequiredPages || packet?.reviewRequiredPages || []
  const reviewRequiredRows = useMemo(
    () =>
      reviewRequiredPages.map((item, index) => ({
        id: item.id || `${item.pageNumber || item.page || index}-${index}`,
        pageNumber: item.pageNumber ?? item.page ?? '—',
        reason: item.reason || item.remarks || item.message || '—',
        outputFile: item.outputFile || item.output_file || '—',
      })),
    [reviewRequiredPages],
  )

  const reviewRequiredColumnDefs = useMemo(
    () => [
      {
        field: 'pageNumber',
        headerName: 'Page Number',
        minWidth: 140,
        maxWidth: 180,
        sort: 'asc',
      },
      {
        field: 'reason',
        headerName: 'Reason',
        minWidth: 320,
        flex: 2,
        wrapText: true,
        autoHeight: true,
      },
      {
        field: 'outputFile',
        headerName: 'Output File',
        minWidth: 240,
        flex: 1,
      },
    ],
    [],
  )

  const reviewRequiredDefaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      floatingFilter: true,
    }),
    [],
  )

  useEffect(() => {
    if (!isReviewModalOpen) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setReviewModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isReviewModalOpen])

  const openReviewModal = () => {
    if (!reviewRequiredRows.length) {
      return
    }

    setReviewModalOpen(true)
  }

  return (
    <main className="claim-validations-shell">
      <LoadingOverlay
        isVisible={processing || validating}
        title={processing ? 'Processing claim packet' : 'Running claim validation'}
        description={
          processing
            ? 'Uploading the PDF, classifying pages, and building the claim packet.'
            : 'Checking the generated packet against the dispatch checklist.'
        }
        scope="container"
      />

      <section className="claim-hero panel">
        <div>
          <span className="eyebrow">ClaimBridge Workflow</span>
          <h2>Claim Validations</h2>
          <p>
            Upload a consolidated claim PDF, split and group the pages, then run checklist
            validation on the generated claim packet.
          </p>
        </div>
      </section>

      <section className="claim-panel panel">
        <div className="claim-panel__header">
          <div>
            <h3>Claim packet upload</h3>
            <p>Use a single PDF that contains the full customer claim packet.</p>
          </div>

          <div className="claim-actions">
            <button type="button" className="primary-button" onClick={processClaim} disabled={!selectedFile || processing}>
              {processing ? 'Processing Claim...' : 'Process Claim'}
            </button>
            <button type="button" className="secondary-button" onClick={validateClaim} disabled={!packet || validating}>
              {validating ? 'Running Validation...' : 'Validation Check'}
            </button>
          </div>
        </div>

        <label className="claim-upload">
          <span>Customer Claim Packet PDF</span>
          <input type="file" accept="application/pdf,.pdf" onChange={handleFileChange} />
        </label>

        {selectedFile ? (
          <div className="claim-file-card">
            <strong>{selectedFile.name}</strong>
            <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
        ) : null}

        {error ? <p className="claim-error">{error}</p> : null}
      </section>

      {packet ? (
        <section className="claim-panel panel">
          <div className="claim-panel__header claim-panel__header--stacked">
            <div>
              <h3>Claim processing result</h3>
              <p>
                {packet.patientName || 'Patient unavailable'} · {packet.claimId || 'No claim id returned'}
              </p>
            </div>

            <StatusBadge value={packet.summary?.status} />
          </div>

          <div className="claim-metrics-grid">
            <Metric label="Total Pages" value={packet.summary?.totalPages ?? 0} />
            <Metric label="Pages Identified" value={packet.summary?.identifiedPages ?? 0} />
            <Metric label="Document Groups" value={packet.summary?.groupedDocumentCount ?? 0} />
            <Metric
              label="Review Required"
              value={packet.summary?.reviewRequiredPages ?? 0}
              onClick={reviewRequiredRows.length ? openReviewModal : undefined}
            />
          </div>

          {reviewRequiredPages.length ? (
            <div className="claim-callout">
              <strong>Review required pages</strong>
              <p>
                {reviewRequiredPages.map((item) => `Page ${item.pageNumber} (${item.outputFile || 'n/a'})`).join(', ')}
              </p>
              <button type="button" className="claim-link-button" onClick={openReviewModal}>
                View full review details
              </button>
            </div>
          ) : null}

          <div className="claim-table-wrap">
            <table className="claim-table">
              <thead>
                <tr>
                  <th>Document Group</th>
                  <th>Pages</th>
                  <th>Output File</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {groupedDocuments.map((doc) => (
                  <tr key={doc.groupCode}>
                    <td>{doc.displayName}</td>
                    <td>{doc.pageNumbers?.join(', ') || '—'}</td>
                    <td>{doc.outputFile || '—'}</td>
                    <td>
                      <StatusBadge value={doc.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {checklistStatus.length ? (
            <div className="claim-mini-section">
              <h4>Packet checklist snapshot</h4>
              <div className="claim-checklist-grid">
                {checklistStatus.map((item) => (
                  <article key={item.itemNo} className="claim-checklist-card">
                    <div>
                      <strong>{item.itemNo}</strong>
                      <span>{item.checklistItem}</span>
                    </div>
                    <StatusBadge value={item.status} />
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {validation ? (
        <section className="claim-panel panel">
          <div className="claim-panel__header claim-panel__header--stacked">
            <div>
              <h3>Validation check</h3>
              <p>Checklist readiness for the processed claim packet.</p>
            </div>

            <StatusBadge value={validation.summary?.overallStatus} />
          </div>

          <div className="claim-metrics-grid claim-metrics-grid--five">
            <Metric label="Readiness" value={`${validation.summary?.readinessPercent ?? 0}%`} />
            <Metric label="Status" value={validation.summary?.overallStatus || '—'} />
            <Metric label="Required" value={validation.summary?.totalRequired ?? 0} />
            <Metric label="Available" value={validation.summary?.availableRequired ?? 0} />
            <Metric label="Missing" value={validation.summary?.missingRequired ?? 0} />
          </div>

          <div className="claim-table-wrap">
            <table className="claim-table claim-table--validation">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Checklist Item</th>
                  <th>Required</th>
                  <th>Status</th>
                  <th>Matched Files</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {checklistValidation.map((row) => (
                  <tr key={row.itemNo}>
                    <td>{row.itemNo}</td>
                    <td>{row.checklistItem}</td>
                    <td>{row.required ? 'Yes' : 'No'}</td>
                    <td>
                      <StatusBadge value={row.status} />
                    </td>
                    <td>{row.matchedFiles?.join(', ') || '—'}</td>
                    <td>{row.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {isReviewModalOpen ? (
        <div className="claim-modal" role="dialog" aria-modal="true" aria-label="Review required pages">
          <div className="claim-modal__backdrop" onClick={() => setReviewModalOpen(false)} />
          <section className="claim-modal__content">
            <header className="claim-modal__header">
              <div>
                <h3>Review Required Pages</h3>
                <p>
                 Claim Id :  {packet?.claimId || 'Claim'} has {reviewRequiredRows.length} page(s) requiring manual review.
                </p>
              </div>

              <button
                type="button"
                className="claim-modal__close"
                onClick={() => setReviewModalOpen(false)}
                aria-label="Close review details"
              >
                Close
              </button>
            </header>

            <div className="ag-theme-quartz claim-review-grid">
              <AgGridReact
                rowData={reviewRequiredRows}
                columnDefs={reviewRequiredColumnDefs}
                defaultColDef={reviewRequiredDefaultColDef}
                getRowId={(params) => params.data.id}
                pagination
                paginationPageSize={10}
                paginationPageSizeSelector={[10, 20, 50]}
                animateRows
                domLayout="normal"
              />
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
