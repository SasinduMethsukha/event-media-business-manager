# Legacy migration map

| Legacy area | v5 destination |
|---|---|
| Auth/session | `src/auth/` |
| Supabase calls | `src/api/` |
| Business data access | `src/services/` |
| Dashboard | `src/features/dashboard/` |
| Clients | `src/features/clients/` |
| Events | `src/features/events/` |
| Finance/payments | `src/features/finance/` |
| Invoice editor | `src/features/invoices/` |
| Equipment | `src/features/equipment/` |
| Crew | `src/features/crew/` |
| Reports | `src/features/reports/` |
| Settings/users | `src/features/settings/` |
| DOM helpers | `src/utils/` |
| Global application state | `src/state/` |

Do not move code mechanically. Extract business rules into services and keep UI handlers thin.
