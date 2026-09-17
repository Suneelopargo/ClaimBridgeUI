import './PageHeader.css'

// Shared page header used by every module's shell so navigating between
// screens (Dashboard, Administration, Reconciliation, ...) feels consistent.
export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div className="page-header__text">
        {eyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
        {title ? <h2>{title}</h2> : null}
        {description ? <p>{description}</p> : null}
      </div>

      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  )
}
