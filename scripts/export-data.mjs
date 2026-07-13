/**
 * Exports everything readable from the live Supabase project to backup/.
 *
 * Signs in with your ADMIN app login and reads through the public API, because the
 * admin RLS policies grant an admin SELECT on every table. This needs no dashboard
 * access and no service_role key — which is the whole point, since those are exactly
 * what we are locked out of.
 *
 * What it CANNOT export: auth.users (emails, password hashes). That table is not
 * exposed through PostgREST at all, and reaching it requires the service_role key.
 * Accounts therefore cannot be migrated; users would have to re-register.
 *
 * Usage — add to .env, then `node scripts/export-data.mjs`:
 *   EXPORT_ADMIN_EMAIL=you@example.com
 *   EXPORT_ADMIN_PASSWORD=your-app-password
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';

// Minimal .env reader — avoids adding a dependency just for this.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.EXPORT_ADMIN_EMAIL;
const password = process.env.EXPORT_ADMIN_PASSWORD;

if (!url || !anonKey) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing from .env');
  process.exit(1);
}

if (!email || !password) {
  console.error(
    'Add your ADMIN app login to .env, then re-run:\n\n' +
      '  EXPORT_ADMIN_EMAIL=you@example.com\n' +
      '  EXPORT_ADMIN_PASSWORD=your-app-password\n\n' +
      'This is your login to the KnowGraph site itself, not a Supabase dashboard login.'
  );
  process.exit(1);
}

// Tables in dependency order, so a later re-import can insert parents first.
const TABLES = [
  'courses',
  'learning_paths',
  'capsules',
  'capsule_content',
  'capsule_prerequisites',
  'quizzes',
  'quiz_questions',
  'quiz_attempts',
  'enrollments',
  'profiles',
  'user_roles',
  'progress',
];

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (authError) {
  console.error(`Sign-in failed: ${authError.message}`);
  process.exit(1);
}

// A non-admin session would silently export almost nothing, which would look like
// success. Fail loudly instead.
const { data: roles } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', auth.user.id);

const isAdmin = (roles ?? []).some((r) => r.role === 'admin');
console.log(`Signed in as ${email} — admin: ${isAdmin ? 'yes' : 'NO'}`);

if (!isAdmin) {
  console.error(
    '\nThis account is not an admin, so RLS will hide most rows and the export would\n' +
      'be misleadingly empty. Sign in with the admin account instead.'
  );
  process.exit(1);
}

mkdirSync('backup', { recursive: true });

const summary = {};
let total = 0;

for (const table of TABLES) {
  const { data, error } = await supabase.from(table).select('*');

  if (error) {
    console.log(`  ${table.padEnd(24)} skipped (${error.message})`);
    summary[table] = null;
    continue;
  }

  writeFileSync(`backup/${table}.json`, JSON.stringify(data, null, 2));
  summary[table] = data.length;
  total += data.length;
  console.log(`  ${table.padEnd(24)} ${String(data.length).padStart(5)} rows`);
}

writeFileSync(
  'backup/_manifest.json',
  JSON.stringify(
    { exported_from: url, exported_at: new Date().toISOString(), counts: summary },
    null,
    2
  )
);

console.log(`\n${total} rows written to backup/`);
console.log(
  'Note: auth.users (accounts and passwords) is NOT in this export and cannot be —\n' +
    'it needs the service_role key. Users would have to re-register on a new project.'
);
