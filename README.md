# Event Media Production Business Management System

Quotations, invoices, payment receipts, supplier rentals, equipment hire,
expenses, events, crew and reports for Event Media Production — a static web
app backed by Supabase.

## Quick start

- **Run locally:** `npm run serve` then open http://localhost:8080 (or open
  `index.html` from any static web server).
- **Build for hosting:** `npm run build` → upload the `dist/` folder.
- **Check before deploying:** `npm run check` (lint + unit tests).

Keep the folder structure intact when hosting — `index.html` loads the files
below in this order:

| File | Purpose |
|---|---|
| `legacy/brand-assets.js` | Embedded logo and signatures |
| `legacy/script.js` | Editor, numbering, PDF/PNG export, cloud save, auth, Business Manager |
| `legacy/features.js` / `features2.js` | Clients, quotes, inventory, receivables / events, crew, payables, files, P&L, audit |
| `legacy/ai-quote.js` | AI quotation assistant (Gemini or offline parser) |
| `v4-modern.js` / `.css` | Dashboard analytics and modern UI layer |
| `v6-enhancements.js` / `.css` | Reliability & usability layer |
| `v7-features.js` / `v7-theme.css` | Theme, advance payment, amount in words, item library, search, WhatsApp share, attention panel |
| `style.css`, `features.css` | Base styling |

## v7 highlights

- New "Stage & Tally" theme with a calm toolbar; Save glows red when there are unsaved changes.
- Advance payment and amount in words on documents.
- Item library that learns your prices, `Ctrl/Cmd + K` search, Copy as new, Share on WhatsApp.
- "Needs attention" panel on the dashboard.

## v6 improvements

See `CHANGELOG.md` for the full list. Highlights:

- Document numbers are no longer skipped when the page is reloaded.
- Dates follow Sri Lanka local time (no more "yesterday" before 5:30 am).
- The Print button prints the quotation/invoice (it printed blank pages).
- Logins stay valid: the session refreshes itself instead of failing after an hour.
- Unsaved work is autosaved on the device and can be restored; you are
  warned before losing changes. `Ctrl/Cmd + S` saves, `Esc` closes dialogs.
- Roomier line-item editor, a Preview button on phones, correct PDF page
  breaks on phones and at any text size.
- AI assistant: fixed model name, multi-day items keep their price, safer
  handling of AI output and of the API key.

## v2 add-ons
- `features.js` / `features.css` — Clients, Quote pipeline (+convert to invoice), Inventory + availability/double-booking check, Receivables ageing + WhatsApp reminders.
- `migration-v2.sql` — run once in the Supabase SQL Editor (after the original setup SQL).
- Keep all files in one folder.

## v3 add-ons
- `features2.js` — Events (budget vs actual), Crew + payouts, Payables ledger, Files (Supabase Storage), P&L chart + tax summary + accountant CSV, Audit log, Tax presets.
- `migration-v3.sql` — run once after `migration-v2.sql`.


## v4 redesign
- `v4-modern.css` — modern minimalist UI layer; transforms the Business Manager into a clean responsive application shell.
- `v4-modern.js` — dashboard analytics with 12-month revenue/collection trend, year-to-date bars, monthly target tracking and annual progress.
- `migration-v4-security.sql` — database hardening: removes anonymous privileges, limits employee destructive actions, adds server-side audit triggers and tightens audit/storage policies.

### Recommended production rollout
1. Back up the Supabase project.
2. Run `migration-v4-security.sql`.
3. Create/verify the first Admin account.
4. Disable public Auth sign-ups after initial bootstrap.
5. Keep only the publishable/anon key in browser code; never deploy a service-role key.
6. Test Admin and Employee access separately before production.


# v5 architecture

The project now has a tidy modular architecture under `src/`, a documented privileged backend boundary under `server/`, and versioned Supabase security migrations under `supabase/migrations/`.

The original implementation is retained under `legacy/` during the migration period. New code must not add features to `legacy/script.js`, `legacy/features.js`, or `legacy/features2.js`.

See:
- `docs/ARCHITECTURE.md`
- `docs/SECURITY-CHECKLIST.md`
- `server/README.md`
- `supabase/migrations/202610040001_v5_security.sql`

## Migration rule

Move one feature at a time from `legacy/` into `src/features/`. Once a feature has parity tests and production validation, remove its legacy implementation.
