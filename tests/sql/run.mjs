// Extracts the setup SQL embedded in index.html, then runs the RLS checks
// against an in-memory Postgres (PGlite). Usage: npm run test:sql
import fs from 'node:fs';
const root = new URL('../../', import.meta.url).pathname;
const html = fs.readFileSync(root + 'index.html', 'utf8');
const m = html.match(/<div class="code-block" id="supabaseSqlCode">([\s\S]*?)<\/div>/);
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
fs.mkdirSync(root + '.cache', { recursive: true });
fs.writeFileSync(root + '.cache/setup.sql', unesc(m[1]));
await import('./team-roles.rls.mjs');
