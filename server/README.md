# Backend boundary

The browser should not contain service-role credentials or privileged database operations.

Recommended production API:
- `middleware/auth.js` verifies the Supabase access token.
- `middleware/rbac.js` checks application permissions.
- `routes/*` contains HTTP contracts only.
- `services/*` contains business logic.
- Supabase/Postgres remains the system of record.
- Critical writes create server-side audit records.

For a small deployment, the frontend may continue using Supabase's browser-safe publishable/anon key with strict RLS. Move privileged workflows (invites, exports, tax reports, storage administration, role changes) behind this API.
