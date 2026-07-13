/**
 * Splits bundled capsules into one lesson per notebook.
 *
 * "Six Projects" was eight resources behind a single "Mark as Complete" button: no
 * progress signal, no navigation, and a learner three notebooks deep looks identical
 * to one who has opened none. Each notebook is a distinct piece of work and should be
 * a distinct lesson.
 *
 * What is NOT split, and why: a Colab + its GitHub repo + its slide deck are one
 * project in three artifacts. Splitting those would be worse than leaving them — the
 * repo is not a lesson, it is part of the AEB lesson. Reference material stays with
 * the thing it supports.
 *
 * Progress is preserved. The parent capsule is kept and becomes the first lesson, so
 * its progress rows survive untouched, and anyone who had completed the bundle is
 * marked complete on every lesson split out of it — they did the work; the fact that
 * we have since reorganised it is not their problem.
 *
 *   node scripts/split-capsules.mjs          # preview
 *   node scripts/split-capsules.mjs --apply
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

/**
 * One entry per bundled capsule.
 *
 * `lessons` lists the lessons to end up with, in order. Each names the content items it
 * takes (matched on the item's title) — so a lesson can carry more than one artifact
 * where they genuinely belong together.
 *
 * The FIRST lesson reuses the existing capsule row, which is what keeps its progress.
 */
const SPLITS = [
  {
    capsule: 'Programming and Data Foundations Notebooks',
    lessons: [
      { title: 'Python Basics', items: ['Python Basics Tutorial'], description: 'The language, from zero.' },
      {
        title: 'Python — Procedural, Functional, OOP and State Machines',
        items: ['Python Tutorial – Procedural, Functional, OOP & State Machine Programming'],
        description: 'The four ways you will actually structure driving code.',
      },
      { title: 'Data Structures', items: ['Data Structures'], description: 'What to reach for, and when.' },
      {
        title: 'Algorithms — Searching, Sorting and Pathfinding',
        items: ['Algorithms – Searching, Sorting & Pathfinding'],
        description: 'The pathfinding here comes back later as global planning.',
      },
      { title: 'Data Analysis Basics', items: ['Data Analysis Basics'], description: 'pandas and NumPy — the work before every model.' },
      { title: 'SQL', items: ['SQL – Comprehensive Beginner Notebook'], description: 'How the data reaches you in the first place.' },
    ],
  },
  {
    capsule: 'Probability, Unsupervised Learning, and ML Algorithms Resources',
    lessons: [
      {
        title: 'Probability and Unsupervised Learning — Notes',
        items: ['Probability & Unsupervised Learning', 'MindMap'],
        description: 'The reference material, with a mind map of how it fits together.',
      },
      {
        title: 'ML Algorithms — Notebook',
        items: ['ML Algorithms'],
        description: 'The algorithms, runnable.',
      },
    ],
  },
  {
    capsule: 'DL & RL Notebooks — PyTorch, Traffic Signs, PPO in MetaDrive',
    lessons: [
      {
        title: 'PyTorch — From Foundations to Deployment',
        items: ['Deep Learning with PyTorch: From Foundations to Deployment'],
        description: 'The framework, taken all the way to a deployable model.',
      },
      {
        title: 'Traffic Sign Classification (GTSRB)',
        items: ['Traffic Sign Classification (GTSRB)'],
        description: 'A real CNN on a real benchmark.',
      },
      {
        title: 'RL — PPO Agent Driving in MetaDrive',
        items: [
          'RL Actor Critic PPO Policy/Agent for Motion Planning end to end in MetaDrive Simulator/Environment',
        ],
        description: 'An actor-critic agent that drives end to end. No hand-written planner.',
      },
      {
        title: 'DL and RL for Autonomous Driving — Reference',
        items: ['Deep Learning and Reinforcement Learning for Autonomous Driving'],
        description: 'Supporting material for the module.',
      },
    ],
  },
  {
    capsule: 'Vision Notebooks — KITTI, Lanes, Speed and Segmentation',
    lessons: [
      {
        title: 'Computer Vision — Master-Class',
        items: ['Master-Class on Computer Vision'],
        description: 'The long-form session.',
      },
      {
        title: 'KITTI — Tracking and Detection',
        items: [' KITTI Tracking Detection'],
        description: 'Detection and tracking on the benchmark the field is built on.',
      },
      {
        title: 'KITTI — Instance Segmentation',
        items: ['KITTI Instance Segmentation '],
        description: 'Per-object masks, not just boxes.',
      },
      { title: 'EgoLanes — Lane Estimation', items: ['EgoLanes'], description: 'Finding the lane you are in.' },
      { title: 'SceneSeg — Scene Segmentation', items: ['SceneSeg'], description: 'Segmenting the whole scene.' },
      { title: 'AutoSpeed — Speed from Vision', items: ['AutoSpeed'], description: 'Estimating speed from images alone.' },
    ],
  },
  {
    capsule: 'Six Projects — Fine-Tuning, Agents, VLMs and ControlNet',
    lessons: [
      {
        title: 'Project 1 — LLM Pretraining and Supervised Fine-Tuning',
        items: ['Project 1: LLM Pretraining and Supervised Fine Tuning on sample dataset'],
        description: 'How a language model is actually built.',
      },
      {
        title: 'Project 2 — Efficient Fine-Tuning with Unsloth',
        items: ['Project_2_Unsloth_Studio_fine_tuning'],
        description: 'Fine-tuning on hardware you actually have.',
      },
      {
        title: 'Project 3 — DataLab with LLM Intelligence',
        items: ['Project_3_DataLab with LLM Intelligence'],
        description: 'An LLM as an analysis tool, not a chatbot.',
      },
      {
        title: 'Project 4 — Agentic AI with LangChain',
        items: ['Project_4_Agentic_AI_with_langchain'],
        description: 'Models that call tools and take actions.',
      },
      {
        title: 'Project 5 — Vision-Language Model (Cosmos-Reason1 7B)',
        items: ['Project_5_VLM_cosmos_reason1_7B'],
        description: 'A VLM reasoning over a driving scene.',
      },
      {
        title: 'Project 6 — Controllable Generation with ControlNet',
        items: ['Project_6_ControlNet_ImageGen'],
        description: 'Generative vision you can steer.',
      },
      {
        title: 'Multimodal LLMs and Generative Vision — Reference',
        items: ['Multimodal Large Language Models & Generative Vision', 'Image'],
        description: 'Supporting material for the module.',
      },
    ],
  },
  // Deliberately NOT split: "AEB Project — Notebook, Code and Slides".
  // A Colab, its GitHub repo and its slide deck are one project in three artifacts.
  // The repo is not a lesson; it is part of the AEB lesson.
];

const { data: allCapsules } = await db
  .from('capsules')
  .select('id, title, description, learning_path_id, order_index');
const { data: allContent } = await db
  .from('capsule_content')
  .select('id, capsule_id, title, content_type, order_index');

console.log(APPLY ? '=== APPLYING ===\n' : '=== PREVIEW (pass --apply to write) ===\n');

for (const split of SPLITS) {
  const parent = allCapsules.find((c) => c.title === split.capsule);
  if (!parent) {
    console.log(`!! "${split.capsule}" not found — already split?\n`);
    continue;
  }

  const items = allContent.filter((i) => i.capsule_id === parent.id);
  const claimed = split.lessons.flatMap((l) => l.items);
  const unclaimed = items.filter((i) => !claimed.includes(i.title ?? ''));

  console.log(`${split.capsule}`);
  console.log(`  ${items.length} items -> ${split.lessons.length} lessons`);
  if (unclaimed.length) {
    console.log(`  !! ${unclaimed.length} item(s) unaccounted for — ABORTING this split:`);
    for (const u of unclaimed) console.log(`       "${u.title}"`);
    console.log();
    continue; // Never drop content on the floor.
  }
  for (const l of split.lessons) console.log(`    - ${l.title}`);
  console.log();

  if (!APPLY) continue;

  // Who had completed the bundle? They did the work; they keep the credit.
  const { data: done } = await db
    .from('progress')
    .select('user_id, is_completed')
    .eq('capsule_id', parent.id)
    .eq('is_completed', true);
  const completedBy = (done ?? []).map((p) => p.user_id);

  const base = parent.order_index;
  const siblings = allCapsules
    .filter((c) => c.learning_path_id === parent.learning_path_id && c.id !== parent.id)
    .sort((a, b) => a.order_index - b.order_index);

  const newCapsuleIds = [];

  for (let i = 0; i < split.lessons.length; i++) {
    const lesson = split.lessons[i];
    let capsuleId;

    if (i === 0) {
      // Reuse the parent row, so its progress records survive as they are.
      capsuleId = parent.id;
      const { error } = await db
        .from('capsules')
        .update({ title: lesson.title, description: lesson.description })
        .eq('id', parent.id);
      if (error) {
        console.log(`     FAILED updating parent: ${error.message}`);
        continue;
      }
    } else {
      const { data: created, error } = await db
        .from('capsules')
        .insert({
          learning_path_id: parent.learning_path_id,
          title: lesson.title,
          description: lesson.description,
          order_index: base + i,
        })
        .select('id')
        .single();
      if (error) {
        console.log(`     FAILED creating "${lesson.title}": ${error.message}`);
        continue;
      }
      capsuleId = created.id;

      // They completed the bundle, so they have completed what came out of it.
      if (completedBy.length) {
        await db.from('progress').insert(
          completedBy.map((user_id) => ({
            user_id,
            capsule_id: capsuleId,
            is_completed: true,
            watch_percentage: 100,
            completed_at: new Date().toISOString(),
          }))
        );
      }
    }

    newCapsuleIds.push(capsuleId);

    // Move this lesson's content items onto it.
    for (let j = 0; j < lesson.items.length; j++) {
      const item = items.find((x) => x.title === lesson.items[j]);
      if (!item) continue;
      await db
        .from('capsule_content')
        .update({ capsule_id: capsuleId, order_index: j })
        .eq('id', item.id);
    }
  }

  // Everything after the parent shifts down to make room for the new lessons.
  let index = base + split.lessons.length;
  for (const sib of siblings.filter((c) => c.order_index > base)) {
    await db.from('capsules').update({ order_index: index++ }).eq('id', sib.id);
  }

  console.log(`  applied: ${newCapsuleIds.length} lessons, progress carried for ${completedBy.length} learner(s)\n`);
}

console.log(APPLY ? 'Done.' : 'Nothing written. Re-run with --apply.');
