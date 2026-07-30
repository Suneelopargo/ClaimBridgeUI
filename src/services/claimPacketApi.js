import { buildApiUrl } from '../config/api'

const PROCESS_ENDPOINT = '/api/claim-packets/classify-and-segregate'
const REVIEW_ENDPOINT = '/api/claim-packets'
const VALIDATE_ENDPOINT = '/api/claim-packets/validate-checklist'

async function readJsonPayload(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

function getResponseErrorMessage(payload, fallbackMessage) {
  const candidate =
    payload?.error ||
    payload?.detail ||
    payload?.message ||
    payload?.result?.error ||
    payload?.result?.message

  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate
  }

  return fallbackMessage
}

export async function processCustomerClaimPacket(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(buildApiUrl(PROCESS_ENDPOINT), {
    method: 'POST',
    body: formData,
  })

  const payload = await readJsonPayload(response)

  if (!response.ok || payload?.success === false) {
    throw new Error(
      getResponseErrorMessage(payload, `Claim processing failed with status ${response.status}`),
    )
  }

  return payload
}

export async function getClaimPacketReview(claimId) {
  const response = await fetch(buildApiUrl(`${REVIEW_ENDPOINT}/${encodeURIComponent(claimId)}/review`), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  const payload = await readJsonPayload(response)

  if (!response.ok || payload?.success === false) {
    throw new Error(
      getResponseErrorMessage(payload, `Unable to load claim packet review: ${response.status}`),
    )
  }

  return payload
}

export async function getClaimPacketReviewedList(claimId) {
  const response = await fetch(buildApiUrl(`${REVIEW_ENDPOINT}/${encodeURIComponent(claimId)}/reviewedlist`), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  const payload = await readJsonPayload(response)

  if (!response.ok || payload?.success === false) {
    throw new Error(
      getResponseErrorMessage(payload, `Unable to load claim packet reviewed list: ${response.status}`),
    )
  }

  return payload
}


export async function saveClaimPacketReview(claimId, reviewPayload) {
  const response = await fetch(buildApiUrl(`${REVIEW_ENDPOINT}/${encodeURIComponent(claimId)}/review`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(reviewPayload),
  })

  const payload = await readJsonPayload(response)

  if (!response.ok || payload?.success === false) {
    throw new Error(
      getResponseErrorMessage(payload, `Unable to save claim packet review: ${response.status}`),
    )
  }

  return payload
}

export async function validateCustomerDispatchChecklist(claimId) {
  const validationUrl = buildApiUrl(
    `${VALIDATE_ENDPOINT}?claim_id=${encodeURIComponent(claimId)}`,
  )

  const response = await fetch(validationUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  })

  const payload = await readJsonPayload(response)

  if (!response.ok || payload?.success === false) {
    throw new Error(
      getResponseErrorMessage(payload, `Validation failed with status ${response.status}`),
    )
  }

  return payload
}

export async function updateChecklistItemDecision(claimId, checklistItemId, decisionData) {
  const response = await fetch(
    buildApiUrl(`${REVIEW_ENDPOINT}/${encodeURIComponent(claimId)}/checklist-items/${encodeURIComponent(checklistItemId)}`),
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(decisionData),
    },
  )

  const payload = await readJsonPayload(response)

  if (!response.ok || payload?.success === false) {
    throw new Error(
      getResponseErrorMessage(payload, `Unable to update checklist item: ${response.status}`),
    )
  }

  return payload
}

export async function uploadChecklistDocument(
  claimId,
  checklistItemId,
  file,
  documentType,
  displayName,
  reviewerRemarks,
) {
  const formData = new FormData()
  formData.append('file', file)
  if (documentType) formData.append('documentType', documentType)
  if (displayName) formData.append('displayName', displayName)
  if (reviewerRemarks) formData.append('reviewerRemarks', reviewerRemarks)

  const response = await fetch(
    buildApiUrl(
      `${REVIEW_ENDPOINT}/${encodeURIComponent(claimId)}/checklist-items/${encodeURIComponent(checklistItemId)}/documents`,
    ),
    {
      method: 'POST',
      body: formData,
    },
  )

  const payload = await readJsonPayload(response)

  if (!response.ok || payload?.success === false) {
    throw new Error(
      getResponseErrorMessage(payload, `Unable to upload document: ${response.status}`),
    )
  }

  return payload
}

export async function getClaimPacketChecklistReview(claimId) {
  const response = await fetch(
    buildApiUrl(`${REVIEW_ENDPOINT}/${encodeURIComponent(claimId)}/checklist-review`),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    },
  )

  const payload = await readJsonPayload(response)

  if (!response.ok || payload?.success === false) {
    throw new Error(
      getResponseErrorMessage(payload, `Unable to load checklist review document: ${response.status}`),
    )
  }

  return payload
}

export async function getClaimPacketChecklistItemDetail(claimId, itemId) {
  const response = await fetch(
    buildApiUrl(
      `${REVIEW_ENDPOINT}/${encodeURIComponent(claimId)}/checklist-items/${encodeURIComponent(itemId)}`,
    ),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    },
  )

  const payload = await readJsonPayload(response)

  if (!response.ok || payload?.success === false) {
    throw new Error(
      getResponseErrorMessage(payload, `Unable to load checklist item detail: ${response.status}`),
    )
  }

  return payload
}
