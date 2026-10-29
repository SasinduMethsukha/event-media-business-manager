# Team and sign-in setup (v9)

## 1. Run the database update (once)

Open Supabase → SQL Editor, paste
`supabase/migrations/202610300001_v9_team_roles.sql` and press **Run**.
(The Team page also has **Copy SQL** / **Open SQL Editor** buttons.) It is safe
to run more than once. It:

- adds the **Manager** role,
- stops the last active admin from being demoted, switched off or deleted,
- limits profile edits to name, role and on/off status,
- lets admins and managers delete supplier rentals and equipment-hire records
  (before this, deletes silently did nothing),
- records role and status changes in the Activity log,
- adds last-active times and a team list for the Team page,
- lets the sign-in screen hide "Set up the first admin" once a workspace has one.

Without it the app still works with Admin and Staff only.

## 2. Supabase Authentication settings

| Setting | Where | Value |
|---|---|---|
| Site URL | Authentication → URL Configuration | the address you open the app at, e.g. `https://yourname.github.io/event-media-business-manager/` |
| Redirect URLs | same page | the same address (password-reset links only return to listed addresses) |
| Email provider / SMTP | Authentication → Emails | set up custom SMTP for reliable reset emails (the built-in sender is heavily rate-limited) |
| Allow new users to sign up | Authentication → Sign In / Providers | **off** after the first admin exists; add people from Team |
| Minimum password length | Authentication → Passwords | 8 or more |

## 3. Roles

| Role (stored as) | Can use |
|---|---|
| Admin (`admin`) | Everything: documents, money, operations, Team, Activity log, database tools, cloud settings |
| Manager (`manager`) | Documents, invoices, payments, receivables, finance, reports, events, rentals, equipment hire, inventory, crew, clients, files |
| Staff (`employee`) | Supplier rentals and equipment hire |

The rules are enforced by Postgres row-level security. Hiding screens in
the app is only for convenience.

## 4. Everyday tasks

- **Add someone:** Team → Add member → choose the role → send the sign-in
  details (Copy or WhatsApp). They change the temporary password under
  **Account**.
- **Forgotten password:** they use "Forgot password?" on the sign-in screen,
  or an admin presses **Reset password** on Team. Both send an email link.
- **Someone leaves:** Team → **Switch off**. Their data access stops at once;
  their records stay.
- **Lost phone or shared computer:** Account → **Sign out on all devices**.

## 5. Server functions

Adding members uses the `create-employee` Edge Function that is already
deployed in your Supabase project. Its source is not in this repository.
Copy it into `supabase/functions/` so it is versioned with the rest.
Role and on/off changes now go straight to the database under the rules
above. The older `manage-profile` function is only used as a fallback.
