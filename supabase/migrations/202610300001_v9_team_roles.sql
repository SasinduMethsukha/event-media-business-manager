-- Event Media OS v9: team roles and account safeguards.
-- Run once in the Supabase SQL Editor AFTER all earlier migrations
-- (setup SQL, migration-v2/v3/v4, supabase/migrations/202610040001_v5_security.sql).
-- Safe to run more than once.
--
-- Roles after this migration:
--   admin    - everything, including the team (owner of the workspace)
--   manager  - all business data (documents, payments, rentals, hires,
--              expenses, clients, events, crew, files); cannot manage the team
--              or read the activity log
--   employee - shown as "Staff": supplier rentals and equipment hire only
--
-- Also: protects the last active admin, limits which profile columns can be
-- edited, adds "last active" tracking, a team list for admins, a public
-- "does this workspace have an admin yet" check for the login screen, and
-- the missing DELETE permission on rentals / equipment hires.

-- 1) Allow the manager role ------------------------------------------------
alter table public.app_profiles drop constraint if exists app_profiles_role_check;
alter table public.app_profiles add constraint app_profiles_role_check
  check (role in ('admin', 'manager', 'employee'));
alter table public.app_profiles add column if not exists last_seen_at timestamptz;

-- 2) Role helpers ------------------------------------------------------------
-- app_is_admin() is used by every business-data policy, so widening it to
-- managers gives them business access without rewriting those policies.
create or replace function public.app_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('admin', 'manager'), false)
$$;

-- Workspace owner: team management, activity log.
create or replace function public.app_is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'admin', false)
$$;

-- Any active member (admin, manager or staff).
create or replace function public.app_is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('admin', 'manager', 'employee'), false)
$$;

revoke all on function public.app_is_owner() from public, anon;
revoke all on function public.app_is_member() from public, anon;
grant execute on function public.app_is_owner() to authenticated;
grant execute on function public.app_is_member() to authenticated;

-- 3) Team management stays owner-only --------------------------------------
drop policy if exists "profiles read" on public.app_profiles;
create policy "profiles read" on public.app_profiles
for select to authenticated
using (user_id = auth.uid() or (public.app_is_admin() and workspace_id = public.app_workspace_id()));

drop policy if exists "profiles admin update" on public.app_profiles;
create policy "profiles admin update" on public.app_profiles
for update to authenticated
using (public.app_is_owner() and workspace_id = public.app_workspace_id())
with check (public.app_is_owner() and workspace_id = public.app_workspace_id());

drop policy if exists "invites admin all" on public.employee_invites;
create policy "invites admin all" on public.employee_invites
for all to authenticated
using (public.app_is_owner() and workspace_id = public.app_workspace_id())
with check (public.app_is_owner() and workspace_id = public.app_workspace_id());

drop policy if exists "audit admin read" on public.audit_log;
create policy "audit admin read" on public.audit_log
for select to authenticated
using (public.app_is_owner() and workspace_id = public.app_workspace_id());

-- Only these profile columns may be changed from the app.
revoke update on table public.app_profiles from authenticated;
grant update (full_name, role, active) on table public.app_profiles to authenticated;

-- 4) Staff tables include managers; admins/managers can delete ---------------
drop policy if exists "staff supplier rentals" on public.equipment_rentals;
drop policy if exists "staff supplier rentals insert" on public.equipment_rentals;
drop policy if exists "staff supplier rentals update" on public.equipment_rentals;
drop policy if exists "manager supplier rentals delete" on public.equipment_rentals;
create policy "staff supplier rentals" on public.equipment_rentals
  for select to authenticated using (public.app_is_member() and workspace_id = public.app_workspace_id());
create policy "staff supplier rentals insert" on public.equipment_rentals
  for insert to authenticated with check (public.app_is_member() and workspace_id = public.app_workspace_id());
create policy "staff supplier rentals update" on public.equipment_rentals
  for update to authenticated using (public.app_is_member() and workspace_id = public.app_workspace_id())
  with check (public.app_is_member() and workspace_id = public.app_workspace_id());
create policy "manager supplier rentals delete" on public.equipment_rentals
  for delete to authenticated using (public.app_is_admin() and workspace_id = public.app_workspace_id());

drop policy if exists "staff owned equipment hires" on public.owned_equipment_hires;
drop policy if exists "staff owned equipment hires insert" on public.owned_equipment_hires;
drop policy if exists "staff owned equipment hires update" on public.owned_equipment_hires;
drop policy if exists "manager owned equipment hires delete" on public.owned_equipment_hires;
create policy "staff owned equipment hires" on public.owned_equipment_hires
  for select to authenticated using (public.app_is_member() and workspace_id = public.app_workspace_id());
create policy "staff owned equipment hires insert" on public.owned_equipment_hires
  for insert to authenticated with check (public.app_is_member() and workspace_id = public.app_workspace_id());
create policy "staff owned equipment hires update" on public.owned_equipment_hires
  for update to authenticated using (public.app_is_member() and workspace_id = public.app_workspace_id())
  with check (public.app_is_member() and workspace_id = public.app_workspace_id());
create policy "manager owned equipment hires delete" on public.owned_equipment_hires
  for delete to authenticated using (public.app_is_admin() and workspace_id = public.app_workspace_id());

drop policy if exists "staff read inventory" on public.equipment_inventory;
create policy "staff read inventory" on public.equipment_inventory
  for select to authenticated using (public.app_is_member() and workspace_id = public.app_workspace_id());

-- 5) Safeguards on profiles -------------------------------------------------
create or replace function public.app_profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id or new.workspace_id is distinct from old.workspace_id then
      raise exception 'A profile cannot be moved to another user or workspace.' using errcode = 'P0001';
    end if;
    if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
       and not exists (select 1 from public.app_profiles p
                       where p.workspace_id = old.workspace_id and p.role = 'admin' and p.active and p.user_id <> old.user_id) then
      raise exception 'This is the only active admin. Make someone else an admin first.' using errcode = 'P0001';
    end if;
    new.updated_at := now();
    return new;
  elsif tg_op = 'DELETE' then
    if old.role = 'admin' and old.active
       and not exists (select 1 from public.app_profiles p
                       where p.workspace_id = old.workspace_id and p.role = 'admin' and p.active and p.user_id <> old.user_id) then
      raise exception 'This is the only active admin and cannot be removed.' using errcode = 'P0001';
    end if;
    return old;
  end if;
  return new;
end;
$$;
drop trigger if exists app_profiles_guard on public.app_profiles;
create trigger app_profiles_guard before update or delete on public.app_profiles
for each row execute function public.app_profiles_guard();

-- Record role and status changes in the activity log.
create or replace function public.app_profiles_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role or new.active is distinct from old.active then
    insert into public.audit_log(workspace_id, user_email, action, table_name, record_id, details)
    values (new.workspace_id, coalesce(auth.jwt()->>'email', 'system'), 'UPDATE', 'app_profiles', new.user_id::text,
            'Team: ' || coalesce(new.email, new.full_name, '') ||
            case when new.role is distinct from old.role then ' role ' || old.role || ' -> ' || new.role else '' end ||
            case when new.active is distinct from old.active then case when new.active then ' enabled' else ' disabled' end else '' end);
  end if;
  return new;
end;
$$;
drop trigger if exists app_profiles_audit on public.app_profiles;
create trigger app_profiles_audit after update on public.app_profiles
for each row execute function public.app_profiles_audit();

-- 6) Helpers used by the app -------------------------------------------------
-- Login screen: show "Set up first admin" only for a brand-new workspace.
-- Reveals nothing except whether an admin exists.
create or replace function public.workspace_has_admin(ws text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_profiles where workspace_id = ws and role = 'admin' and active)
$$;
revoke all on function public.workspace_has_admin(text) from public;
grant execute on function public.workspace_has_admin(text) to anon, authenticated;

-- "Last active" on the Team page.
create or replace function public.touch_last_seen()
returns void language sql volatile security definer set search_path = public as $$
  update public.app_profiles set last_seen_at = now() where user_id = auth.uid() and active
$$;
revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- Team list with last sign-in, for admins and managers of the workspace.
create or replace function public.team_members()
returns table (user_id uuid, email text, full_name text, role text, active boolean,
               created_at timestamptz, last_seen_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select p.user_id, p.email, p.full_name, p.role, p.active, p.created_at, p.last_seen_at, u.last_sign_in_at
  from public.app_profiles p
  left join auth.users u on u.id = p.user_id
  where public.app_is_admin() and p.workspace_id = public.app_workspace_id()
  order by (p.role = 'admin') desc, p.active desc, p.full_name
$$;
revoke all on function public.team_members() from public, anon;
grant execute on function public.team_members() to authenticated;
