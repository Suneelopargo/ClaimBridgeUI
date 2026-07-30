import { useCallback, useEffect, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { buildApiUrl } from '../config/api'
import {
  getClaimPacketReview,
  getClaimPacketReviewedList,
  processCustomerClaimPacket,
  saveClaimPacketReview,
} from '../services/claimPacketApi'
import LoadingOverlay from './LoadingOverlay'
import './ClaimPacketProcessingPage.css'

export default function ClaimPacketProcessingPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [searchClaimId, setSearchClaimId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingTitle, setLoadingTitle] = useState('Please wait')
  const [loadingDescription, setLoadingDescription] = useState('Waiting for user action.')
  const [reviewResponse, setReviewResponse] = useState(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isGroupModalOpen, setGroupModalOpen] = useState(false)
  const [isReviewRequiredModalOpen, setReviewRequiredModalOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [sourceGroupId, setSourceGroupId] = useState('')
  const [pagesToAssign, setPagesToAssign] = useState([])
  const [arrangementMode, setArrangementMode] = useState('same-group')
  const [groupPageAssignments, setGroupPageAssignments] = useState(null)
  const [availablePageNumbers, setAvailablePageNumbers] = useState([])

  const reviewResult = reviewResponse?.result || null

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files?.[0] || null)
    setError('')
  }

  const handleProcessClaim = async () => {
    if (!selectedFile) {
      setError('Please select a PDF claim packet first.')
      return
    }

    setError('')
    setLoadingTitle('Processing claim packet')
    setLoadingDescription('Uploading the PDF and building the claim packet preview.')
    setLoading(true)

    try {
      const payload = await processCustomerClaimPacket(selectedFile)
      setReviewResponse(payload)

      const claimId = payload?.result?.claimId || ''
      if (claimId) {
        setSearchClaimId(claimId)
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Claim processing failed.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleLoadReview = async () => {
    if (!searchClaimId.trim()) {
      setError('Please enter a claim ID to load.')
      return
    }

    setError('')
    setLoadingTitle('Loading claim review')
    setLoadingDescription('Retrieving the review data and preview links.')
    setLoading(true)

    try {
      const payload = await getClaimPacketReview(searchClaimId.trim())
      setReviewResponse(payload)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load claim packet review.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleOpenGroupReview = async () => {
    const requestedClaimId = searchClaimId.trim()

    if (!requestedClaimId) {
      setError('Please enter a claim ID to review.')
      return
    }

    setError('')
    setLoadingTitle('Loading group review')
    setLoadingDescription('Retrieving document groups and their page details.')
    setLoading(true)

    try {
      const payload = await getClaimPacketReview(requestedClaimId)
      const loadedGroups = payload?.result?.groups ?? []
      setReviewResponse(payload)
      setSelectedGroupId('')
      setSourceGroupId('')
      setPagesToAssign([])

      let initialAssignments = Object.fromEntries(
        loadedGroups.map((group) => [group.groupId, [...(group.sourcePages || [])]]),
      )

      try {
        const reviewedListPayload = await getClaimPacketReviewedList(requestedClaimId)
        const reviewedGroups = reviewedListPayload?.result?.groups ?? []

        if (reviewedGroups.length > 0) {
          for (const rg of reviewedGroups) {
            const match =
              loadedGroups.find((g) => g.groupId === rg.groupId) ||
              loadedGroups.find((g) => g.documentType === rg.documentType) ||
              loadedGroups.find((g) => g.displayName === rg.displayName)

            const targetGroupId = match?.groupId || rg.groupId
            if (targetGroupId) {
              const pNums = rg.pageNumbers || rg.sourcePages || []
              if (pNums.length > 0) {
                initialAssignments[targetGroupId] = pNums
              }
            }
          }
        }
      } catch {
        // Fallback to baseline groups if reviewedlist is not available yet
      }

      setGroupPageAssignments(initialAssignments)
      setAvailablePageNumbers(
        (payload?.result?.unassignedPages ?? [])
          .map((page) => page.pageNumber ?? page.sourcePageNumber)
          .filter((pageNumber) => pageNumber !== undefined && pageNumber !== null),
      )
      setGroupModalOpen(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load claim packet review.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenPreview = useCallback((url) => {
    if (!url) {
      return
    }

    window.open(buildApiUrl(url), '_blank', 'noopener')
  }, [])

  const claimId = reviewResult?.claimId || reviewResult?.packetId || ''
  const groups = useMemo(() => reviewResult?.groups ?? [], [reviewResult])
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

  const reviewRequiredRows = useMemo(() => {
    const unassignedRows = Array.isArray(reviewResult?.unassignedPages)
      ? reviewResult.unassignedPages.map((page, index) => {
          const pageNumber = page?.pageNumber ?? page?.sourcePageNumber

          return {
            key: `unassigned-${pageNumber ?? index}`,
            itemType: 'Unassigned page',
            name: `Page ${pageNumber ?? 'unknown'}`,
            pages: pageNumber ? String(pageNumber) : '—',
            outputFile: page?.outputFile || '',
            status: 'UNASSIGNED',
            reviewReason: page?.reviewReason || page?.reason || 'Unassigned page',
            previewUrl: buildPagePreviewUrl(pageNumber),
          }
        })
      : []

    const groupRowsForReview = reviewRequiredGroups.map((group) => ({
      key: `group-${group.groupId}`,
      itemType: 'Group',
      name: group.displayName,
      pages: group.pages,
      outputFile: group.outputFile || '',
      status: group.status,
      reviewReason: group.reviewFlags.length
        ? group.reviewFlags.join(', ')
        : 'Requires review',
      previewUrl: buildGroupPreviewUrl(group.groupId, true),
    }))

    return [...groupRowsForReview, ...unassignedRows]
  }, [reviewRequiredGroups, reviewResult, buildGroupPreviewUrl, buildPagePreviewUrl])

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      floatingFilter: true,
      minWidth: 120,
    }),
    [],
  )

  const reviewRequiredColumnDefs = useMemo(
    () => [
      { field: 'itemType', headerName: 'Type', width: 150 },
      { field: 'name', headerName: 'Item', flex: 1, minWidth: 180 },
      { field: 'pages', headerName: 'Pages', minWidth: 120 },
      { field: 'outputFile', headerName: 'Output file', flex: 1, minWidth: 160 },
      { field: 'status', headerName: 'Status', width: 140 },
      { field: 'reviewReason', headerName: 'Review reason', flex: 1, minWidth: 220 },
      { field: 'previewUrl', headerName: 'Preview', width: 120, cellRenderer: () => '<span class="ag-action-button">Preview</span>' },
    ],
    [],
  )

  const handleReviewRequiredCellClicked = useCallback(
    (params) => {
      if (params.colDef?.field === 'previewUrl') {
        handleOpenPreview(params.data.previewUrl)
      }
    },
    [handleOpenPreview],
  )

  const canOpenReviewModal = reviewRequiredCount > 0 || unassignedPageCount > 0

  const getFirstGroupPreviewUrl = () => {
    if (!groups.length) {
      return ''
    }

    return buildGroupPreviewUrl(groups[0]?.groupId, false)
  }

  const openGroupModal = () => {
    setSelectedGroupId('')
    setSourceGroupId('')
    setPagesToAssign([])
    setGroupPageAssignments(
      Object.fromEntries(groups.map((group) => [group.groupId, [...(group.sourcePages || [])]])),
    )
    setAvailablePageNumbers(
      (reviewResult?.unassignedPages ?? [])
        .map((page) => page.pageNumber ?? page.sourcePageNumber)
        .filter((pageNumber) => pageNumber !== undefined && pageNumber !== null),
    )
    setGroupModalOpen(true)
  }

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

  useEffect(() => {
    if (!isGroupModalOpen && !isReviewRequiredModalOpen) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setGroupModalOpen(false)
        setReviewRequiredModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isGroupModalOpen, isReviewRequiredModalOpen])

  const handleSaveReview = async () => {
    if (!claimId) {
      setSaveError('No claim is loaded to save.')
      return
    }

    if (!groups.length) {
      setSaveError('No groups available to save.')
      return
    }

    setSaveError('')
    setSaveMessage('')
    setLoadingTitle('Saving claim review')
    setLoadingDescription('Saving your review and regenerating reviewed group PDFs.')
    setLoading(true)

    const payload = {
      groups: groups.map((group) => ({
        groupId: group.groupId ?? null,
        documentType: group.documentType ?? 'UNKNOWN',
        displayName: group.displayName ?? group.documentType ?? 'UNKNOWN',
        pageNumbers: groupPageAssignments?.[group.groupId] ?? group.sourcePages ?? [],
        reviewerRemarks: group.reviewerRemarks || '',
      })),
      unassignedPageNumbers: groupPageAssignments
        ? availablePageNumbers
        : (reviewResult?.unassignedPages ?? [])
          .map((page) => page.pageNumber ?? page.page)
          .filter((pageNumber) => typeof pageNumber === 'number'),
      reviewerRemarks: 'Saved from Claim Packet Processing UI',
      confirmReview: true,
    }

    try {
      const result = await saveClaimPacketReview(claimId, payload)
      setReviewResponse(result)
      setSaveMessage('Claim packet review saved successfully.')
    } catch (requestError) {
      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to save review.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="claim-packet-shell">
      <LoadingOverlay
        isVisible={loading}
        title={loadingTitle}
        description={loadingDescription}
        scope="viewport"
      />

      <section className="panel claim-packet-hero">
        <div>
          <span className="eyebrow">Claim Packet Processing</span>
          <h2>Super‑admin packet review</h2>
          <p>
            Process the uploaded claim PDF, inspect baseline groups, preview pages and groups,
            then save corrected group splits for final review.
          </p>
        </div>
      </section>

      <section className="panel claim-packet-panel">
        <div className="claim-packet-panel__header">
          <div>
            <h3>Upload and process</h3>
            <p>Upload a consolidated claim packet PDF for classification and grouping.</p>
          </div>

          <div className="claim-packet-actions">
            <label className="claim-packet-upload">
              <span>PDF claim packet</span>
              <input type="file" accept="application/pdf,.pdf" onChange={handleFileChange} />
            </label>
            <button
              type="button"
              className="primary-button"
              onClick={handleProcessClaim}
              disabled={loading}
            >
              {loading ? 'Processing packet…' : 'Process claim packet'}
            </button>
          </div>
        </div>

        {selectedFile ? (
          <div className="claim-packet-file-card">
            <strong>{selectedFile.name}</strong>
            <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
        ) : null}

        <div className="claim-packet-search-row">
          <input
            type="text"
            value={searchClaimId}
            onChange={(event) => setSearchClaimId(event.target.value)}
            placeholder="Enter claim ID to load review"
          />
          <button
            type="button"
            className="secondary-button"
            onClick={handleLoadReview}
            disabled={loading || !searchClaimId.trim()}
          >
            {loading ? 'Loading review…' : 'Load review by claim ID'}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleOpenGroupReview}
            disabled={loading || !searchClaimId.trim()}
          >
            Review groups
          </button>
        </div>
        {error ? <p className="claim-packet-error">{error}</p> : null}
      </section>

      <section className="panel claim-packet-panel">
        <div className="claim-packet-panel__header claim-packet-panel__header--stacked">
          <div>
            <h3>Review snapshot</h3>
            <p>Monitor the latest processed claim packet metrics and open the review editor.</p>
          </div>

          <div className="claim-packet-status">
            <span>Status</span>
            <strong>{status}</strong>
          </div>
        </div>

        <div className="claim-packet-metrics-grid">
          <article className="claim-metric">
            <span>Total pages</span>
            <strong>{totalPages}</strong>
          </article>
          <article
            className={`claim-metric ${groups.length && !loading ? 'claim-metric--clickable' : ''}`}
            onClick={() => groups.length && !loading && openGroupModal()}
          >
            <span>Baseline groups</span>
            <strong>{groupCount}</strong>
          </article>
          <article
            className={`claim-metric ${canOpenReviewModal && !loading ? 'claim-metric--clickable' : ''}`}
            onClick={() => canOpenReviewModal && !loading && setReviewRequiredModalOpen(true)}
          >
            <span>Review required</span>
            <strong>{reviewRequiredCount}</strong>
          </article>
          <article className="claim-metric">
            <span>Unassigned pages</span>
            <strong>{unassignedPageCount}</strong>
          </article>
        </div>

        <div className="claim-packet-table-wrap">
          <table className="claim-packet-table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Patient</th>
                <th>Total pages</th>
                <th>Groups</th>
                <th>Review required</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviewResult ? (
                <tr>
                  <td>{reviewResult.claimId || reviewResult.packetId || '—'}</td>
                  <td>{reviewResult.patientName || '—'}</td>
                  <td>{totalPages}</td>
                  <td>{groupCount}</td>
                  <td>{reviewRequiredCount}</td>
                  <td>{status}</td>
                  <td>
                    <div className="claim-packet-table-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleOpenPreview(`/api/claim-packets/${encodeURIComponent(reviewResult.claimId || reviewResult.packetId || '')}/review`)}
                        disabled={loading}
                      >
                        Open review
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleOpenPreview(getFirstGroupPreviewUrl())}
                        disabled={loading || !groups.length}
                      >
                        Preview first group PDF
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={handleSaveReview}
                        disabled={loading}
                      >
                        Save claim review
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={7} className="claim-packet-empty">
                    No processed packet loaded yet. Upload a PDF or search for a claim ID.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {saveMessage ? <p className="claim-packet-success">{saveMessage}</p> : null}
        {saveError ? <p className="claim-packet-error">{saveError}</p> : null}
      </section>

      {reviewResult && groups.length ? (
        <section className="panel claim-packet-panel">
          <div className="claim-packet-panel__header">
            <div>
              <h3>Group previews</h3>
              <p>Preview baseline or reviewed group PDFs for each group.</p>
            </div>
          </div>

          <div className="claim-packet-preview-grid">
            {groups.map((group) => (
              <article key={group.groupId || JSON.stringify(group.sourcePages)} className="claim-packet-preview-card">
                <strong>{group.displayName || group.documentType || 'Group'}</strong>
                <span>Pages: {group.sourcePages?.join(', ') || '—'}</span>
                <div className="claim-packet-preview-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleOpenPreview(buildGroupPreviewUrl(group.groupId, false))}
                    disabled={loading || !group.groupId}
                  >
                    Preview baseline
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleOpenPreview(buildGroupPreviewUrl(group.groupId, true))}
                    disabled={loading || !group.groupId}
                  >
                    Preview reviewed
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
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
                      <button type="button" className="primary-button" onClick={handleSaveReview} disabled={loading}>
                        Final save
                      </button>
                    </div>

              </div>
            ) : <p className="claim-packet-empty">No document groups were returned for this claim.</p>}
          </section>
        </div>
      ) : null}

      {isReviewRequiredModalOpen ? (
        <div className="claim-packet-modal" role="dialog" aria-modal="true" aria-label="Review required claim files">
          <div className="claim-packet-modal__backdrop" onClick={() => setReviewRequiredModalOpen(false)} />
          <section className="claim-packet-modal__content">
            <header className="claim-packet-modal__header">
              <div>
                <h3>Review required files</h3>
                <p>
                  Files marked for manual review or unassigned pages for claim {claimId || 'unknown'}.
                </p>
              </div>

              <button
                type="button"
                className="claim-packet-modal__close"
                onClick={() => setReviewRequiredModalOpen(false)}
                aria-label="Close review required files"
              >
                Close
              </button>
            </header>

            <div className="claimbridge-ag-grid-shell claimbridge-ag-grid-shell--modal">
              <div className="ag-theme-quartz claimbridge-ag-grid claimbridge-ag-grid--modal">
                <AgGridReact
                  rowData={reviewRequiredRows}
                  columnDefs={reviewRequiredColumnDefs}
                  defaultColDef={defaultColDef}
                  onCellClicked={handleReviewRequiredCellClicked}
                  domLayout="autoHeight"
                  pagination
                  paginationPageSize={10}
                  suppressRowClickSelection
                />
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
