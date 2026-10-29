// Stand-in for Supabase: auth + storage schemas, roles and JWT helpers.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
export const STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage; create schema extensions;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), last_sign_in_at timestamptz);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
grant execute on all functions in schema auth to anon, authenticated;
create table storage.buckets(id text primary key, name text, public boolean default false);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
grant select, insert, update, delete on storage.objects to authenticated;
`;
const Q = new URL('../../.cache/setup.sql', import.meta.url).pathname; // extracted from index.html by the test runner
const ROOT = new URL('../../', import.meta.url).pathname;
export const FILES = [Q, ROOT + 'migration-v2.sql', ROOT + 'migration-v3.sql', ROOT + 'migration-v4-security.sql', ROOT + 'supabase/migrations/202610040001_v5_security.sql'];
export async function makeDb(extra = []) {
  const db = new PGlite();
  await db.exec(STUB);
  for (const f of FILES.concat(extra)) {
    try { await db.exec(fs.readFileSync(f, 'utf8')); }
    catch (e) { throw new Error(f.split('/').pop() + ': ' + e.message); }
  }
  return db;
}
// Run a statement as a signed-in user (RLS applies).
export async function as(db, uid, email, sql, params) {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)`, [uid || '', JSON.stringify(uid ? { sub: uid, email, role: 'authenticated' } : {})]);
  await db.exec(uid ? 'set role authenticated' : 'set role anon');
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
