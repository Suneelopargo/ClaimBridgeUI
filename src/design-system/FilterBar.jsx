import './FilterBar.css'

// Visual shell for filter rows (search + selects + clear action). Keeps every
// module's filtering UI visually identical; the actual controls/state stay
// owned by the page that renders them.
export default function FilterBar({ children, onClear, clearLabel = 'Clear filters' }) {
  return (
    <div className="filter-bar">
      <div className="filter-bar__controls">{children}</div>
      {onClear ? (
        <button type="button" className="filter-bar__clear" onClick={onClear}>
          {clearLabel}
        </button>
      ) : null}
    </div>
  )
}
