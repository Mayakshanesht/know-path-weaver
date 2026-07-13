/**
 * Creates a DRAFT quiz for every teaching lesson, so they can be filled in from
 * Admin → Quizzes rather than created one at a time.
 *
 * Every quiz is created UNPUBLISHED and with zero questions. That is deliberate: an
 * empty quiz a learner can open is worse than no quiz, and a quiz whose questions were
 * invented — by me or by a model that has not seen the lecture — is worse still. A
 * wrong answer marked correct on a paid course destroys trust in everything else.
 *
 * What each draft DOES carry is a suggestion: a description saying what this lesson's
 * quiz should test, derived from what the lesson actually is. The admin writes the
 * questions; the draft tells them what to aim at.
 *
 * Skips Welcome, What next, and the module overviews — there is nothing to test in a
 * page of orientation.
 *
 *   node scripts/seed-capsule-quizzes.mjs          # preview
 *   node scripts/seed-capsule-quizzes.mjs --apply
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

const SKIP = /^what this module covers|^welcome$|^what next$/i;

/** What this lesson's quiz should aim at — the brief, not the questions. */
function brief(capsule, kinds) {
  const t = capsule.title;

  if (/^project|^capstone/i.test(t)) {
    return (
      'Test that they actually BUILT it, not that they watched it. Ask about a decision ' +
      'they had to make, a value they had to choose, or what breaks if they get it wrong. ' +
      'Avoid anything answerable from the lesson title.'
    );
  }
  if (/lecture slides?|— slides|notes|mind ?map/i.test(t)) {
    return 'Reference material — a quiz here is probably redundant. Consider deleting this draft.';
  }
  if (/alternate clip|summary video/i.test(t)) {
    return 'Duplicate of the main lecture. Quiz the lecture instead and delete this draft.';
  }
  if (/lecture|master-class/i.test(t)) {
    return (
      'Test comprehension of the lecture: the definitions, the trade-offs, and the one ' +
      'thing a learner most commonly gets wrong. 4–6 questions is usually enough.'
    );
  }
  if (kinds.has('colab')) {
    return (
      'Notebook lesson. Ask what a parameter does, what the output means, or what would ' +
      'change if a value were different — questions they can only answer having run it.'
    );
  }
  if (kinds.has('github')) {
    return 'Code lesson. Ask about the structure of the code and the choices it makes.';
  }
  return 'Write 3–5 questions on the core idea of this lesson.';
}

const { data: mods } = await db.from('learning_paths').select('id, course_id, title, order_index');
const { data: caps } = await db
  .from('capsules')
  .select('id, title, learning_path_id, order_index');
const { data: content } = await db.from('capsule_content').select('capsule_id, content_type');
const { data: existing } = await db.from('quizzes').select('capsule_id');

const modOf = new Map(mods.map((m) => [m.id, m]));
const hasQuiz = new Set(existing.map((q) => q.capsule_id).filter(Boolean));

const targets = caps
  .filter((c) => !SKIP.test(c.title.trim()))
  .filter((c) => !hasQuiz.has(c.id))
  .filter((c) => modOf.has(c.learning_path_id));

console.log(APPLY ? '=== APPLYING ===\n' : '=== PREVIEW (pass --apply) ===\n');
console.log(`teaching lessons without a quiz: ${targets.length}\n`);

const suggestDelete = [];
let created = 0;

for (const cap of targets) {
  const mod = modOf.get(cap.learning_path_id);
  const kinds = new Set(
    content.filter((i) => i.capsule_id === cap.id).map((i) => i.content_type)
  );

  const description = brief(cap, kinds);
  if (/delete this draft/.test(description)) suggestDelete.push(`${mod.title.slice(0, 26)} / ${cap.title}`);

  if (APPLY) {
    const { error } = await db.from('quizzes').insert({
      course_id: mod.course_id,
      capsule_id: cap.id,
      title: `${cap.title} — Check yourself`,
      description,
      quiz_type: 'quiz',
      is_graded: false,
      passing_score: 70,
      max_attempts: 3,
      order_index: cap.order_index,
      // Never visible to a learner until it has questions and an admin says so.
      is_published: false,
    });
    if (error) {
      console.log(`  FAILED ${cap.title}: ${error.message}`);
      continue;
    }
  }
  created++;
}

console.log(`${APPLY ? 'Created' : 'Would create'} ${created} draft quizzes (all unpublished, 0 questions).`);

if (suggestDelete.length) {
  console.log(
    `\n${suggestDelete.length} of them are on reference material or duplicate clips, where a quiz` +
      ` is probably pointless. They are flagged in the description as "consider deleting":`
  );
  for (const s of suggestDelete.slice(0, 10)) console.log(`   ${s}`);
  if (suggestDelete.length > 10) console.log(`   ... and ${suggestDelete.length - 10} more`);
}

console.log(
  APPLY
    ? '\nDone. Admin > Quizzes to write the questions. Nothing is visible to learners until you publish it.'
    : '\nNothing written. Re-run with --apply.'
);
