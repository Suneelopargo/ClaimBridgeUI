import { useCallback, useEffect, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { buildApiUrl } from '../config/api'
import {
  getClaimPacketReview,
  processCustomerClaimPacket,
  saveClaimPacketReview,
  validateCustomerDispatchChecklist,
} from '../services/claimPacketApi'
import LoadingOverlay from './LoadingOverlay'
import './ClaimPacketProcessingPage.css'
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

function PdfFileLinkCell(params) {
  const fileName = params.value || '—'

  if (fileName === '—' || !params.data?.previewUrl) {
    return <span>{fileName}</span>
  }

  return (
    <button
      type="button"
      className="claim-pdf-link"
      onClick={() => params.context?.onPreview?.(params.data.previewUrl)}
    >
      {fileName}
    </button>
  )
}

export default function ClaimValidationsPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [validating, setValidating] = useState(false)
  const [packetResult, setPacketResult] = useState(null)
  const [validationResult, setValidationResult] = useState(null)
  const [error, setError] = useState('')
  const [groupReviewResult, setGroupReviewResult] = useState(null)
  const [groupReviewLoading, setGroupReviewLoading] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [sourceGroupId, setSourceGroupId] = useState('')
  const [pagesToAssign, setPagesToAssign] = useState([])
  const [arrangementMode, setArrangementMode] = useState('same-group')
  const [groupPageAssignments, setGroupPageAssignments] = useState(null)
  const [availablePageNumbers, setAvailablePageNumbers] = useState([])
  const [selectedGroupPreviewUrl, setSelectedGroupPreviewUrl] = useState('')
  const [isGroupModalOpen, setGroupModalOpen] = useState(false)
  const [isReviewModalOpen, setReviewModalOpen] = useState(false)

  const packet = packetResult?.result || null
  const validation = validationResult?.result || null
  const claimId = packet?.claimId || ''
  const claimReview = groupReviewResult?.result || null
  const reviewResult = claimReview

  const handleOpenPreview = useCallback((url) => {
    if (!url) {
      return
    }

    window.open(buildApiUrl(url), '_blank', 'noopener')
  }, [])

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
  const groups = useMemo(() => reviewResult?.groups ?? groupedDocuments, [reviewResult, groupedDocuments])
  const reviewGroups = reviewResult?.groups ?? groupedDocuments
  const groupedDocumentRows = useMemo(
    () =>
      groupedDocuments.map((doc, index) => ({
        ...doc,
        id: doc.groupId || `${doc.groupCode || doc.displayName || 'group'}-${index}`,
        previewUrl:
          claimId && doc.groupId
            ? `/api/claim-packets/${encodeURIComponent(claimId)}/groups/${encodeURIComponent(doc.groupId)}/preview`
            : '',
      })),
    [claimId, groupedDocuments],
  )
  const reviewRequiredRows = useMemo(
    () =>
      reviewRequiredPages.map((item, index) => ({
        id: item.id || `${item.pageNumber || item.page || index}-${index}`,
        pageNumber: item.pageNumber ?? item.page ?? '—',
        reason: item.reason || item.remarks || item.message || '—',
        outputFile: item.outputFile || item.output_file || '—',
        previewUrl:
          claimId && (item.pageNumber ?? item.page)
            ? `/api/claim-packets/${encodeURIComponent(claimId)}/pages/${encodeURIComponent(item.pageNumber ?? item.page)}/preview`
            : '',
      })),
    [claimId, reviewRequiredPages],
  )

  const selectedGroup = useMemo(
    () => (selectedGroupId ? groups.find((group) => group.groupId === selectedGroupId) : null),
    [groups, selectedGroupId],
  )
  const selectedGroupPages = groupPageAssignments?.[selectedGroup?.groupId] ?? selectedGroup?.sourcePages ?? []
  const isGroupSelected = Boolean(selectedGroupId)
  const sourceGroup = useMemo(
    () => (sourceGroupId ? groups.find((group) => group.groupId === sourceGroupId) : null),
    [groups, sourceGroupId],
  )
  const sourceGroupPages = groupPageAssignments?.[sourceGroup?.groupId] ?? sourceGroup?.sourcePages ?? []
  const canShowSourceGroupPages = arrangementMode === 'group-to-group' && Boolean(sourceGroupId)
  const canShowTargetGroupPages = arrangementMode === 'group-to-group' && Boolean(selectedGroupId)
  const canEditArrangement = arrangementMode === 'same-group'
    ? isGroupSelected
    : Boolean(isGroupSelected && sourceGroupId && sourceGroupId !== selectedGroupId)
  const totalPages = reviewResult?.summary?.totalPages ?? reviewResult?.source?.totalPages ?? 0
  const groupCount = reviewResult?.summary?.documentGroupCount ?? groups.length
  const reviewRequiredCount = reviewResult?.summary?.reviewRequiredGroupCount ?? 0
  const unassignedPageCount = reviewResult?.summary?.unassignedPageCount ?? (reviewResult?.unassignedPages?.length ?? 0)
  const status = reviewResult?.status ?? 'Not loaded'

  const buildGroupPreviewUrl = useCallback(
    (groupId, reviewed = false) => {
      if (!claimId || !groupId) {
        return ''
      }

      return `/api/claim-packets/${encodeURIComponent(claimId)}` +
        (reviewed
          ? `/reviewed-groups/${encodeURIComponent(groupId)}/preview`
          : `/groups/${encodeURIComponent(groupId)}/preview`)
    },
    [claimId],
  )

  const buildPagePreviewUrl = useCallback(
    (pageNumber) => {
      if (!claimId || pageNumber === undefined || pageNumber === null) {
        return ''
      }

      return `/api/claim-packets/${encodeURIComponent(claimId)}/pages/${encodeURIComponent(pageNumber)}/preview`
    },
    [claimId],
  )

  const buildReviewedGroupPreviewUrl = useCallback(
    (groupId) => {
      if (!claimId || !groupId) {
        return ''
      }

      return `/api/claim-packets/${encodeURIComponent(claimId)}/reviewed-groups/${encodeURIComponent(groupId)}/preview`
    },
    [claimId],
  )

  const groupRows = useMemo(
    () =>
      groups.map((group) => ({
        groupId: group.groupId || '',
        displayName: group.displayName || group.documentType || 'Group',
        documentType: group.documentType || 'UNKNOWN',
        pages: Array.isArray(group.sourcePages) ? group.sourcePages.join(', ') : '—',
        outputFile: group.outputFile || '',
        status: group.status || 'UNKNOWN',
        reviewRequired: Boolean(group.reviewRequired),
        reviewFlags: Array.isArray(group.reviewFlags) ? group.reviewFlags : [],
        baselinePreviewUrl: buildGroupPreviewUrl(group.groupId, false),
        reviewedPreviewUrl: buildGroupPreviewUrl(group.groupId, true),
      })),
    [groups, buildGroupPreviewUrl],
  )

  const reviewRequiredGroups = useMemo(
    () => groupRows.filter((row) => row.reviewRequired),
    [groupRows],
  )

  useEffect(() => {
    const selectedGroup = selectedGroupId
      ? groups.find((group) => group.groupId === selectedGroupId)
      : null

    if (!selectedGroup?.groupId) {
      setSelectedGroupPreviewUrl('')
      return undefined
    }

    const fallbackUrl = buildGroupPreviewUrl(selectedGroup.groupId, false)
    const reviewedPreviewUrl = buildReviewedGroupPreviewUrl(selectedGroup.groupId)
    let cancelled = false

    const probeReviewedPreview = async () => {
      try {
        const response = await fetch(buildApiUrl(reviewedPreviewUrl), {
          method: 'GET',
          headers: {
            Accept: 'application/pdf',
          },
        })

        const blob = await response.blob()

        if (!response.ok || blob.size === 0) {
          throw new Error('Empty reviewed preview response')
        }

        if (!cancelled) {
          setSelectedGroupPreviewUrl(reviewedPreviewUrl)
        }
      } catch {
        if (!cancelled) {
          setSelectedGroupPreviewUrl(fallbackUrl)
        }
      }
    }

    probeReviewedPreview()

    return () => {
      cancelled = true
    }
  }, [buildGroupPreviewUrl, buildReviewedGroupPreviewUrl, groups, selectedGroupId])

  const togglePageForAssignment = (pageNumber) => {
    setPagesToAssign((pages) => (
      pages.includes(pageNumber) ? pages.filter((page) => page !== pageNumber) : [...pages, pageNumber]
    ))
  }

  const movePageToSelected = (pageNumber) => {
    if (!selectedGroup?.groupId) return

    setAvailablePageNumbers((pages) => pages.filter((page) => page !== pageNumber))
    setGroupPageAssignments((assignments) => ({
      ...(assignments || {}),
      [selectedGroup.groupId]: [
        ...(assignments?.[selectedGroup.groupId] || selectedGroup.sourcePages || []),
        pageNumber,
      ].sort((left, right) => left - right),
    }))
  }

  const assignPagesToSelectedGroup = () => {
    if (!selectedGroup?.groupId || !sourceGroup?.groupId || sourceGroup.groupId === selectedGroup.groupId || !pagesToAssign.length) return

    setGroupPageAssignments((assignments) => ({
      ...(assignments || {}),
      [sourceGroup.groupId]: (assignments?.[sourceGroup.groupId] || sourceGroup.sourcePages || [])
        .filter((page) => !pagesToAssign.includes(page)),
      [selectedGroup.groupId]: [
        ...(assignments?.[selectedGroup.groupId] || selectedGroup.sourcePages || []),
        ...pagesToAssign,
      ].sort((left, right) => left - right),
    }))
    setPagesToAssign([])
  }

  const movePageToAvailable = (pageNumber) => {
    if (!selectedGroup?.groupId) return

    setGroupPageAssignments((assignments) => ({
      ...(assignments || {}),
      [selectedGroup.groupId]: (assignments?.[selectedGroup.groupId] || selectedGroup.sourcePages || [])
        .filter((page) => page !== pageNumber),
    }))
    setAvailablePageNumbers((pages) => [...pages, pageNumber].sort((left, right) => left - right))
  }

  const removePageFromSource = (pageNumber) => {
    if (!sourceGroup?.groupId) return

    setGroupPageAssignments((assignments) => ({
      ...(assignments || {}),
      [sourceGroup.groupId]: (assignments?.[sourceGroup.groupId] || sourceGroup.sourcePages || [])
        .filter((page) => page !== pageNumber),
    }))
    setPagesToAssign((pages) => pages.filter((page) => page !== pageNumber))
    setAvailablePageNumbers((pages) => [...pages, pageNumber].sort((left, right) => left - right))
  }

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
        cellRenderer: PdfFileLinkCell,
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
    if (!isReviewModalOpen && !isGroupModalOpen) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setReviewModalOpen(false)
        setGroupModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isGroupModalOpen, isReviewModalOpen])

  const handleOpenGroupReview = async () => {
    if (!claimId) {
      setError('Process the claim packet before opening Review Groups.')
      return
    }

    try {
      setGroupReviewLoading(true)
      setError('')

      const result = await getClaimPacketReview(claimId)
      const loadedGroups = result?.result?.groups ?? []
      setGroupReviewResult(result)
      setSelectedGroupId('')
      setSourceGroupId('')
      setPagesToAssign([])
      setSelectedGroupPreviewUrl('')
      setGroupPageAssignments(
        Object.fromEntries(loadedGroups.map((group) => [group.groupId, [...(group.sourcePages || [])]])),
      )
      setAvailablePageNumbers(
        (result?.result?.unassignedPages ?? [])
          .map((page) => page.pageNumber ?? page.sourcePageNumber)
          .filter((pageNumber) => pageNumber !== undefined && pageNumber !== null),
      )
      setGroupModalOpen(true)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to load group review.',
      )
    } finally {
      setGroupReviewLoading(false)
    }
  }

  const handleSaveReview = async () => {
    if (!claimId) {
      setError('No claim is loaded to save.')
      return
    }

    if (!groups.length) {
      setError('No groups available to save.')
      return
    }

    try {
      setGroupReviewLoading(true)
      setError('')

      const originalUnassignedPageNumbers = new Set(
        (reviewResult?.unassignedPages ?? [])
          .map((page) => page.pageNumber ?? page.sourcePageNumber)
          .filter((pageNumber) => pageNumber !== undefined && pageNumber !== null),
      )

      const normalizedGroups = groups.map((group) => ({
        groupId: group.groupId ?? null,
        documentType: group.documentType ?? 'UNKNOWN',
        displayName: group.displayName ?? group.documentType ?? 'UNKNOWN',
        pageNumbers: groupPageAssignments?.[group.groupId] ?? group.sourcePages ?? [],
        reviewerRemarks: group.reviewerRemarks || '',
      }))

      const splitPageNumbers = availablePageNumbers.filter(
        (pageNumber) => !originalUnassignedPageNumbers.has(pageNumber),
      )

      const splitGroups = arrangementMode === 'same-group' && selectedGroup
        ? splitPageNumbers.map((pageNumber) => ({
            groupId: null,
            documentType: selectedGroup.documentType ?? 'UNKNOWN',
            displayName: selectedGroup.displayName ?? selectedGroup.documentType ?? 'UNKNOWN',
            pageNumbers: [pageNumber],
            reviewerRemarks: 'Created during manual review',
          }))
        : []

      const payload = {
        groups: [...normalizedGroups, ...splitGroups],
        unassignedPageNumbers: Array.from(originalUnassignedPageNumbers),
        reviewerRemarks: 'Manual document review completed',
        confirmReview: true,
      }

      const result = await saveClaimPacketReview(claimId, payload)
      setGroupReviewResult(result)
      setGroupModalOpen(false)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to save review.',
      )
    } finally {
      setGroupReviewLoading(false)
    }
  }

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
            <Metric label="Review Required" value={packet.summary?.reviewRequiredPages ?? 0} />
            <button
              type="button"
              className="claim-review-groups-button"
              onClick={handleOpenGroupReview}
              disabled={!claimId || groupReviewLoading}
            >
              <span>Review Groups</span>
              <strong>{groupReviewLoading ? '...' : reviewGroups.length}</strong>
            </button>
          </div>

          {reviewRequiredPages.length ? (
            <div className="claim-callout">
              <strong>Review required pages</strong>
              <p>
                {reviewRequiredPages.map((item) => `Page ${item.pageNumber} (${item.outputFile || 'n/a'})`).join(', ')}
              </p>
              <button type="button" className="claim-link-button" onClick={handleOpenGroupReview}>
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
                {groupedDocumentRows.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.displayName}</td>
                    <td>{doc.pageNumbers?.join(', ') || '—'}</td>
                    <td>
                      {doc.outputFile && doc.previewUrl ? (
                        <button
                          type="button"
                          className="claim-pdf-link"
                          onClick={() => handleOpenPreview(doc.previewUrl)}
                        >
                          {doc.outputFile}
                        </button>
                      ) : (
                        doc.outputFile || '—'
                      )}
                    </td>
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

          <div className="claim-metrics-grid claim-metrics-grid--six">
            <Metric label="Readiness" value={`${validation.summary?.readinessPercent ?? 0}%`} />
            <Metric label="Status" value={validation.summary?.overallStatus || '—'} />
            <Metric label="Required" value={validation.summary?.totalRequired ?? 0} />
            <Metric label="Available" value={validation.summary?.availableRequired ?? 0} />
            <Metric label="Missing" value={validation.summary?.missingRequired ?? 0} />
            <button
              type="button"
              className="claim-review-groups-button"
              onClick={handleOpenGroupReview}
              disabled={!claimId || groupReviewLoading}
            >
              <span>Review Groups</span>
              <strong>{groupReviewLoading ? '...' : reviewGroups.length}</strong>
            </button>
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

            <div className="claimbridge-ag-grid-shell claim-review-grid-shell">
              <div className="ag-theme-quartz claimbridge-ag-grid claim-review-grid">
                <AgGridReact
                  rowData={reviewRequiredRows}
                  columnDefs={reviewRequiredColumnDefs}
                  defaultColDef={reviewRequiredDefaultColDef}
                  getRowId={(params) => params.data.id}
                  context={{ onPreview: handleOpenPreview }}
                  pagination
                  paginationPageSize={10}
                  paginationPageSizeSelector={[10, 20, 50]}
                  animateRows
                  domLayout="normal"
                />
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isGroupModalOpen ? (
        <div className="claim-packet-modal" role="dialog" aria-modal="true" aria-label="Grouped claim files">
          <div className="claim-packet-modal__backdrop" onClick={() => setGroupModalOpen(false)} />
          <section className="claim-packet-modal__content">
            <header className="claim-packet-modal__header">
              <div>
                <h3>Claim document groups</h3>
                <p>
                  Select a group to review its pages and open its PDF for claim {claimId || 'unknown'}.
                </p>
              </div>

              <button
                type="button"
                className="claim-packet-modal__close"
                onClick={() => setGroupModalOpen(false)}
                aria-label="Close grouped files"
              >
                Close
              </button>
            </header>

            {groups.length ? (
              <div className="claim-group-review">
                <div className="claim-group-review__mode" role="radiogroup" aria-label="Page arrangement mode">
                  <label><input type="radio" name="arrangementMode" value="same-group" checked={arrangementMode === 'same-group'} onChange={() => { setArrangementMode('same-group'); setSelectedGroupId('') }} /> Arrange within same group</label>
                  <label><input type="radio" name="arrangementMode" value="group-to-group" checked={arrangementMode === 'group-to-group'} onChange={() => { setArrangementMode('group-to-group'); setSelectedGroupId(''); setSourceGroupId('') }} /> Move group to group</label>
                </div>

                {arrangementMode === 'group-to-group' ? <>
                    <div className="claim-group-review__top-row">
                      <label className="claim-group-review__select">
                        <span>Source group</span>
                        <select value={sourceGroupId} onChange={(event) => { setSourceGroupId(event.target.value); setPagesToAssign([]) }}>
                          <option value="">Select</option>
                          {groups.map((group, index) => (
                            <option key={group.groupId || index} value={group.groupId || ''}>
                              {group.displayName || group.documentType || `Group ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="claim-group-review__select">
                        <span>Document group</span>
                        <select value={selectedGroupId} onChange={(event) => { setSelectedGroupId(event.target.value); setPagesToAssign([]) }}>
                          <option value="">Select</option>
                          {groups.map((group, index) => (
                            <option key={group.groupId || index} value={group.groupId || ''}>
                              {group.displayName || group.documentType || `Group ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="claim-group-review__details">
                      <div className="claim-group-review__summary">
                        <span className="claim-group-review__label">Pages</span>
                        <p>Select pages from {sourceGroup?.displayName || 'the source group'}.</p>
                        <div className="claim-group-review__page-list claim-group-review__page-list--vertical">
                          {canShowSourceGroupPages && sourceGroupPages.length ? sourceGroupPages.map((pageNumber) => (
                            <label key={pageNumber} className="claim-group-review__page-row">
                              <input type="checkbox" checked={pagesToAssign.includes(pageNumber)} onChange={() => togglePageForAssignment(pageNumber)} disabled={sourceGroup?.groupId === selectedGroup?.groupId} />
                              <button type="button" className="claim-group-review__page-preview" onClick={() => handleOpenPreview(buildPagePreviewUrl(pageNumber))}>Page {pageNumber}</button>
                              <button type="button" className="claim-group-review__remove" onClick={() => removePageFromSource(pageNumber)} aria-label={`Remove page ${pageNumber}`} title="Remove page">×</button>
                            </label>
                          )) : canShowSourceGroupPages ? <span className="claim-group-review__empty">No pages in this group</span> : <span className="claim-group-review__empty">Select source group to view pages</span>}
                        </div>
                      </div>

                      <div className="claim-group-review__assign-action">
                        <button type="button" className="primary-button" onClick={assignPagesToSelectedGroup} disabled={!pagesToAssign.length || sourceGroup?.groupId === selectedGroup?.groupId}>
                          Assign →
                        </button>
                      </div>

                      <div className="claim-group-review__pages" aria-label="Pages in selected group">
                        <div className="claim-group-review__display-name">
                          <span className="claim-group-review__label">Display name</span>
                          <strong>{canShowTargetGroupPages ? (selectedGroup?.displayName || selectedGroup?.documentType || 'Group') : 'Select document group to view pages'}</strong>
                        </div>
                        <button
                          type="button"
                          className="claim-group-review__page-preview"
                          onClick={() => handleOpenPreview(selectedGroupPreviewUrl)}
                          disabled={!selectedGroup?.groupId}
                        >
                          Preview reviewed PDF
                        </button>
                        <p>Assigned pages</p>
                        <div className="claim-group-review__page-list claim-group-review__page-list--vertical">
                        {canShowTargetGroupPages && selectedGroupPages.length ? selectedGroupPages.map((pageNumber) => (
                          <div key={pageNumber} className="claim-group-review__page-row claim-group-review__page-row--selected">
                            <button type="button" className="claim-group-review__page-preview" onClick={() => handleOpenPreview(buildPagePreviewUrl(pageNumber))}>Page {pageNumber}</button>
                            <button type="button" className="claim-group-review__remove" onClick={() => movePageToAvailable(pageNumber)} aria-label={`Remove page ${pageNumber}`} title="Remove page">×</button>
                          </div>
                        )) : canShowTargetGroupPages ? <span className="claim-group-review__empty">No selected pages</span> : <span className="claim-group-review__empty">Select document group to view pages</span>}
                        </div>
                      
                      </div>
                    </div>
                    </> : <>
                      <div className="claim-group-review__top-row claim-group-review__top-row--single">
                        <label className="claim-group-review__select">
                          <span>Document group</span>
                          <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
                            <option value="">Select</option>
                            {groups.map((group, index) => <option key={group.groupId || index} value={group.groupId || ''}>{group.displayName || group.documentType || `Group ${index + 1}`}</option>)}
                          </select>
                        </label>
                        <div className="claim-group-review__display-name"><span className="claim-group-review__label">Display name</span><strong>{isGroupSelected ? selectedGroup.displayName || selectedGroup.documentType || 'Group' : 'Select a document group'}</strong></div>
                      </div>
                      <div className={`claim-group-review__details claim-group-review__details--same-group ${isGroupSelected ? '' : 'claim-group-review__details--hidden'}`}>
                        <div className="claim-group-review__summary">
                          <span className="claim-group-review__label">Available</span>
                          <p>Move a page into the selected group.</p>
                          <div className="claim-group-review__page-list">
                            {availablePageNumbers.length ? availablePageNumbers.map((pageNumber) => <div key={pageNumber} className="claim-group-review__page-row"><button type="button" className="claim-group-review__page-preview" onClick={() => handleOpenPreview(buildPagePreviewUrl(pageNumber))}>Page {pageNumber}</button><button type="button" className="claim-group-review__add" onClick={() => movePageToSelected(pageNumber)} aria-label={`Add page ${pageNumber}`}>+</button><button type="button" className="claim-group-review__remove" onClick={() => setAvailablePageNumbers((pages) => pages.filter((page) => page !== pageNumber))} aria-label={`Remove page ${pageNumber}`}>×</button></div>) : <span className="claim-group-review__empty">No available pages</span>}
                          </div>
                        </div>
                        <div className="claim-group-review__pages">
                          <span className="claim-group-review__label">Selected</span>
                          <p>Move a page back to available.</p>
                          <div className="claim-group-review__page-list">
                            {selectedGroupPages.length ? selectedGroupPages.map((pageNumber) => <div key={pageNumber} className="claim-group-review__page-row claim-group-review__page-row--selected"><button type="button" className="claim-group-review__page-preview" onClick={() => handleOpenPreview(buildPagePreviewUrl(pageNumber))}>Page {pageNumber}</button><button type="button" className="claim-group-review__remove" onClick={() => movePageToAvailable(pageNumber)} aria-label={`Remove page ${pageNumber}`}>×</button></div>) : <span className="claim-group-review__empty">No selected pages</span>}
                          </div>
                        </div>
                      </div>
                    </>}
                    <div className={`claim-group-review__footer ${canEditArrangement ? '' : 'claim-group-review__footer--hidden'}`}>
                      <button type="button" className="primary-button" onClick={handleSaveReview} disabled={groupReviewLoading}>
                        Save
                      </button>
                    </div>

              </div>
            ) : <p className="claim-packet-empty">No document groups were returned for this claim.</p>}
          </section>
        </div>
      ) : null}
    </main>
  )
}
