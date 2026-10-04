
-- Event Media OS v4 security hardening
-- Run AFTER the original setup SQL, migration-v2.sql and migration-v3.sql.
-- Review in Supabase before production deployment.

-- 1) Remove unnecessary anonymous database privileges.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on table app_profiles from anon;
revoke all on table employee_invites from anon;

-- 2) Keep authenticated API access only for tables the application actually uses.
grant select, insert, update, delete on table invoice_app_state, invoice_documents,
  invoice_payments, payment_receipts, equipment_rentals, owned_equipment_hires,
  other_expenses, clients, equipment_inventory, events, crew_members,
  crew_assignments, payouts, attachments, audit_log, app_profiles, employee_invites
to authenticated;

-- 3) Employees should not be able to delete operational records.
drop policy if exists "staff supplier rentals" on equipment_rentals;
create policy "staff supplier rentals" on equipment_rentals
for select to authenticated
using (public.app_role() in ('admin','employee') and workspace_id = public.app_workspace_id());

create policy "staff supplier rentals insert" on equipment_rentals
for insert to authenticated
with check (public.app_role() in ('admin','employee') and workspace_id = public.app_workspace_id());

create policy "staff supplier rentals update" on equipment_rentals
for update to authenticated
using (public.app_role() in ('admin','employee') and workspace_id = public.app_workspace_id())
with check (public.app_role() in ('admin','employee') and workspace_id = public.app_workspace_id());

drop policy if exists "staff owned equipment hires" on owned_equipment_hires;
create policy "staff owned equipment hires" on owned_equipment_hires
for select to authenticated
using (public.app_role() in ('admin','employee') and workspace_id = public.app_workspace_id());

create policy "staff owned equipment hires insert" on owned_equipment_hires
for insert to authenticated
with check (public.app_role() in ('admin','employee') and workspace_id = public.app_workspace_id());

create policy "staff owned equipment hires update" on owned_equipment_hires
for update to authenticated
using (public.app_role() in ('admin','employee') and workspace_id = public.app_workspace_id())
with check (public.app_role() in ('admin','employee') and workspace_id = public.app_workspace_id());

-- 4) Profiles/invites must never be writable by anonymous users.
alter table app_profiles enable row level security;
alter table employee_invites enable row level security;

-- 5) Add immutable server-side audit entries for critical business changes.
create or replace function public.event_media_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws text;
begin
  v_ws := coalesce(
    case when TG_OP = 'DELETE' then (to_jsonb(OLD)->>'workspace_id') else (to_jsonb(NEW)->>'workspace_id') end,
    public.app_workspace_id()
  );

  if v_ws is not null then
    insert into public.audit_log(workspace_id,user_email,action,table_name,record_id,details)
    values(
      v_ws,
      coalesce(auth.jwt()->>'email','system'),
      TG_OP,
      TG_TABLE_NAME,
      coalesce(case when TG_OP='DELETE' then (to_jsonb(OLD)->>'id') else (to_jsonb(NEW)->>'id') end,''),
      'Server audit event'
    );
  end if;
  return case when TG_OP='DELETE' then OLD else NEW end;
end;
$$;

revoke all on function public.event_media_audit_trigger() from public;
grant execute on function public.event_media_audit_trigger() to authenticated;

drop trigger if exists audit_invoice_documents on invoice_documents;
create trigger audit_invoice_documents after insert or update or delete on invoice_documents
for each row execute function public.event_media_audit_trigger();

drop trigger if exists audit_payment_receipts on payment_receipts;
create trigger audit_payment_receipts after insert or update or delete on payment_receipts
for each row execute function public.event_media_audit_trigger();

drop trigger if exists audit_equipment_rentals on equipment_rentals;
create trigger audit_equipment_rentals after insert or update or delete on equipment_rentals
for each row execute function public.event_media_audit_trigger();

drop trigger if exists audit_owned_equipment_hires on owned_equipment_hires;
create trigger audit_owned_equipment_hires after insert or update or delete on owned_equipment_hires
for each row execute function public.event_media_audit_trigger();

drop trigger if exists audit_other_expenses on other_expenses;
create trigger audit_other_expenses after insert or update or delete on other_expenses
for each row execute function public.event_media_audit_trigger();

-- 6) Prevent clients from inserting arbitrary audit identity fields.
drop policy if exists "audit insert" on audit_log;
create policy "audit insert" on audit_log
for insert to authenticated
with check (
  workspace_id = public.app_workspace_id()
  and (user_email is null or user_email = coalesce(auth.jwt()->>'email',''))
);

-- 7) Tighten audit visibility: administrators only.
drop policy if exists "audit admin read" on audit_log;
create policy "audit admin read" on audit_log
for select to authenticated
using (public.app_is_admin() and workspace_id = public.app_workspace_id());

-- 8) Storage remains private. Admins only.
alter table storage.objects enable row level security;
drop policy if exists "admin attachments files" on storage.objects;
create policy "admin attachments files" on storage.objects
for all to authenticated
using (
  bucket_id='attachments'
  and public.app_is_admin()
  and (storage.foldername(name))[1] = public.app_workspace_id()
)
with check (
  bucket_id='attachments'
  and public.app_is_admin()
  and (storage.foldername(name))[1] = public.app_workspace_id()
);

-- 9) Production bootstrap recommendation:
-- After the first administrator is created, disable public Auth sign-ups
-- in Supabase Authentication settings. Employee accounts should be created
-- only through the Admin invite workflow. Do not leave public sign-up enabled
-- indefinitely.

-- 10) Never store service-role keys in this application. The browser may use
-- the Supabase anon/publishable key; all authorization must come from RLS.
