# Event Media OS v5 architecture

## 1. Layers

```text
Browser UI
  └── src/features/*
        └── src/services/*
              └── src/api/*
                    ├── Supabase browser-safe client
                    └── /api privileged backend boundary

Postgres / Supabase
  ├── RLS
  ├── workspace isolation
  ├── audit triggers
  └── storage policies
```

## 2. Rules

- UI never performs raw SQL.
- UI never knows database credentials beyond the publishable/anon key.
- Features call domain services.
- Services call repositories/API clients.
- Repositories own table access.
- Authorization is checked in the UI for UX and enforced again by RLS/backend.
- `workspace_id` is never trusted from an arbitrary form field.
- Server-side identity comes from `auth.uid()`.
- Destructive actions require explicit permission.
- Critical financial changes are auditable.
- Secrets belong in deployment environment variables, never source files.

## 3. Folder ownership

| Folder | Responsibility |
|---|---|
| `src/core` | boot/config/application lifecycle |
| `src/auth` | authentication + authorization |
| `src/api` | transport and persistence |
| `src/services` | domain operations |
| `src/state` | application state |
| `src/features` | screen/feature logic |
| `src/components` | reusable UI |
| `src/utils` | small pure helpers |
| `supabase/migrations` | database evolution/security |
| `server` | privileged backend boundary |
| `docs` | architecture and operations |

## 4. Migration strategy

The v5 structure is introduced alongside the existing legacy implementation. Migrate feature-by-feature:

1. Authentication
2. Dashboard
3. Clients
4. Events
5. Finance
6. Invoices
7. Equipment
8. Crew
9. Reports
10. Settings

After each migration, delete the corresponding legacy code. Do not maintain two sources of truth indefinitely.
