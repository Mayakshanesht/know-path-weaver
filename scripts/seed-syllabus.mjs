/**
 * Writes the real syllabus for all five courses.
 *
 * Everything here comes from the course owner. Nothing is inferred: where a module
 * breakdown was not supplied (Vehicle Control, Motion Planning, Perception), the
 * course carries outcomes and projects but no fabricated module list. An invented
 * lecture on a paid course is worse than a missing one.
 *
 *   node scripts/seed-syllabus.mjs
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

const COURSES = [
  {
    match: 'Advanced Driver Assistance Systems',
    tagline: 'End-to-end ADAS and autonomous driving engineering',
    description:
      'How ADAS systems are actually built — from perception and machine learning through ' +
      'control and functional safety. For engineers who want to move beyond theory and build ' +
      'feature-level ADAS systems using industry-style workflows.',
    syllabus: {
      outcomes: [
        'ADAS vs autonomy, SAE levels, and system architectures',
        'Traditional ML, Deep Learning, and Reinforcement Learning',
        'Perception systems, sensor fusion, and localization',
        'Motion prediction, planning, and control',
        'Functional safety (ISO 26262) and V-model development',
      ],
      projects: [
        { name: 'ML-based Automatic Emergency Braking', blurb: 'AEB from data to decision.' },
        { name: 'CNN-based traffic sign classification', blurb: 'A perception model end to end.' },
        { name: '4D perception', blurb: 'Space and time together.' },
        { name: 'RL-based vehicle control', blurb: 'Learned control in simulation.' },
        { name: 'Rule-based planning and control', blurb: 'The classical pipeline.' },
        {
          name: 'Capstone — full ADAS feature via Model-Based Design',
          blurb: 'Requirements → Architecture → Control → MIL/SIL validation in Simulink.',
          capstone: true,
        },
      ],
    },
  },
  {
    match: 'Advanced Vehicle Dynamics',
    tagline: 'Modern vehicle control — PID → LQR → MPC',
    description:
      'Vehicle-dynamics–driven control design, which sits at the core of real ADAS features. ' +
      'Connects PID, LQR and MPC as one unified control framework rather than a set of ' +
      'disconnected techniques.',
    syllabus: {
      outcomes: [
        'Longitudinal vehicle dynamics, forces, and stability',
        'PID control design and tuning',
        'Lateral dynamics, the bicycle model, yaw control, state estimation',
        'Optimal control and constrained MPC',
      ],
      projects: [
        { name: 'Adaptive Cruise Control (ACC)', blurb: 'Longitudinal control, in anger.' },
        { name: 'Electronic Stability Control (ESC)', blurb: 'Lateral dynamics and yaw.' },
        { name: 'LQR', blurb: 'Optimal control, derived and tuned.' },
        { name: 'MPC-based trajectory tracking', blurb: 'Constrained optimisation in the loop.' },
      ],
    },
  },
  {
    match: 'Advanced Motion Planning',
    tagline: 'Motion prediction, planning and decision-making',
    description:
      'Practical planning and prediction systems, built through a structured sequence of ' +
      'projects — from classical search through to closed-loop learned planners.',
    syllabus: {
      outcomes: [
        'Traditional motion planning',
        'Global planning',
        'Behaviour planning with finite state machines',
        'Local planning with a lattice planner',
        'End-to-end motion planning with an RL PPO agent',
        'Closed-loop ML-based planners',
        'Motion prediction',
        'MPDM — Multi-Policy Decision Making',
      ],
      projects: [],
    },
  },
  {
    match: 'AI Bootcamp',
    tagline: 'AI for autonomy — ML → LLMs → Generative AI',
    description:
      'For engineers who want to build real AI systems for autonomous driving rather than ' +
      'study isolated algorithms. Foundations, then system-level thinking, then deployable ' +
      'autonomy projects.',
    syllabus: {
      outcomes: [
        'Machine learning foundations',
        'Deep learning and reinforcement learning',
        'Computer vision and 3D perception',
        'Vision–language models and generative AI',
      ],
      modules: [
        {
          title: 'Programming & Safety Foundations',
          goal: 'Get the tooling and the safety mindset in place.',
          lectures: [],
        },
        {
          title: 'Foundations of Machine Learning',
          goal: 'Build ML intuition.',
          lectures: [
            'ML problem types & the pipeline',
            'Probability for machine learning',
            'Unsupervised learning fundamentals',
            'ML algorithms overview, with notebooks',
          ],
        },
        {
          title: 'Supervised Machine Learning',
          goal: 'Practical ML skills.',
          lectures: [
            'Regression & classification',
            'Model evaluation & metrics',
            'Feature engineering',
            'Project — ML-based AEB system (MetaDrive)',
          ],
        },
        {
          title: 'Motion Prediction & Planning',
          goal: 'Connect ML to AV systems.',
          lectures: [
            'Motion prediction basics',
            'Planning integration',
            'Case study — prediction → planning pipeline',
          ],
        },
        {
          title: 'Deep Learning & Reinforcement Learning',
          goal: 'Modern AI methods.',
          lectures: [
            'Neural network fundamentals',
            'CNNs & sequence models',
            'Reinforcement learning basics',
            'RL for driving tasks',
          ],
        },
        {
          title: 'Computer Vision for Autonomous Systems',
          goal: 'The perception stack.',
          lectures: [
            'Image processing basics',
            'Object detection & segmentation',
            'Vision models in autonomous driving',
          ],
        },
        {
          title: 'Multimodal LLMs & Generative Vision',
          goal: 'Cutting-edge AI systems.',
          lectures: [
            'Transformers & tokenization',
            'Vision Transformers (ViT)',
            'Vision-language models (CLIP, VLMs)',
            'Diffusion models (DDPM, DDIM)',
            'ControlNet & flow matching',
            'Agentic AI systems & tool use',
          ],
        },
      ],
      projects: [
        { name: 'ML AEB system', blurb: 'Core ML.' },
        { name: 'Prediction models', blurb: 'Core ML.' },
        { name: 'Driving agent in simulator', blurb: 'Reinforcement learning.' },
        { name: 'Detection / segmentation', blurb: 'Vision.' },
        { name: 'Image generation pipelines', blurb: 'Generative AI.' },
        { name: 'Multimodal reasoning systems', blurb: 'Generative AI.' },
      ],
      projects_note: '17 projects in total, across core ML, RL, vision and generative AI.',
    },
  },
  {
    match: 'Perception lab',
    tagline: 'Perception playground — camera to 3D to generative vision',
    description:
      'A hands-on progression through the perception stack: how an image is formed, what is ' +
      'in it, where it sits in 3D, how it moves, and how modern models reason about and ' +
      'generate it.',
    syllabus: {
      outcomes: [],
      modules: [
        { title: 'Camera image formation', goal: 'Pinhole model, calibration, lens distortion, coordinate systems.', lectures: [] },
        { title: 'Semantic information', goal: "Classification, detection, segmentation — what's in the scene.", lectures: [] },
        { title: 'Geometric information', goal: 'Depth estimation, stereo vision, pose — recovering 3D structure.', lectures: [] },
        { title: 'Motion estimation', goal: 'Optical flow, tracking, action recognition, velocity.', lectures: [] },
        { title: '3D reconstruction', goal: 'SfM, Multi-View Stereo, NeRF, Gaussian Splatting.', lectures: [] },
        { title: 'NLP & large language models', goal: 'Tokenization, transformers, BERT/GPT, RLHF, agents, LoRA.', lectures: [] },
        { title: 'Scene reasoning & VLMs', goal: 'ViT, CLIP, LLaVA, Flamingo, visual grounding.', lectures: [] },
        { title: 'Generative vision', goal: 'VAEs, GANs, diffusion, Stable Diffusion, ControlNet.', lectures: [] },
      ],
      projects: [],
    },
  },
];

const { data: existing, error: fetchError } = await db.from('courses').select('id, title');
if (fetchError) {
  console.error(fetchError.message);
  process.exit(1);
}

for (const c of COURSES) {
  const row = existing.find((r) => r.title.includes(c.match));
  if (!row) {
    console.log(`  !! no course matching "${c.match}"`);
    continue;
  }

  const { error } = await db
    .from('courses')
    .update({
      tagline: c.tagline,
      description: c.description,
      syllabus: c.syllabus,
      // The stock car photos were generic and off-brand; the app now draws a cover
      // per course from its own design system instead.
      thumbnail_url: null,
    })
    .eq('id', row.id);

  const mods = c.syllabus.modules?.length ?? 0;
  const projs = c.syllabus.projects?.length ?? 0;
  console.log(
    error
      ? `  FAILED ${row.title}: ${error.message}`
      : `  ${row.title.slice(0, 46).padEnd(48)} ${mods} modules, ${projs} projects`
  );
}

console.log('\nSyllabus written.');
