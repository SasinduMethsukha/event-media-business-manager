-- Event Media OS v5: security conventions.
-- Apply after the existing v2/v3/v4 migrations.

-- Keep browser access authenticated. Do not grant broad privileges to anon.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Workspace-scoped identity helper.
create or replace function public.current_workspace_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from app_profiles
  where user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from app_profiles
  where user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

-- Never expose these helpers to anonymous callers.
revoke all on function public.current_workspace_id() from public, anon;
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.current_workspace_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Production rule:
-- 1. Create the first admin out-of-band.
-- 2. Disable public signup.
-- 3. Admin creates employee accounts.
-- 4. Employee invitations are single-use and expire.
-- 5. All workspace data policies must include current_workspace_id().
