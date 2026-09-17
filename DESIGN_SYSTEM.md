# ClaimBridge Design System

Single source of truth for visual language across the ClaimBridge Claims Operations Suite.
All tokens live in [`src/index.css`](src/index.css) as CSS custom properties. Every screen must
consume these tokens instead of hardcoding colors, spacing, radius, or shadows.

## Colors

**Primary (ClaimBridge blue)**
`--color-primary`, `--color-primary-hover`, `--color-primary-active`, `--color-primary-subtle`

**Neutrals**
`--page-bg`, `--color-surface`, `--color-surface-elevated`, `--surface-border`,
`--surface-border-subtle`, `--heading-color`, `--text-color`, `--color-text-secondary`,
`--muted`, `--color-text-disabled`

**Semantic status colors** (paired `-bg` token for subtle backgrounds, never saturated fills)
`--color-success` / `--color-success-bg`
`--color-warning` / `--color-warning-bg`
`--color-error` / `--color-error-bg`
`--color-info` / `--color-info-bg`
`--color-pending` / `--color-pending-bg`
`--color-neutral` / `--color-neutral-bg`

**Chart palette** — `--chart-1` … `--chart-8`, reused for status distribution/amount charts so
chart colors never diverge from the token system.

## Typography

Font: **Inter** (`--font-family-base`), loaded once in `index.css`.

| Token | Size | Usage |
|---|---|---|
| `--text-hero` | 1.75rem | Page hero (rare, auth screen) |
| `--text-3xl` / `h2` default | 1.75rem | Page titles |
| `--text-2xl` | 1.625rem | PageHeader title |
| `--text-xl` / `h3` default | 1.375rem | Section titles |
| `--text-lg` | 1.125rem | Card titles |
| `--text-md` | 1rem | Panel headings |
| `--text-base` | 0.875rem | Body |
| `--text-sm` | 0.8125rem | Secondary text |
| `--text-xs` | 0.75rem | Captions, labels, badges |

Weights: `--font-weight-regular` (400), `-medium` (500), `-bold` (600), `-heavy` (700).
Numbers use `font-variant-numeric: tabular-nums` wherever values are compared in a column or KPI.

## Spacing

4px-based scale: `--space-1` (4) … `--space-12` (48). New layout code should use these instead of
arbitrary pixel values.

## Radius

- `--radius-control` (6px) — inputs, buttons, small chips
- `--radius-card` (10px) — cards, panels
- `--radius-container` (12px) — large containers, modals
- `--radius-pill` (999px) — badges, pills

`--radius-sm/md/lg/xl` are kept as legacy aliases mapped onto the scale above so existing rules
migrate automatically without a full rewrite.

## Shadows

- `--shadow-xs` — default card elevation (border does most of the work)
- `--shadow-sm` — hover state / slightly raised elements
- `--shadow-md` — dropdowns, popovers
- `--shadow-lg` — dialogs, drawers

Gradients are avoided outside of small brand accents (logo mark). Surfaces are flat white with a
1px border.

## Global application shell

- `.module-navbar` — sticky top navigation, solid navy, shared across every module.
- `.page-header` (see `src/design-system/PageHeader.jsx`) — breadcrumb-free page title +
  description + actions slot, rendered once per module inside `WorkspacePage`.

## Reusable components (`src/design-system/`)

- `PageHeader` — title, description, right-aligned actions. Used by every module (rendered once
  by `WorkspacePage`); page-specific duplicate hero headings have been removed from Claim
  Validations, Packet Processing, Reconciliation, IHX Ingestion, and Activity Log.
- `KpiCard` — label, icon, primary value, optional progress bar, helper caption. Used on the
  Dashboard.
- `StatusBadge` — semantic status pill. Central `resolveStatusTone()` / `getStatusLabel()` map
  both claim statuses (Pre Auth Approved, Settled, Cancelled, Pre Auth Denied, ...) and
  document/checklist statuses (Ready, Missing, Review Required, ...) to one of six tones. Used on
  the Dashboard status table, Claim Validations (checklist/packet statuses), Packet Processing
  (status column + snapshot), and the Reconciliation grid's `claimStatus` column.
- `FilterBar` — visual shell for filter rows (search/select/clear). Used in Reconciliation;
  the underlying inputs/state are unchanged, only the container is shared.
- `EmptyState` — title/description/action placeholder for empty or error data states.

Existing shared primitives (kept, not duplicated): `.primary-button` / `.secondary-button`,
`.panel` / `.panel-heading`, `.icon-button`, `.stat-card`, `.status-table` (Dashboard status
snapshot), AG Grid theme (`src/styles/claimbridge-ag-grid.css`).

## Status color mapping

| Status | Tone |
|---|---|
| Pre Auth Approved | info (blue) |
| Claim Approved / Settled | success (green) |
| Pre Auth In Progress / Submitted to Payer | pending (violet) |
| Pre Auth Denied / Rejected | error (red) |
| Cancelled / unrecognized | neutral (gray) |

## Responsive breakpoints

960px, 768px, 560px (see media queries in `App.css`). Navigation collapses labels before icons;
grids drop to 2 then 1 column; tables remain horizontally scrollable.

## Accessibility

- Buttons use `:focus-visible` outlines (2px solid primary) — never `outline: none` without a
  replacement.
- Icon-only buttons carry a `title` attribute (tooltip + accessible name).
- Status is never conveyed by color alone — `StatusBadge` always renders the status text next to
  the color dot.
- Body text targets 4.5:1 contrast against `--page-bg` / `--color-surface`.

## Adding new UI

1. Reuse a component from `src/design-system/` or an existing shared class in `App.css` before
   writing new CSS.
2. Never hardcode a hex color, px spacing, radius, or shadow — use a token.
3. New status/semantic colors must be added to the token list, not inlined.
4. New pages must render through `WorkspacePage` (gets the top nav + `PageHeader` for free).

## Known follow-ups (not yet migrated)

- Administration renders through an external package (`@aiventrahealth/administrator-ui`); its
  internal UI was not restyled in this pass (only the outer `PageHeader`/nav shell wraps it).
- No generic `DataTable` wrapper component was extracted — Reconciliation, Claim Validations, and
  Packet Processing each still configure `AgGridReact` independently. The `claimStatus` column in
  Reconciliation now renders `StatusBadge` via a `cellRenderer` while keeping its existing
  `agSelectCellEditor` for inline editing.
- `FilterBar` was only adopted in Reconciliation; Claim Validations/Packet Processing don't yet
  have comparable filter rows to migrate.
- No dedicated Drawer/Modal/ConfirmDialog components were built — existing custom modals
  (`claim-modal`, `claim-packet-modal`, `claim-small-modal`) were left as-is to avoid regressing
  their behavior.
- No Skeleton loading components — pages still use the existing `LoadingOverlay` spinner.
- Full 1440/1280/1024/768/560/375 responsive pass was not re-verified end-to-end this round.
