import { makeDb, as } from './supabase-stub.mjs';
const MIG = new URL('../../supabase/migrations/202610300001_v9_team_roles.sql', import.meta.url).pathname;
let pass = 0, fail = 0;
const check = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + x : '')); };
async function err(p) { try { await p; return null; } catch (e) { return e.message; } }

const db = await makeDb([MIG, MIG]); // run twice: must be idempotent
check('migration applies (and re-applies) cleanly', true);
const WS = 'XTMNouuQ8iqJesxgH2R4';
async function user(email, name) {
  const r = await db.query(`insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify({ workspace_id: WS, full_name: name })]);
  return r.rows[0].id;
}
check('workspace_has_admin false before bootstrap', (await as(db, null, null, `select public.workspace_has_admin($1) v`, [WS])).rows[0].v === false);
const A = await user('owner@em.lk', 'Owner');          // first → admin (trigger)
const M = await user('manager@em.lk', 'Manager');      // → inactive employee
const S = await user('staff@em.lk', 'Staff');
await db.query(`update app_profiles set active = true where user_id in ($1, $2)`, [M, S]);
const roles = (await db.query(`select email, role, active from app_profiles order by email`)).rows.map(r => r.email + ':' + r.role + ':' + r.active).join(' ');
check('signup trigger: first user admin, others employee', roles.includes('owner@em.lk:admin:true') && roles.includes('manager@em.lk:employee'), roles);
check('anon can ask workspace_has_admin', (await as(db, null, null, `select public.workspace_has_admin($1) v`, [WS])).rows[0].v === true);
check('anon cannot read profiles', !!(await err(as(db, null, null, `select * from app_profiles`))) || (await as(db, null, null, `select count(*)::int n from app_profiles`)).rows[0].n === 0);

// owner promotes manager
const up = await as(db, A, 'owner@em.lk', `update app_profiles set role = 'manager' where user_id = $1 returning role`, [M]);
check('owner can set Manager role', up.rows[0] && up.rows[0].role === 'manager');
check('role change written to activity log', (await db.query(`select details from audit_log where table_name='app_profiles'`)).rows.some(r => /employee -> manager/.test(r.details)));
check('owner cannot change profile email (column locked)', /permission denied/.test(await err(as(db, A, 'owner@em.lk', `update app_profiles set email='x@y' where user_id=$1`, [M])) || ''));
check('owner cannot move a profile to another workspace', /permission denied|cannot be moved/.test(await err(as(db, A, 'owner@em.lk', `update app_profiles set workspace_id='other' where user_id=$1`, [M])) || ''));

// manager business access
await db.query(`insert into invoice_documents(workspace_id, doc_number, doc_type, client_name, grand_total, snapshot) values ($1,'INV-1','Invoice','X',100,'{}')`, [WS]).catch(async e => {
  const cols = (await db.query(`select column_name from information_schema.columns where table_name='invoice_documents'`)).rows.map(r => r.column_name); throw new Error(e.message + ' cols=' + cols);
});
await db.query(`insert into equipment_rentals(workspace_id, supplier_name, item_description, rent_date, amount) values ($1,'Sup','LED',current_date,10)`, [WS]);
await db.query(`insert into audit_log(workspace_id, action, table_name) values ($1,'x','y')`, [WS]);
check('manager reads invoices', (await as(db, M, 'manager@em.lk', `select count(*)::int n from invoice_documents`)).rows[0].n === 1);
check('manager can create invoices', !(await err(as(db, M, 'manager@em.lk', `insert into invoice_documents(workspace_id, doc_number, doc_type, client_name, grand_total, snapshot) values ($1,'INV-2','Invoice','Y',1,'{}')`, [WS]))));
check('manager reads rentals', (await as(db, M, 'manager@em.lk', `select count(*)::int n from equipment_rentals`)).rows[0].n === 1);
check('manager cannot change roles', (await as(db, M, 'manager@em.lk', `update app_profiles set role='admin' where user_id=$1 returning 1`, [M])).rows.length === 0);
check('manager cannot read activity log', (await as(db, M, 'manager@em.lk', `select count(*)::int n from audit_log`)).rows[0].n === 0);
check('manager sees team list', (await as(db, M, 'manager@em.lk', `select count(*)::int n from public.team_members()`)).rows[0].n === 3);

// staff
check('staff cannot read invoices', (await as(db, S, 'staff@em.lk', `select count(*)::int n from invoice_documents`)).rows[0].n === 0);
check('staff reads + adds rentals', (await as(db, S, 'staff@em.lk', `select count(*)::int n from equipment_rentals`)).rows[0].n === 1 &&
  !(await err(as(db, S, 'staff@em.lk', `insert into equipment_rentals(workspace_id, supplier_name, item_description, rent_date, amount) values ($1,'S2','Truss',current_date,5)`, [WS]))));
check('staff cannot delete rentals', (await as(db, S, 'staff@em.lk', `delete from equipment_rentals returning 1`)).rows.length === 0);
check('staff sees no team list', (await as(db, S, 'staff@em.lk', `select count(*)::int n from public.team_members()`)).rows[0].n === 0);
check('manager CAN delete rentals (was impossible before)', (await as(db, M, 'manager@em.lk', `delete from equipment_rentals where supplier_name='S2' returning 1`)).rows.length === 1);
check('owner can delete rentals', (await as(db, A, 'owner@em.lk', `delete from equipment_rentals returning 1`)).rows.length === 1);

// last admin
check('cannot demote the only admin', /only active admin/.test(await err(as(db, A, 'owner@em.lk', `update app_profiles set role='manager' where user_id=$1`, [A])) || ''));
check('cannot disable the only admin', /only active admin/.test(await err(as(db, A, 'owner@em.lk', `update app_profiles set active=false where user_id=$1`, [A])) || ''));
await as(db, A, 'owner@em.lk', `update app_profiles set role='admin' where user_id=$1`, [M]);
check('can step down once another admin exists', !(await err(as(db, A, 'owner@em.lk', `update app_profiles set role='manager' where user_id=$1`, [A]))));

// disabled users lose access immediately
await as(db, M, 'manager@em.lk', `update app_profiles set active=false where user_id=$1`, [S]);
check('disabled staff loses data access at once', (await as(db, S, 'staff@em.lk', `select count(*)::int n from equipment_rentals`)).rows[0].n === 0);
await as(db, S, 'staff@em.lk', `select public.touch_last_seen()`);
await as(db, A, 'owner@em.lk', `select public.touch_last_seen()`);
check('touch_last_seen updates own row only', (await db.query(`select email from app_profiles where last_seen_at is not null`)).rows.map(r => r.email).join() === 'owner@em.lk');
const other = await db.query(`insert into auth.users(email, raw_user_meta_data) values ('x@other.lk', '{"workspace_id":"OTHER"}') returning id`);
check('other workspace owner cannot see this team', (await as(db, other.rows[0].id, 'x@other.lk', `select count(*)::int n from public.team_members()`)).rows[0].n === 1);
console.log(`\n${pass} passed, ${fail} failed`);
