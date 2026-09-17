import './EmptyState.css'

// Shared empty/error placeholder so no data-driven screen shows a blank area.
export default function EmptyState({ title, description, action, tone = 'neutral' }) {
  return (
    <div className={`empty-state empty-state--${tone}`}>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  )
}
