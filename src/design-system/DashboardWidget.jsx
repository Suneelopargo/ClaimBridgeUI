import './DashboardWidget.css'

/**
 * A small presentation-only shell for operational dashboard modules.
 * Data loading intentionally stays with the feature page.
 */
export default function DashboardWidget({
  title,
  subtitle,
  actions,
  children,
  className = '',
  id,
}) {
  return (
    <article id={id} className={`dashboard-widget ${className}`.trim()}>
      <header className="dashboard-widget__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="dashboard-widget__actions">{actions}</div> : null}
      </header>
      <div className="dashboard-widget__body">{children}</div>
    </article>
  )
}
