# Event Media OS — Design System

**"Clean Studio"** — Stripe/Linear-style light dashboard. Neutral grey canvas, white cards with thin borders, ONE brand-red accent used only for primary actions and active states. Inter throughout, tabular numerals for money. Calm, dense, professional; no gradients or heavy shadows.

---

## Token Reference (`theme.css`)

All tokens are declared as CSS custom properties on `:root` and overridden in `[data-theme="dark"]`.

### Colours

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg` | `#f4f5f7` | `#0f1117` | Page canvas |
| `--surface` | `#ffffff` | `#181c24` | Cards, inputs, topbar |
| `--surface2` | `#f9fafb` | `#1e2330` | Subtle panels, table header bg |
| `--surface3` | `#f1f3f5` | `#242a38` | Hover fills, code blocks |
| `--border` | `#e5e7eb` | `#2a3040` | Primary dividers |
| `--border2` | `#d1d5db` | `#384050` | Input borders, hover borders |
| `--text` | `#111827` | `#f0f2f5` | Body text |
| `--text2` | `#6b7280` | `#9ba3b2` | Labels, metadata |
| `--text3` | `#9ca3af` | `#5c6478` | Placeholders, faint captions |
| `--accent` | `#c0392b` | `#e05245` | **Brand red — primary CTAs and active states only** |
| `--accent2` | `#a93226` | `#c0392b` | Hover state of accent |
| `--accent-light` | `#fef2f2` | `#2c1010` | Tinted accent backgrounds |
| `--accent-ring` | `rgba(192,57,43,.18)` | `rgba(224,82,69,.2)` | Focus ring |

**Semantic palette:**
`--green / --green-bg`, `--amber / --amber-bg`, `--blue / --blue-bg`, `--purple / --purple-bg`, `--red / --red-bg`, `--slate / --slate-bg` — used for status pills and alerts.

### Typography

| Token | Value |
|---|---|
| `--font-body` | `'Inter', system-ui, sans-serif` |
| `--font-display` | same as `--font-body` |
| `--font-mono` | `ui-monospace, 'SFMono-Regular', Consolas, monospace` |
| `--font-tabular` | `'Inter'` — always pair with `font-variant-numeric: tabular-nums` |

### Spacing & Radii

| Token | Value |
|---|---|
| `--radius` | `8px` (inputs, buttons) |
| `--radius-lg` | `12px` (cards, dropdowns) |
| `--radius-xl` | `16px` (modals, auth card) |
| `--topbar-h` | `60px` |
| `--sidebar-w` | `260px` |

### Shadows

| Token | Intent |
|---|---|
| `--shadow-xs` | Hairline lift (topbar, metric cards) |
| `--shadow` | Mild elevation (modals hover) |
| `--shadow-md` | Dropdown, popover |
| `--shadow-lg` | Modal backdrop |

---

## Rules

1. **Never re-declare tokens in component CSS.** Use the tokens; don't hardcode hex values.
2. **`--accent` for primary actions only.** Use `--blue`, `--green` etc. for semantic states.
3. **No gradients on UI chrome.** Gradients are permitted inside the print document (`preview-doc`) only.
4. **`--font-tabular` + `font-variant-numeric: tabular-nums`** on every monetary figure.
5. **WCAG AA contrast** everywhere. Test both light and dark at 1:1 zoom.
6. **Touch targets ≥ 40px** on ≤ 768px breakpoints.
7. **`prefers-reduced-motion`** guard on every animation/transition.
8. **Do NOT touch `.preview-doc` or anything inside it.** That is the printable invoice area.

---

## Components

### Buttons
```css
.btn            /* neutral */
.btn-primary    /* accent red — one per section max */
.btn-success    /* green */
.btn-info       /* blue */
.btn-danger     /* red */
.btn-ghost      /* dashed border */
.btn-icon       /* icon-only, 32px */
.btn-sm         /* 30px height */
```

### Status Pills (with dot)
```html
<span class="status-badge status-paid">Paid</span>
<span class="status-badge status-unpaid">Unpaid</span>
<span class="status-badge status-overdue">Overdue</span>
<!-- etc. — see theme.css section 11 for full list -->
```

### Toast (JS)
```js
showToast('Saved successfully', 'success', 'Invoice saved', 4000);
showToast('Something went wrong', 'error');
// window.alert() is automatically routed through showToast
```

### Confirm Dialog (JS)
```js
// async — use for new features
const ok = await confirmDialog('Delete this record? This cannot be undone.', 'Delete', 'Delete', true);
if (!ok) return;
```

### Global Search
- Keyboard: **Ctrl / Cmd + K**
- Search trigger button injected into the topbar automatically by `theme.js`
- Navigates to any manager pane

### Skeleton Loaders
```js
showSkeleton('managerInvoiceTable', 6); // shows 6 skeleton rows
// replaced automatically when real HTML is written to the container
```

### Empty States
Enhanced automatically by `theme.js` — containers with `.manager-empty` get an icon and proper messaging.

### Calendar View Toggle
Injected automatically on the Supplier Rentals and Equipment Hire panes. Click the calendar icon to switch from table to month view.

---

## File Load Order

```
style.css    ← legacy base styles
features.css ← v2 add-on styles
theme.css    ← design system (loads LAST — highest priority)

script.js    ← app logic (do not edit)
features.js  ← v2 logic (do not edit)
features2.js ← v3 logic (do not edit)
theme.js     ← UI layer (loads LAST)
```
