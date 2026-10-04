# CHANGELOG — Event Media OS UI Redesign
**"Clean Studio" Design System**  
Date: 2026-10-04

---

## New Files

| File | Purpose |
|---|---|
| `theme.css` | Design-system stylesheet — loaded last, highest CSS cascade priority |
| `theme.js` | UI layer — toast, confirm dialog, global search, dashboard enhancements |
| `DESIGN-SYSTEM.md` | Token reference, component API, rules |

---

## Changes to Existing Files

### `index.html`
- Added `<link rel="stylesheet" href="theme.css">` after `features.css` in `<head>`.
- Added `<script src="theme.js"></script>` after `features2.js` before `</body>`.
- **Zero** element IDs, onclick handlers, or function names changed.
- **Zero** markup inside `.preview-doc` / printable invoice area touched.

---

## Features Delivered

### Task 1 — Manager shell: sidebar navigation
- Converts `.manager-tabs` from horizontal scroll strip to vertical left-nav on ≥ 1024px with grouped labels: Overview, Sales, Operations, Money, Admin.
- At ≤ 1024px reverts to horizontal tab strip; at ≤ 480px pins as sticky bottom nav bar.
- `theme.js` injects nav group labels without touching any HTML/JS.

### Task 2 — Dashboard: KPI sparklines, Overdue panel, Upcoming strip
- Inline SVG micro-sparklines added to metric cards after render.
- Red-tinted "Overdue Today" panel reads `managerState.invoices`.
- Horizontal scrollable "Upcoming Events & Returns" strip (next 14 days).

### Task 3 — Quotes: status board summary bar
- 6-lane board (draft / sent / accepted / rejected / expired / converted) with per-lane count and proportional fill bar.
- Existing status `<select>` and Convert button untouched.

### Task 4 — Calendar view toggle (Rentals + Equipment Hire)
- Table/Calendar toggle button injected into register card header.
- Full month grid with dot indicators on days with records; day-click shows record list.

### Task 5 — Tables
- Sticky headers via `thead { position: sticky; }`.
- Status pills with coloured dot (`.status-badge::before`).
- Row hover background tint.
- Empty states: icon + message + CTA.
- `window.showSkeleton(id, rows)` utility.

### Task 6 — alert()/confirm() replaced
- `window.alert` routed to toast — all callers work unchanged.
- `window.confirmDialog()` async styled dialog for new code.
- Native `window.confirm()` preserved for synchronous callers.

### Task 7 — Global search (Ctrl/Cmd+K)
- Keyboard-navigable overlay (↑↓ arrows, Enter, Escape).
- Navigates to any named manager pane.
- Search trigger injected into topbar.

### Task 8 — Login, document editor, modals restyled
- Auth gate/card: white card on neutral bg, no decoration blobs.
- Modals: flat, thin border, `border-radius: 16px`.
- Manager card heads: gradient removed.

### Task 9 — Responsive QA (375 / 768 / 1280 / 1536px, light & dark)
- **1536px:** 4-column KPI grid, full sidebar.
- **1280px:** 3-column KPI, 180px sidebar.
- **1024px:** Sidebar → horizontal tabs.
- **768px:** 2-column grids, stacked layout.
- **375px:** 1-column, bottom nav, 40px touch targets, iOS font-zoom fix.

---

## Hard Rules — Compliance

| Rule | Status |
|---|---|
| No element IDs removed or renamed | ✅ |
| No onclick handlers changed | ✅ |
| No edits to script.js / features.js / features2.js | ✅ |
| `.preview-doc` and invoice print area untouched | ✅ |
| No new external dependencies | ✅ |
| WCAG AA contrast | ✅ |
| Visible focus states | ✅ |
| Touch targets ≥ 40px on mobile | ✅ |
| prefers-reduced-motion respected | ✅ |
| Light + dark themes | ✅ |
