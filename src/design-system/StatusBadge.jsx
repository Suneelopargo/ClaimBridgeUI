import './StatusBadge.css'

// Central status → tone mapping so claim statuses AND document/checklist
// processing statuses render with the same semantic color everywhere
// (Dashboard, Claim Validations, Packet Processing, Reconciliation, Activity).
const STATUS_TONE_MAP = {
  // Claim lifecycle statuses
  'pre auth approved': 'info',
  'claim approved': 'success',
  settled: 'success',
  cancelled: 'neutral',
  'pre auth in progress': 'pending',
  'pre auth submitted to payer': 'pending',
  'pre auth denied': 'error',
  rejected: 'error',
  denied: 'error',

  // Document / checklist processing statuses
  ready: 'success',
  available: 'success',
  processed: 'success',
  required: 'pending',
  required_document_needed: 'pending',
  optional: 'neutral',
  not_applicable: 'neutral',
  missing: 'warning',
  review_required: 'warning',
  unassigned: 'warning',
  unknown: 'neutral',
}

export function resolveStatusTone(status) {
  const normalized = String(status || '').trim().toLowerCase()
  const key = normalized.replace(/\s+/g, '_')
  return STATUS_TONE_MAP[normalized] || STATUS_TONE_MAP[key] || 'neutral'
}

export function getStatusLabel(status) {
  return status ? String(status) : '—'
}

export default function StatusBadge({ status, tone, className = '' }) {
  const resolvedTone = tone || resolveStatusTone(status)

  return (
    <span className={`status-badge status-badge--${resolvedTone} ${className}`.trim()}>
      <span className="status-badge__dot" aria-hidden="true" />
      {getStatusLabel(status)}
    </span>
  )
}

