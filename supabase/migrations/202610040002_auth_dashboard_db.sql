-- v5 module migration: Auth + dashboard + database access
-- Run after the existing setup, v2/v3 and v4 security migrations.

-- Profile access: a signed-in user may read only their own profile.
alter table public.app_profiles enable row level security;

drop policy if exists "profile self read" on public.app_profiles;
create policy "profile self read"
on public.app_profiles
for select
to authenticated
using (user_id = auth.uid());

-- Admins may manage profiles in their workspace.
drop policy if exists "profile admin manage" on public.app_profiles;
create policy "profile admin manage"
on public.app_profiles
for all
to authenticated
using (public.app_is_admin() and workspace_id = public.app_workspace_id())
with check (public.app_is_admin() and workspace_id = public.app_workspace_id());

-- Dashboard read access. Data remains workspace scoped by RLS.
alter table public.invoice_documents enable row level security;
drop policy if exists "dashboard invoice read" on public.invoice_documents;
create policy "dashboard invoice read"
on public.invoice_documents
for select
to authenticated
using (workspace_id = public.app_workspace_id());

alter table public.payment_receipts enable row level security;
drop policy if exists "dashboard receipt read" on public.payment_receipts;
create policy "dashboard receipt read"
on public.payment_receipts
for select
to authenticated
using (workspace_id = public.app_workspace_id());

alter table public.other_expenses enable row level security;
drop policy if exists "dashboard expense read" on public.other_expenses;
create policy "dashboard expense read"
on public.other_expenses
for select
to authenticated
using (workspace_id = public.app_workspace_id());

alter table public.clients enable row level security;
drop policy if exists "dashboard client read" on public.clients;
create policy "dashboard client read"
on public.clients
for select
to authenticated
using (workspace_id = public.app_workspace_id());

alter table public.events enable row level security;
drop policy if exists "dashboard event read" on public.events;
create policy "dashboard event read"
on public.events
for select
to authenticated
using (workspace_id = public.app_workspace_id());

-- These are intentionally SELECT-only. Writes stay behind their feature/service
-- boundaries and existing role policies.
