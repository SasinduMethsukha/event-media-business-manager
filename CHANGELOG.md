# Changelog

## v9.0.0 — sign-in and team

Needs `supabase/migrations/202610300001_v9_team_roles.sql` for the Manager role
and safeguards (see `docs/TEAM-AND-SIGN-IN.md`). Without it the app keeps
working with Admin and Staff.

### Sign-in
- New sign-in screen with brand panel; clear error messages instead of raw
  server text; Caps Lock warning; busy state; Enter submits.
- **Forgot password**: sends a reset link (the reply is the same for every
  email address, so the form can't be used to check who has an account).
- **Choose a new password** page opened from the email link, with a strength
  meter; expired or used links explain what to do.
- "Set up the first admin" is only offered for a workspace that has no admin.
- **Account**: change your password (current password required) and sign
  out on all devices.

### Team
- New Team page: everyone with role, on/off status and last activity; search.
- **Manager** role between Admin and Staff: all business screens, no team or
  database tools.
- **Add member** with role choice, generated temporary password, and sign-in
  details ready to copy or send on WhatsApp.
- Reset someone's password by email; switch people off and on.
- Menu shows only what each role can use; Team, Activity log, database tools
  and cloud settings are Admin-only.

### Database (migration)
- The last active admin can't be demoted, switched off or deleted.
- Profile edits limited to name, role and status. A profile can't be moved
  to another user or workspace.
- Role and status changes are written to the Activity log.
- **Fix:** deleting supplier rentals and equipment-hire records silently did
  nothing (there was no delete permission). Admins and managers can now delete.
- Tested against Postgres with the full SQL history (27 access-rule checks).

## v8.0.0 — one app, new navigation

Quotation, invoice and receipt documents are unchanged.

- **Single side menu** for the whole app, grouped into Documents, Money,
  Operations and Workspace. It replaces the editor's tab strip, the separate
  Business Manager screen header and its tab list.
- **New document** button: blank Quotation, Invoice, Proforma, Purchase order
  or Credit note (fresh number, today's date, empty client), or start from a
  template.
- **Contextual top bar**: page title (document type and number in the editor),
  search, and only the actions for that page: document actions in the
  editor, Refresh and Record payment in the Manager. Less-used exports (PNG,
  CSV, Google Sheets, copy, revision) moved into a More menu.
- **Editor**: section jump bar (Company, Document, Event, Client, Items,
  Pricing, Sign-off, Payment) that highlights where you are; company details
  collapse into one row; sticky live total with an Add item button.
- The unsaved-changes dot also shows next to "Document editor" in the menu.
- Phones: the menu opens as a drawer from the ☰ button.
- Employees see only Supplier rentals and Equipment hire in the menu.

## v7.0.0 — "Stage & Tally" theme and new features

### New theme
- Cool lighting-desk greys, stage navy ink and one tally-light red (the logo
  red). Headings in Archivo at an expanded width; tabular figures for money.
- Calm toolbar: neutral buttons instead of six different colours, with
  **Save** as the single primary action. Its light glows red while there are
  unsaved changes, like a camera's REC light.
- Matching "Backstage" dark mode, restyled login, dashboard and charts.
- Phones: icon-only toolbar with Save always visible.
- Quotations, invoices and receipts keep their existing design.

### New features
- **Advance payment** on documents: percentage or fixed amount, with the
  balance due shown below the grand total.
- **Amount in words** under the grand total (Rupees / Cents, and the other
  currencies in the list).
- **Item library**: every saved document adds its items and latest prices.
  Descriptions autocomplete; picking a known item fills in its tag and price.
  "From item library" opens a searchable picker. Included in Export Backup.
- **Search / command palette** (`Ctrl/Cmd + K`): open any saved document by
  number, client or event, or run actions (PDF, print, record payment...).
- **Copy as new document**: from History or the palette; fresh number,
  today's date, same validity period.
- **Share on WhatsApp**: an editable summary (number, event, total, advance,
  validity) sent to the client's number.
- **Needs attention** strip on the Business Manager dashboard: overdue
  invoices, invoices due within 7 days, supplier rentals and hired equipment
  due back within 3 days. Each opens the right screen.
- **Keyboard shortcuts** list (press `?`).
- Employees no longer see document tools they cannot use.

### Fixes
- The preview no longer crashes on categories saved without a colour.

## v6.0.0 — reliability & usability pass

No features were removed or redesigned; every existing screen, workflow,
document format and database table works as before.

### Bugs fixed

- **Skipped document numbers.** Opening or reloading the editor (or switching
  document type) used to consume the next number, so quotations jumped e.g.
  228 → 230. Numbers are now only reserved when a document is saved.
- **Wrong dates in Sri Lanka before 05:30.** "Today" was calculated in UTC,
  so early-morning issue dates, due dates, overdue flags, month filters and
  reports used the previous day. All of these now use local time. The
  dashboard's 12-month chart was also shifted one month for UTC+ time zones.
- **Print button printed blank pages.** Receipt print rules hid the whole
  page. Print now outputs the quotation/invoice, one A4 sheet per page;
  receipt and client-statement printing still work.
- **Session expired after ~1 hour.** Saves and Business Manager actions
  failed with "JWT expired" until the user logged out. The session now
  refreshes before expiry and any request that gets a 401 is retried once.
- **Pages taller than A4.** Pagination ignored per-page padding and the page
  footer, and miscalculated pages when the Text size slider was not 100%.
  PDFs squashed those pages. Pages are now exact A4 and PDF export never
  distorts (an over-long category is scaled, not squashed).
- **PDF on phones** was one squashed, unpaginated page because the preview was
  hidden on small screens. It is now paginated like on desktop.
- **AI assistant**: requests used a non-existent model name
  (`gemini-3.8-flash`); multi-day items were inserted with a 0.00 total;
  model output was inserted into the page as raw HTML.
- "Restore" on a removed item did not refresh the editor.
- Dashboard "cash collected" could count the same payment twice (receipt +
  legacy payment).
- A failed invoice status update after recording a receipt was silently ignored.
- `npm run build` produced a `dist/` folder without the application scripts.
- Business Manager header was clipped at the left and could slide under the
  top bar.

### Security

- Workspace IDs and generated employee passwords use `crypto.getRandomValues`
  instead of `Math.random`.
- Server error messages are escaped before being shown.
- `esc()` also escapes single quotes.
- Gemini API key sent in the `x-goog-api-key` header instead of the URL.
- Added `.gitignore` (keeps `.env` and `node_modules` out of Git) and a strict
  referrer policy.

### Usability

- Unsaved-changes dot on **Save**, browser warning before leaving, and a
  confirmation before opening another document over unsaved edits.
- Automatic local draft: after a crash or closed tab the editor offers to
  restore the last unsaved document.
- Non-blocking toast notifications instead of pop-up alerts.
- Keyboard: `Ctrl/Cmd + S` saves, `Esc` closes dialogs and the phone preview.
- Line-item editor redesigned as compact cards so description, quantity and
  price are fully visible (they were cut off).
- Amounts in the document no longer wrap onto two lines.
- Phones: **Preview** button shows the document fitted to the screen.
- Offline/online notices; clear message if the PDF library could not load.
- Sensible default revenue targets on the dashboard.
- Accessibility: icon-only buttons get labels, visible keyboard focus,
  reduced-motion support.

### Performance

- Preview re-render is batched per animation frame while typing.
- PDF/canvas libraries load with `defer` (no longer block first paint).
- The v5 module no longer downloads `supabase-js` from a CDN on every load.
- 110 KB of embedded images moved out of `legacy/script.js` into
  `legacy/brand-assets.js`.

### Developer tooling

- `npm run lint` (ESLint flat config), `npm run test` (Vitest + jsdom unit
  tests for numbering, revisions, totals, dates, payment status, AI parser),
  `npm run check`, `npm run serve`.
