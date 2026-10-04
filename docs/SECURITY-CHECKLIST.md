# Production security checklist

## Authentication
- [ ] Disable public signup after initial admin bootstrap.
- [ ] Require verified email for employee accounts.
- [ ] Use strong password policy and MFA where supported.
- [ ] Revoke sessions after account disablement.
- [ ] Never accept role/workspace from the browser as authoritative.

## Authorization
- [ ] Every table has RLS enabled.
- [ ] Every policy scopes rows to `current_workspace_id()`.
- [ ] Admin-only operations use `is_admin()`.
- [ ] Employees cannot delete financial/audit records.
- [ ] Invite tokens are single-use and expire.

## Secrets
- [ ] No service-role key in frontend.
- [ ] No API keys committed to Git.
- [ ] Production secrets stored in deployment secret manager.
- [ ] `.env` excluded from source control.

## Application
- [ ] Validate all user input.
- [ ] Escape untrusted HTML.
- [ ] Rate-limit authentication and privileged endpoints.
- [ ] Add CSRF protection to cookie-authenticated API endpoints.
- [ ] Configure CSP, HSTS, frame-ancestors, referrer policy and MIME sniffing protection.
- [ ] Uploads use allowlists, size limits, private storage and generated names.
- [ ] Financial mutations produce audit records.

## Operations
- [ ] Database backups enabled.
- [ ] Restore tested.
- [ ] Audit logs retained.
- [ ] Dependency scanning enabled.
- [ ] Error monitoring enabled without collecting passwords/tokens.
