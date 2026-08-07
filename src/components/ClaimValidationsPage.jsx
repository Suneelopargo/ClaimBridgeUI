import { useCallback, useEffect, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { buildApiUrl } from '../config/api'
import {
  getClaimPacketChecklistItemDetail,
  getClaimPacketChecklistReview,
  getClaimPacketReview,
  getClaimPacketReviewedList,
  processCustomerClaimPacket,
  saveClaimPacketReview,
  updateChecklistItemDecision,
  uploadChecklistDocument,
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

export default function ClaimValidationsPage({ isActive = true }) {
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
  const [reviewedListResult, setReviewedListResult] = useState(null)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('')
  const [selectedChecklistItem, setSelectedChecklistItem] = useState(null)
  const [isChecklistActionModalOpen, setChecklistActionModalOpen] = useState(false)
  const [checklistDecisionOption, setChecklistDecisionOption] = useState('')
  const [checklistRemarks, setChecklistRemarks] = useState('')
  const [checklistActionLoading, setChecklistActionLoading] = useState(false)
  const [checklistActionError, setChecklistActionError] = useState('')
  const [checklistActionSuccess, setChecklistActionSuccess] = useState('')
  const [checklistStatusOverrides, setChecklistStatusOverrides] = useState({})

  const [selectedUploadItem, setSelectedUploadItem] = useState(null)
  const [isUploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadModalFile, setUploadModalFile] = useState(null)
  const [uploadModalRemarks, setUploadModalRemarks] = useState('')
  const [uploadModalLoading, setUploadModalLoading] = useState(false)
  const [uploadModalError, setUploadModalError] = useState('')
  const [uploadModalSuccess, setUploadModalSuccess] = useState('')

  const [loading, setLoading] = useState(false)
  const [loadingTitle, setLoadingTitle] = useState('')
  const [loadingDescription, setLoadingDescription] = useState('')
  const [reportAvailable, setReportAvailable] = useState(false)
  const [reportChecking, setReportChecking] = useState(false)
  const [reportCheckError, setReportCheckError] = useState('')

  const handleOpenUploadModal = (row) => {
    setSelectedUploadItem(row)
    setUploadModalFile(null)
    setUploadModalRemarks('')
    setUploadModalError('')
    setUploadModalSuccess('')
    setUploadModalOpen(true)
  }

  const handleSaveUploadModal = async () => {
    if (!selectedUploadItem || !claimId) return

    if (!uploadModalFile) {
      setUploadModalError('Please select a PDF file to upload.')
      return
    }

    const itemId =
      selectedUploadItem.checklistItemId ||
      selectedUploadItem.itemNo ||
      selectedUploadItem.id

    try {
      setUploadModalLoading(true)
      setUploadModalError('')
      setUploadModalSuccess('')

      await uploadChecklistDocument(
        claimId,
        String(itemId),
        uploadModalFile,
        selectedUploadItem.documentType || selectedUploadItem.groupCode || '',
        selectedUploadItem.checklistItem || selectedUploadItem.displayName || '',
        uploadModalRemarks.trim() || 'Uploaded supplemental document',
      )

      setChecklistStatusOverrides((prev) => ({
        ...prev,
        [selectedUploadItem.itemNo]: 'AVAILABLE',
      }))

      setUploadModalSuccess('Document uploaded successfully!')

      try {
        await getClaimPacketChecklistReview(claimId)
      } catch {
        // Fallback
      }

      setTimeout(() => {
        setUploadModalOpen(false)
      }, 1000)
    } catch (err) {
      setUploadModalError(
        err instanceof Error ? err.message : 'Unable to upload document.',
      )
    } finally {
      setUploadModalLoading(false)
    }
  }

  const packet = packetResult?.result || null
  const validation = validationResult?.result || null
  const claimId = packet?.claimId || ''
  const claimReview = groupReviewResult?.result || null
  const reviewResult = claimReview

  const handleOpenChecklistModal = async (item) => {
    if (!claimId) return

    try {
      setChecklistActionLoading(true)
      setChecklistActionError('')

      let fetchedDetail = null
      try {
        const detailPayload = await getClaimPacketChecklistItemDetail(
          claimId,
          item.itemNo || item.checklistItemId || item.id,
        )
        fetchedDetail = detailPayload?.result || null
      } catch {
        // Fallback to item
      }

      const activeItem = fetchedDetail || item
      setSelectedChecklistItem(activeItem)
      setChecklistDecisionOption('')
      setChecklistRemarks('')
      setChecklistActionError('')
      setChecklistActionSuccess('')
      setChecklistActionModalOpen(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to fetch item details.',
      )
    } finally {
      setChecklistActionLoading(false)
    }
  }

  const handleSelectDecisionOption = (option) => {
    setChecklistDecisionOption(option)
    setChecklistActionError('') // Clear error message when choosing another option
  }

  const handleTableDocumentUpload = async (row, file) => {
    if (!claimId || !file) return

    try {
      setLoadingTitle('Uploading document')
      setLoadingDescription(
        `Uploading ${file.name} for ${row.checklistItem}...`,
      )
      setLoading(true)
      setError('')

      const itemId = row.checklistItemId || row.itemNo || row.id

      await uploadChecklistDocument(
        claimId,
        String(itemId),
        file,
        row.documentType || row.groupCode || '',
        row.checklistItem || row.displayName || '',
        'Uploaded supplemental document from validation table',
      )

      setChecklistStatusOverrides((prev) => ({
        ...prev,
        [row.itemNo]: 'AVAILABLE',
      }))

      // Sync latest checklist review document from backend
      try {
        await getClaimPacketChecklistReview(claimId)
      } catch {
        // Fallback
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to upload document.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSaveChecklistAction = async () => {
    if (!selectedChecklistItem || !claimId) return

    if (!checklistDecisionOption) {
      setChecklistActionError(
        'Please choose an option (Ignore, Not applicable, or Required) before saving.',
      )
      return
    }

    const itemId =
      selectedChecklistItem.checklistItemId ||
      selectedChecklistItem.itemNo ||
      selectedChecklistItem.id

    try {
      setChecklistActionLoading(true)
      setChecklistActionError('')
      setChecklistActionSuccess('')

      let decision = 'REQUIRED'
      let remarks = checklistRemarks.trim()

      if (checklistDecisionOption === 'IGNORE') {
        decision = 'OPTIONAL'
        if (!remarks) remarks = 'Ignored by reviewer'
      } else if (checklistDecisionOption === 'NOT_APPLICABLE') {
        decision = 'NOT_APPLICABLE'
        if (!remarks) remarks = 'Not applicable'
      } else if (checklistDecisionOption === 'REQUIRED') {
        decision = 'REQUIRED'
        if (!remarks) remarks = 'Marked as required document'
      }

      const payload = {
        reviewerDecision: decision,
        reviewerRemarks: remarks,
      }

      await updateChecklistItemDecision(claimId, String(itemId), payload)

      const statusMap = {
        IGNORE: 'OPTIONAL',
        NOT_APPLICABLE: 'NOT_APPLICABLE',
        REQUIRED: 'REQUIRED',
      }

      const newStatus = statusMap[checklistDecisionOption] || 'REQUIRED'

      setChecklistStatusOverrides((prev) => ({
        ...prev,
        [selectedChecklistItem.itemNo]: newStatus,
      }))

      setChecklistActionSuccess('Status updated successfully!')

      // Sync latest checklist review document from backend
      try {
        await getClaimPacketChecklistReview(claimId)
      } catch {
        // Fallback to local status overrides
      }

      setTimeout(() => {
        setChecklistActionModalOpen(false)
      }, 1000)
    } catch (err) {
      setChecklistActionError(
        err instanceof Error ? err.message : 'Unable to save checklist action.',
      )
    } finally {
      setChecklistActionLoading(false)
    }
  }

  const handleOpenPreview = useCallback((url) => {
    if (!url) {
      return
    }

    window.open(buildApiUrl(url), '_blank', 'noopener')
  }, [])

  const processClaim = async () => {
    if (!selectedFile) {
      setError('Please select a customer claim packet PDF file before processing.')
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

  // Check availability of portfolio excel report when the page becomes active
  useEffect(() => {
    if (!isActive) return undefined

    let cancelled = false

    const checkReport = async () => {
      setReportChecking(true)
      setReportCheckError('')

      const url = buildApiUrl('/api/claim-packets/document-reports/portfolio/excel/download')

      try {
        // Use GET (server does not allow HEAD) and include credentials if backend uses session cookies
        const getResp = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: '*/*',
          },
          credentials: 'include',
        })

        if (!cancelled) {
          setReportAvailable(getResp.ok)
        }
      } catch (err) {
        if (!cancelled) {
          setReportAvailable(false)
          setReportCheckError('Unable to check report availability. Please try again later.')
        }
      } finally {
        if (!cancelled) setReportChecking(false)
      }
    }

    checkReport()

    return () => {
      cancelled = true
    }
  }, [isActive])

  const handleDownloadReport = async () => {
    const downloadUrl = buildApiUrl('/api/claim-packets/document-reports/portfolio/excel/download')
    const generateUrl = buildApiUrl('/api/claim-packets/document-reports/portfolio/generate')

    try {
      setLoading(true)
      setLoadingTitle('Preparing report')
      setLoadingDescription('Generating the portfolio report, then downloading...')

      // First request: trigger generation of the complete portfolio report
      const genResp = await fetch(generateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!genResp.ok) {
        throw new Error(`Report generation failed: ${genResp.status}`)
      }

      // Optionally we could inspect the generation response for paths/names
      // Now call the existing download endpoint to fetch the generated file
      const resp = await fetch(downloadUrl, { method: 'GET', credentials: 'include' })

      if (!resp.ok) {
        throw new Error(`Report download failed: ${resp.status}`)
      }

      const blob = await resp.blob()
      const contentDisposition = resp.headers.get('content-disposition') || ''
      let filename = 'HCG_Claim_Validation_Report.xlsx'

      const match = /filename\*=UTF-8''([^;\n\r]*)/.exec(contentDisposition) || /filename="?([^";]+)"?/.exec(contentDisposition)
      if (match && match[1]) {
        try {
          filename = decodeURIComponent(match[1])
        } catch {
          filename = match[1]
        }
      }

      const urlObj = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = urlObj
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(urlObj)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download report.')
    } finally {
      setLoading(false)
      setLoadingTitle('')
      setLoadingDescription('')
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
  const displayGroups = useMemo(() => {
    if (reviewedListResult?.result?.groups && reviewedListResult.result.groups.length > 0) {
      return reviewedListResult.result.groups
    }
    if (reviewResult?.groups && reviewResult.groups.length > 0) {
      return reviewResult.groups
    }
    return groupedDocuments
  }, [reviewedListResult, reviewResult, groupedDocuments])
  const groups = displayGroups
  const reviewGroups = displayGroups
  const groupedDocumentRows = useMemo(
    () =>
      displayGroups.map((doc, index) => {
        const pNums = doc.pageNumbers || doc.sourcePages || []
        const rawPreviewUrl = doc.previewUrl || ''
        const previewUrl =
          rawPreviewUrl ||
          (claimId && doc.groupId
            ? `/api/claim-packets/${encodeURIComponent(claimId)}/groups/${encodeURIComponent(doc.groupId)}/preview`
            : '')

        return {
          ...doc,
          id: doc.groupId || `${doc.groupCode || doc.displayName || 'group'}-${index}`,
          pageNumbers: pNums,
          previewUrl: previewUrl,
        }
      }),
    [displayGroups, claimId],
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

    if (!claimId || !selectedGroup?.groupId) {
      setSelectedGroupPreviewUrl('')
      return undefined
    }

    const fallbackUrl = buildGroupPreviewUrl(selectedGroup.groupId, false)
    let cancelled = false

    const fetchReviewedListData = async () => {
      try {
        const payload = await getClaimPacketReviewedList(claimId)
        if (cancelled) return

        const reviewedGroups = payload?.result?.groups || []
        const matchedGroup =
          reviewedGroups.find((g) => g.groupId === selectedGroup.groupId) ||
          reviewedGroups.find((g) => g.documentType === selectedGroup.documentType) ||
          reviewedGroups.find((g) => g.displayName === selectedGroup.displayName)

        if (matchedGroup) {
          if (matchedGroup.previewUrl) {
            setSelectedGroupPreviewUrl(matchedGroup.previewUrl)
          } else {
            setSelectedGroupPreviewUrl(buildReviewedGroupPreviewUrl(selectedGroup.groupId))
          }

          const pageNumbers = matchedGroup.pageNumbers || matchedGroup.sourcePages || []
          if (pageNumbers.length > 0) {
            setGroupPageAssignments((prevAssignments) => ({
              ...(prevAssignments || {}),
              [selectedGroup.groupId]: pageNumbers,
            }))
          }
        } else {
          setSelectedGroupPreviewUrl(fallbackUrl)
        }
      } catch {
        if (!cancelled) {
          setSelectedGroupPreviewUrl(fallbackUrl)
        }
      }
    }

    fetchReviewedListData()

    return () => {
      cancelled = true
    }
  }, [claimId, selectedGroupId, groups, buildGroupPreviewUrl, buildReviewedGroupPreviewUrl])

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
      setSaveSuccessMessage('')

      const result = await getClaimPacketReview(claimId)
      const loadedGroups = result?.result?.groups ?? []
      setGroupReviewResult(result)
      setSelectedGroupId('')
      setSourceGroupId('')
      setPagesToAssign([])
      setSelectedGroupPreviewUrl('')

      let initialAssignments = Object.fromEntries(
        loadedGroups.map((group) => [group.groupId, [...(group.sourcePages || [])]]),
      )

      try {
        const reviewedListPayload = await getClaimPacketReviewedList(claimId)
        setReviewedListResult(reviewedListPayload)
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
      setSaveSuccessMessage('')

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

      try {
        const reviewedListPayload = await getClaimPacketReviewedList(claimId)
        setReviewedListResult(reviewedListPayload)
      } catch {
        // Fallback to saved result
      }

      setSaveSuccessMessage('Review saved successfully!')
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
        isVisible={processing || validating || loading}
        title={
          processing
            ? 'Processing claim packet'
            : validating
              ? 'Running claim validation'
              : loadingTitle || 'Please wait'
        }
        description={
          processing
            ? 'Uploading the PDF, classifying pages, and building the claim packet.'
            : validating
              ? 'Checking the generated packet against the dispatch checklist.'
              : loadingDescription || 'Processing request...'
        }
        scope="viewport"
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
            <button
              type="button"
              className="primary-button"
              onClick={processClaim}
              disabled={processing}
            >
              {processing ? 'Processing Claim...' : 'Process Claim'}
            </button>
            <button
              type="button"
              className={`secondary-button ${packet ? 'claim-validation-active-btn' : ''}`}
              onClick={validateClaim}
              disabled={!packet || processing || validating}
              title={
                !packet
                  ? 'Complete Claim Process first to enable Validation Check'
                  : 'Run checklist validation on processed claim packet'
              }
            >
              {validating ? 'Running Validation...' : 'Validation Check'}
            </button>
            <button
              type="button"
               className="primary-button"
              onClick={handleDownloadReport}
              disabled={!reportAvailable || reportChecking || loading}
              title={
                !reportAvailable
                  ? 'Report not available yet — run the Validation Check to generate it'
                  : 'Download portfolio Excel report'
              }
              style={{ marginLeft: '12px' }}
            >
              {loading && loadingTitle === 'Downloading report' ? 'Downloading...' : 'Download Report'}
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

        </section>
      ) : null}

      {validation ? (
        <section className="claim-panel panel">
          <div className="claim-panel__header claim-panel__header--stacked">
            <div>
              <h3>Validation check</h3>
              <p>Checklist readiness for the processed claim packet.</p>
            </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                <StatusBadge value={validation.summary?.overallStatus} />

                <div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleDownloadReport}
                    disabled={!reportAvailable || reportChecking || loading}
                    title={
                      !reportAvailable
                        ? 'Report not available yet — run Validation Check to generate it'
                        : 'Download portfolio Excel report'
                    }
                  >
                    {loading && loadingTitle === 'Downloading report' ? 'Downloading...' : 'Download Report'}
                  </button>
                </div>

                {!reportAvailable && !reportChecking ? (
                  <small className="claim-info">Report not generated yet — run the Validation Check to generate it.</small>
                ) : null}

                {reportChecking ? <small className="claim-info">Checking report availability...</small> : null}
              </div>
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {checklistValidation.map((row) => {
                  const currentStatus = checklistStatusOverrides[row.itemNo] || row.status
                  const normStatus = String(currentStatus || '').toUpperCase()
                  const showActionIcon = normStatus !== 'AVAILABLE'
                  const isRequired = normStatus === 'REQUIRED' || normStatus === 'REQUIRED_DOCUMENT_NEEDED'

                  return (
                    <tr key={row.itemNo}>
                      <td>{row.itemNo}</td>
                      <td>{row.checklistItem}</td>
                      <td>{row.required ? 'Yes' : 'No'}</td>
                      <td>
                        <StatusBadge value={currentStatus} />
                      </td>
                      <td>{row.matchedFiles?.join(', ') || '—'}</td>
                      <td>{row.remarks || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          {showActionIcon ? (
                            <button
                              type="button"
                              className="claim-checklist-card__action-btn"
                              onClick={() => handleOpenChecklistModal(row)}
                              title="Edit checklist item status"
                              aria-label={`Action for ${row.checklistItem}`}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9"/>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                              </svg>
                            </button>
                          ) : null}

                          {isRequired ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => handleOpenUploadModal(row)}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              📤 Upload
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
                      {saveSuccessMessage ? (
                        <span className="claim-save-success-msg" style={{ color: '#059669', fontWeight: 600, marginRight: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          ✓ {saveSuccessMessage}
                        </span>
                      ) : null}
                      <button type="button" className="primary-button" onClick={handleSaveReview} disabled={groupReviewLoading}>
                        {groupReviewLoading ? 'Saving...' : 'Save'}
                      </button>
                    </div>

              </div>
            ) : <p className="claim-packet-empty">No document groups were returned for this claim.</p>}
          </section>
        </div>
      ) : null}

      {isChecklistActionModalOpen && selectedChecklistItem ? (
        <div className="claim-small-modal" role="dialog" aria-modal="true" aria-label="Update checklist item">
          <div className="claim-small-modal__backdrop" onClick={() => setChecklistActionModalOpen(false)} />
          <section className="claim-small-modal__content">
            <header className="claim-small-modal__header">
              <div>
                <span className="eyebrow">Checklist Item #{selectedChecklistItem.itemNo}</span>
                <h3>{selectedChecklistItem.checklistItem}</h3>
              </div>
              <button
                type="button"
                className="claim-small-modal__close"
                onClick={() => setChecklistActionModalOpen(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </header>

            <div className="claim-small-modal__body">
              <div className="claim-small-modal__status-row">
                <span>Current Status:</span>
                <StatusBadge value={checklistStatusOverrides[selectedChecklistItem.itemNo] || selectedChecklistItem.status} />
              </div>

              <div className="claim-small-modal__form">
                <div className="claim-small-modal__field">
                  <label>Select Status / Action</label>
                  <div className="claim-small-modal__radio-group">
                    <label className="claim-small-modal__radio-label">
                      <input
                        type="radio"
                        name="checklistDecision"
                        value="IGNORE"
                        checked={checklistDecisionOption === 'IGNORE'}
                        onChange={() => handleSelectDecisionOption('IGNORE')}
                      />
                      <span>Ignore</span>
                    </label>

                    <label className="claim-small-modal__radio-label">
                      <input
                        type="radio"
                        name="checklistDecision"
                        value="NOT_APPLICABLE"
                        checked={checklistDecisionOption === 'NOT_APPLICABLE'}
                        onChange={() => handleSelectDecisionOption('NOT_APPLICABLE')}
                      />
                      <span>Not applicable</span>
                    </label>

                    <label className="claim-small-modal__radio-label">
                      <input
                        type="radio"
                        name="checklistDecision"
                        value="REQUIRED"
                        checked={checklistDecisionOption === 'REQUIRED'}
                        onChange={() => handleSelectDecisionOption('REQUIRED')}
                      />
                      <span>Required</span>
                    </label>
                  </div>
                </div>

                <div className="claim-small-modal__field">
                  <label>Remarks / Notes</label>
                  <input
                    type="text"
                    placeholder="Add remarks or notes..."
                    value={checklistRemarks}
                    onChange={(e) => setChecklistRemarks(e.target.value)}
                  />
                </div>
              </div>

              {checklistActionError ? (
                <p className="claim-small-modal__error">{checklistActionError}</p>
              ) : null}

              {checklistActionSuccess ? (
                <p className="claim-small-modal__success">✓ {checklistActionSuccess}</p>
              ) : null}
            </div>

            <footer className="claim-small-modal__footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setChecklistActionModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleSaveChecklistAction}
                disabled={checklistActionLoading}
              >
                {checklistActionLoading ? 'Saving...' : '💾 Save'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {isUploadModalOpen && selectedUploadItem ? (
        <div className="claim-small-modal" role="dialog" aria-modal="true" aria-label="Upload document">
          <div className="claim-small-modal__backdrop" onClick={() => setUploadModalOpen(false)} />
          <section className="claim-small-modal__content">
            <header className="claim-small-modal__header">
              <div>
                <span className="eyebrow">Upload Document for Item #{selectedUploadItem.itemNo}</span>
                <h3>{selectedUploadItem.checklistItem}</h3>
              </div>
              <button
                type="button"
                className="claim-small-modal__close"
                onClick={() => setUploadModalOpen(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </header>

            <div className="claim-small-modal__body">
              <div className="claim-small-modal__status-row">
                <span>Current Status:</span>
                <StatusBadge value={checklistStatusOverrides[selectedUploadItem.itemNo] || selectedUploadItem.status} />
              </div>

              <div className="claim-small-modal__form">
                <div className="claim-small-modal__field">
                  <label>
                    Upload Document (PDF) <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      setUploadModalFile(e.target.files?.[0] || null)
                      setUploadModalError('')
                    }}
                  />
                </div>

                <div className="claim-small-modal__field">
                  <label>Remarks / Notes</label>
                  <input
                    type="text"
                    placeholder="Add remarks or notes..."
                    value={uploadModalRemarks}
                    onChange={(e) => setUploadModalRemarks(e.target.value)}
                  />
                </div>
              </div>

              {uploadModalError ? (
                <p className="claim-small-modal__error">{uploadModalError}</p>
              ) : null}

              {uploadModalSuccess ? (
                <p className="claim-small-modal__success">✓ {uploadModalSuccess}</p>
              ) : null}
            </div>

            <footer className="claim-small-modal__footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setUploadModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleSaveUploadModal}
                disabled={uploadModalLoading}
              >
                {uploadModalLoading ? 'Saving...' : '💾 Save'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  )
}
