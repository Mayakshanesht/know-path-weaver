/**
 * Checks that EXPORT_ADMIN_EMAIL / EXPORT_ADMIN_PASSWORD in .env still sign in.
 *
 * These are only used by the local maintenance scripts that need to act AS the admin rather
 * than with the service-role key. Changing the admin password in the browser silently
 * invalidates them, and the failure shows up much later as a confusing "Invalid login
 * credentials" in the middle of something unrelated.
 *
 * Never prints the password.
 *
 *   node scripts/check-admin-login.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

if (!existsSync('.env')) {
  console.error('No .env file here. Run this from the project root.');
  process.exit(1);
}

const env = {};
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const email = env.EXPORT_ADMIN_EMAIL;
const password = env.EXPORT_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('EXPORT_ADMIN_EMAIL / EXPORT_ADMIN_PASSWORD are not both set in .env.');
  process.exit(1);
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  console.error(`\n  FAILS for ${email}: ${error.message}`);
  console.error('  Update EXPORT_ADMIN_PASSWORD in .env to your current password.\n');
  process.exit(1);
}

// Signing in is not enough — the scripts need the admin role, not just an account.
const { data: roles } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', data.user.id);

const isAdmin = roles?.some((r) => r.role === 'admin');

console.log(`\n  Signed in as ${email}`);
console.log(`  Roles: ${roles?.map((r) => r.role).join(', ') || '(none)'}`);
console.log(isAdmin ? '  OK — admin access confirmed.\n' : '  WARNING — this account is NOT an admin.\n');
process.exit(isAdmin ? 0 : 1);
