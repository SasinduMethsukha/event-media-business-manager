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
