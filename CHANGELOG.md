# Changelog

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
