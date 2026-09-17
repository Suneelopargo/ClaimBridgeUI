import './DashboardSkeleton.css'

export default function DashboardSkeleton({ variant = 'chart' }) {
  return (
    <div className={`dashboard-skeleton dashboard-skeleton--${variant}`} aria-label="Loading dashboard data" role="status">
      <span className="dashboard-skeleton__line dashboard-skeleton__line--title" />
      <span className="dashboard-skeleton__line dashboard-skeleton__line--body" />
      <span className="dashboard-skeleton__line dashboard-skeleton__line--body" />
    </div>
  )
}
