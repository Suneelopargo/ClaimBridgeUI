import { AgGridReact } from 'ag-grid-react'
import './DataTable.css'

// A deliberately thin AG Grid wrapper: shared visual treatment without
// intercepting grid events, editing, or per-screen configuration.
export default function DataTable({ className = '', ...gridProps }) {
  return (
    <div className={`claimbridge-data-table ag-theme-quartz ${className}`.trim()}>
      <AgGridReact {...gridProps} />
    </div>
  )
}
