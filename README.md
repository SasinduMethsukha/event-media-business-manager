# Event Media Production Business Management System

Files are separated for easier editing and deployment:

- `index.html` — page structure and external library links
- `style.css` — all UI styling and responsive rules
- `script.js` — all application logic

Keep all three files in the same folder when hosting the site.

## v2 add-ons
- `features.js` / `features.css` — Clients, Quote pipeline (+convert to invoice), Inventory + availability/double-booking check, Receivables ageing + WhatsApp reminders.
- `migration-v2.sql` — run once in the Supabase SQL Editor (after the original setup SQL).
- Keep all files in one folder.

## v3 add-ons
- `features2.js` — Events (budget vs actual), Crew + payouts, Payables ledger, Files (Supabase Storage), P&L chart + tax summary + accountant CSV, Audit log, Tax presets.
- `migration-v3.sql` — run once after `migration-v2.sql`.
