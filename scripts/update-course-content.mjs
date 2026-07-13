/**
 * Rewrites the course descriptions and curriculum in V2 with the real content.
 *
 * What was there: raw module dumps pasted into the description field
 * ("🔹 Module 0 — Foundations for Autonomous Systems\n\nGoal: Align..."), mangled
 * table text, and one course with no description at all. Cards rendered that
 * verbatim, so the marketing page was showing internal notes.
 *
 *   node scripts/update-course-content.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) {
  for (const l of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const db = createClient(process.env.V2_SUPABASE_URL, process.env.V2_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Matched on title, since the ids are stable but long.
const COURSES = [
  {
    match: 'Advanced Driver Assistance Systems',
    slug: 'adas',
    tagline: 'End-to-end ADAS and autonomous driving engineering',
    description:
      'How ADAS systems are actually built — from perception and machine learning ' +
      'through control and functional safety. Designed for engineers who want to move ' +
      'beyond theory and build feature-level ADAS systems using industry-style workflows.',
    curriculum: [
      'ADAS vs autonomy, SAE levels, and system architectures',
      'Traditional ML, Deep Learning, and Reinforcement Learning',
      'Perception systems, sensor fusion, and localization',
      'Motion prediction, planning, and control',
      'Functional safety (ISO 26262) and V-model development',
      'Project 1 — ML-based Automatic Emergency Braking (AEB)',
      'Project 2 — CNN-based traffic sign classification',
      'Project 3 — 4D perception',
      'Project 4 — RL-based vehicle control in simulation',
      'Project 5 — Rule-based planning and control pipelines',
      'Capstone — Full ADAS feature via Model-Based Design (Requirements → Architecture → Control → MIL/SIL validation in Simulink)',
    ],
  },
  {
    match: 'Advanced Vehicle Dynamics',
    slug: 'control',
    tagline: 'Modern vehicle control — PID → LQR → MPC',
    description:
      'Vehicle-dynamics–driven control design, which sits at the core of real ADAS ' +
      'features. Connects PID, LQR and MPC as one unified control framework rather ' +
      'than a set of disconnected techniques.',
    curriculum: [
      'Longitudinal vehicle dynamics, forces, and stability',
      'PID control design and tuning',
      'Project I — Adaptive Cruise Control (ACC)',
      'Lateral dynamics, bicycle model, yaw control, state estimation',
      'Project II — Electronic Stability Control (ESC)',
      'Project III — LQR',
      'Optimal control and constrained MPC',
      'Project IV — MPC-based trajectory tracking',
    ],
  },
  {
    match: 'Advanced Motion Planning',
    slug: 'planning',
    tagline: 'Motion prediction, planning and decision-making',
    description:
      'Practical planning and prediction systems, built through a structured sequence ' +
      'of projects — from classical search through to closed-loop learned planners.',
    curriculum: [
      'Traditional motion planning',
      'Global planning',
      'Behaviour planning with finite state machines',
      'Local planning with a lattice planner',
      'End-to-end motion planning with an RL PPO agent',
      'Closed-loop ML-based planners',
      'Motion prediction',
      'MPDM (Multi-Policy Decision Making)',
    ],
  },
  {
    match: 'AI Bootcamp',
    slug: 'ai',
    tagline: 'AI for autonomy — ML → LLMs → Generative AI',
    description:
      'For engineers who want to build real AI systems for autonomous driving rather ' +
      'than study isolated algorithms. Foundations, then system-level thinking, then ' +
      'deployable autonomy projects.',
    curriculum: [
      'Machine learning foundations',
      'Deep learning and reinforcement learning',
      'Computer vision and 3D perception',
      'Vision–language models and generative AI',
      'Multiple hands-on projects aligned with real industry roles',
    ],
  },
  {
    match: 'Perception lab',
    slug: 'perception',
    tagline: 'Perception playground — camera to 3D to generative vision',
    description:
      'A hands-on progression through the perception stack: how an image is formed, ' +
      'what is in it, where it is in 3D, how it moves, and how modern models reason ' +
      'about and generate it.',
    curriculum: [
      'Camera image formation — pinhole model, calibration, lens distortion, coordinate systems',
      'Semantic information — classification, detection, segmentation',
      'Geometric information — depth estimation, stereo vision, pose',
      'Motion estimation — optical flow, tracking, action recognition, velocity',
      '3D reconstruction — SfM, Multi-View Stereo, NeRF, Gaussian Splatting',
      'NLP and large language models — tokenization, transformers, BERT/GPT, RLHF, agents, LoRA',
      'Scene reasoning and VLMs — ViT, CLIP, LLaVA, Flamingo, visual grounding',
      'Generative vision — VAEs, GANs, diffusion, Stable Diffusion, ControlNet',
    ],
  },
];

const { data: existing } = await db.from('courses').select('id, title');

for (const c of COURSES) {
  const row = existing.find((r) => r.title.includes(c.match));
  if (!row) {
    console.log(`  !! no course matching "${c.match}"`);
    continue;
  }

  const { error } = await db
    .from('courses')
    .update({
      description: `${c.tagline}. ${c.description}`,
      curriculum_preview: c.curriculum.map((line) => `• ${line}`).join('\n'),
      // Cleared deliberately: the stock car photos were generic and off-brand, and
      // the app now renders a generated cover per course instead.
      thumbnail_url: null,
    })
    .eq('id', row.id);

  console.log(error ? `  ${row.title} — FAILED: ${error.message}` : `  ${row.title} — updated`);
}

console.log('\nCourse content rewritten.');
