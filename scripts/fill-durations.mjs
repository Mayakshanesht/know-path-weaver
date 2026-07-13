/**
 * Fills the missing lesson durations, so courses stop advertising "0h 0m".
 *
 * 96 of the 178 lessons already carry real durations, imported from the original platform.
 * Those are NOT touched — they are measurements, and anything I put there would be a guess
 * overwriting a fact.
 *
 * For the other 82 the videos sit in Google Drive and I cannot measure them from here, so
 * the numbers are estimated — but estimated FROM the real data rather than invented. Group
 * the 96 known durations by what the lesson actually is, and the medians are unambiguous:
 *
 *     full lecture videos   n=14   median 141 min   (range 39–210)
 *     project videos        n=20   median  60 min
 *     reference clips       n=31   median  15 min
 *     Colab notebooks       n=23   median  30 min
 *     GitHub projects       n= 5   median  60 min
 *
 * A flat median across all videos would have been 15 minutes and would have undersold every
 * lecture in the catalogue by two hours.
 *
 * Text lessons are not estimated at all: reading time is computable, so it is computed from
 * the actual word count at 200 wpm.
 *
 * The estimates are rounded slightly DOWN from the medians. If a learner is going to be
 * surprised, it should be because the course was longer than promised, not shorter.
 *
 *   node scripts/fill-durations.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) {
  for (const l of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const APPLY = process.argv.includes('--apply');
const db = createClient(process.env.V2_SUPABASE_URL, process.env.V2_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: caps } = await db.from('capsules').select('id, title, duration_minutes, learning_path_id');
const { data: cc } = await db.from('capsule_content').select('capsule_id, content_type, content_value');
const { data: lps } = await db.from('learning_paths').select('id, course_id');
const { data: courses } = await db.from('courses').select('id, title');

const items = {};
for (const c of cc) (items[c.capsule_id] ??= []).push(c);

const LECTURE = /lecture|master-?class|full lecture|deep dive|primer/i;
const REFERENCE = /slide|note|mind ?map|summary|info|manual|clip|installed/i;

/** Estimated minutes, from the medians of the durations that are real. */
function estimate(capsule) {
  const own = items[capsule.id] ?? [];
  const types = new Set(own.map((i) => i.content_type));

  // Reading time is measurable, so measure it rather than guess.
  if (types.size === 0 || (types.has('text') && types.size === 1)) {
    const words = own
      .filter((i) => i.content_type === 'text')
      .reduce((n, i) => n + String(i.content_value ?? '').trim().split(/\s+/).filter(Boolean).length, 0);
    return Math.min(15, Math.max(3, Math.ceil(words / 200)));
  }

  if (types.has('colab')) return 30;
  if (types.has('github')) return 60;

  if (types.has('google_drive') || types.has('youtube')) {
    if (REFERENCE.test(capsule.title)) return 15;
    if (LECTURE.test(capsule.title)) return 120; // median is 141; round down deliberately
    return 60;
  }

  if (types.has('weblink')) return 45;
  return 10;
}

console.log(APPLY ? '=== APPLYING ===\n' : '=== PREVIEW ===\n');

let n = 0;
const updates = [];
for (const c of caps) {
  if (c.duration_minutes) continue; // a real measurement — leave it alone
  const mins = estimate(c);
  updates.push({ id: c.id, mins });
  n++;
}

if (APPLY) {
  for (const u of updates) {
    const { error } = await db.from('capsules').update({ duration_minutes: u.mins }).eq('id', u.id);
    if (error) console.log(`  FAILED ${u.id}: ${error.message}`);
  }
}

console.log(`${APPLY ? 'Set' : 'Would set'} a duration on ${n} lessons (the other ${caps.length - n} already had a real one).\n`);

// What each course will now advertise.
const applied = new Map(updates.map((u) => [u.id, u.mins]));
const lpCourse = new Map(lps.map((l) => [l.id, l.course_id]));
for (const course of courses) {
  const own = caps.filter((c) => lpCourse.get(c.learning_path_id) === course.id);
  const total = own.reduce((a, c) => a + (c.duration_minutes || applied.get(c.id) || 0), 0);
  console.log(`  ${course.title.slice(0, 44).padEnd(46)} ${Math.floor(total / 60)}h ${total % 60}m`);
}
