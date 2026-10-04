-- Event Media OS v2 add-on tables. Safe to run multiple times. Run AFTER the original setup SQL.
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  name text not null,
  contact_person text, email text, phone text, whatsapp text, address text,
  payment_terms_days int not null default 30,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clients_ws_name on clients (workspace_id, lower(name));

create table if not exists equipment_inventory (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  name text not null,
  qty_owned numeric not null default 1,
  serial_numbers text,
  condition text not null default 'good',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists inventory_ws_name on equipment_inventory (workspace_id, lower(name));

alter table invoice_documents add column if not exists quote_status text not null default 'draft';
alter table invoice_documents add column if not exists converted_to text;

alter table clients enable row level security;
alter table equipment_inventory enable row level security;
drop policy if exists "admin clients" on clients;
create policy "admin clients" on clients for all to authenticated
  using (public.app_is_admin() and workspace_id = public.app_workspace_id())
  with check (public.app_is_admin() and workspace_id = public.app_workspace_id());
drop policy if exists "admin inventory" on equipment_inventory;
create policy "admin inventory" on equipment_inventory for all to authenticated
  using (public.app_is_admin() and workspace_id = public.app_workspace_id())
  with check (public.app_is_admin() and workspace_id = public.app_workspace_id());
drop policy if exists "staff read inventory" on equipment_inventory;
create policy "staff read inventory" on equipment_inventory for select to authenticated
  using (public.app_role() in ('admin','employee') and workspace_id = public.app_workspace_id());
grant select, insert, update, delete on clients, equipment_inventory to authenticated;
