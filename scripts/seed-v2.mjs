/**
 * Seeds V2 with the course content exported from V1.
 *
 * UUIDs are preserved exactly. That is the whole point: a migrating user's
 * enrollment.course_id and progress.capsule_id keep pointing at the right rows,
 * so nothing has to be remapped when they move over.
 *
 * Only content is seeded here. Per-user rows (profiles, enrollments, progress)
 * are copied one user at a time, when that user logs in and migrates — they
 * reference auth.users ids that do not exist in V2 until then.
 *
 *   node scripts/seed-v2.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const url = process.env.V2_SUPABASE_URL;
const key = process.env.V2_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('V2_SUPABASE_URL / V2_SUPABASE_SERVICE_ROLE_KEY missing from .env');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const load = (name) => JSON.parse(readFileSync(`backup/${name}.json`, 'utf8'));

// Parents first — every child has an FK to something above it.
const PLAN = [
  // created_by points at an auth.users row that does not exist in V2 (the old admin
  // account cannot be recreated), so drop it rather than break the foreign key.
  { table: 'courses', rows: load('courses').map(({ created_by, ...rest }) => rest) },
  { table: 'learning_paths', rows: load('learning_paths') },
  { table: 'capsules', rows: load('capsules') },
  { table: 'capsule_content', rows: load('capsule_content') },
  { table: 'capsule_prerequisites', rows: load('capsule_prerequisites') },
  { table: 'quizzes', rows: load('quizzes') },
  { table: 'quiz_questions', rows: load('quiz_questions') },
];

let failed = false;

for (const { table, rows } of PLAN) {
  if (rows.length === 0) {
    console.log(`  ${table.padEnd(24)} 0 rows — skipped`);
    continue;
  }

  // upsert on id, so re-running repairs rather than duplicates.
  const { error } = await db.from(table).upsert(rows, { onConflict: 'id' });

  if (error) {
    console.log(`  ${table.padEnd(24)} FAILED — ${error.message}`);
    failed = true;
    break;
  }

  const { count } = await db.from(table).select('*', { count: 'exact', head: true });
  console.log(`  ${table.padEnd(24)} ${String(rows.length).padStart(4)} seeded → ${count} in V2`);
}

if (failed) process.exit(1);

console.log('\nContent seeded. UUIDs preserved, so migrated enrollments will resolve.');
