-- Event Media OS v3 add-on tables. Safe to run multiple times. Run AFTER setup SQL and migration-v2.sql.
create table if not exists events (
  id uuid primary key default gen_random_uuid(), workspace_id text not null,
  name text not null, client_name text, event_date date, end_date date, location text,
  budget_revenue numeric not null default 0, budget_cost numeric not null default 0,
  status text not null default 'planned', notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index if not exists events_ws_name on events (workspace_id, lower(name));

create table if not exists crew_members (
  id uuid primary key default gen_random_uuid(), workspace_id text not null,
  name text not null, role text, phone text, day_rate numeric not null default 0, notes text,
  created_at timestamptz not null default now());
create table if not exists crew_assignments (
  id uuid primary key default gen_random_uuid(), workspace_id text not null,
  event_name text not null, crew_id uuid references crew_members(id) on delete set null, crew_name text not null,
  assign_date date not null default current_date, days numeric not null default 1, rate numeric not null default 0,
  amount numeric not null default 0, notes text, created_at timestamptz not null default now());

-- Shared payment ledger for crew payouts and supplier payments
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(), workspace_id text not null,
  kind text not null check (kind in ('crew','supplier')), ref_id uuid not null,
  party text, event_name text, amount numeric not null check (amount > 0),
  paid_date date not null default current_date, method text, reference text, notes text,
  created_at timestamptz not null default now());
create index if not exists payouts_ws_ref on payouts (workspace_id, kind, ref_id);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(), workspace_id text not null,
  event_name text, category text, file_name text not null, path text not null, size bigint,
  created_at timestamptz not null default now());

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(), workspace_id text not null,
  user_email text, action text, table_name text, record_id text, details text,
  created_at timestamptz not null default now());
create index if not exists audit_ws_time on audit_log (workspace_id, created_at desc);

do $$ declare t text; begin
  foreach t in array array['events','crew_members','crew_assignments','payouts','attachments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "admin %1$s" on %1$I', t);
    execute format('create policy "admin %1$s" on %1$I for all to authenticated using (public.app_is_admin() and workspace_id = public.app_workspace_id()) with check (public.app_is_admin() and workspace_id = public.app_workspace_id())', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- Audit log: any signed-in user can add entries for their own workspace; only admin can read. Nobody can edit/delete.
alter table audit_log enable row level security;
drop policy if exists "audit insert" on audit_log;
create policy "audit insert" on audit_log for insert to authenticated with check (workspace_id = public.app_workspace_id());
drop policy if exists "audit admin read" on audit_log;
create policy "audit admin read" on audit_log for select to authenticated using (public.app_is_admin() and workspace_id = public.app_workspace_id());
grant select, insert on audit_log to authenticated;

-- Private storage bucket for attachments (files stored under <workspace_id>/...)
insert into storage.buckets (id, name, public) values ('attachments','attachments', false) on conflict (id) do nothing;
drop policy if exists "admin attachments files" on storage.objects;
create policy "admin attachments files" on storage.objects for all to authenticated
  using (bucket_id='attachments' and public.app_is_admin() and (storage.foldername(name))[1] = public.app_workspace_id())
  with check (bucket_id='attachments' and public.app_is_admin() and (storage.foldername(name))[1] = public.app_workspace_id());
