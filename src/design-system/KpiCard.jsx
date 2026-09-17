// Reusable KPI tile used on the Dashboard (and any future summary screen).
// Keeps the visual focus on the number: label + icon on top, value large,
// optional progress bar and helper caption below.
export default function KpiCard({ label, value, helpText, icon, tone = 'blue', progress }) {
  return (
    <article className="stat-card">
      <div className="card-heading">
        <span>{label}</span>
        {icon ? (
          <span className={`stat-card__icon stat-card__icon--${tone}`} aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>

      <strong>{value}</strong>

      {typeof progress === 'number' ? (
        <div className="stat-card__progress">
          <div
            className="stat-card__progress-fill"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      ) : null}

      {helpText ? <small>{helpText}</small> : null}
    </article>
  )
}
