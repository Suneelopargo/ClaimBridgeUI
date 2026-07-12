import './LoadingOverlay.css'

export default function LoadingOverlay({
  isVisible,
  title = 'Please wait',
  description = 'Loading data from server. This may take a moment.',
  scope = 'viewport',
  className = '',
}) {
  if (!isVisible) {
    return null
  }

  const scopeClassName = scope === 'container' ? 'common-loader--container' : 'common-loader--viewport'
  const rootClassName = className
    ? `common-loader ${scopeClassName} ${className}`
    : `common-loader ${scopeClassName}`

  return (
    <section className={rootClassName} aria-live="polite" aria-busy="true" role="status">
      <div className="common-loader__content">
        <span className="common-loader__spinner" aria-hidden="true"></span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </section>
  )
}
