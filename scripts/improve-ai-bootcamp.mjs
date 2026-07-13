/**
 * Rewrites the AI Bootcamp's lesson titles and adds a module overview to each module.
 *
 * Written by hand rather than generated, because the evidence is unambiguous and a
 * human reading it does a better job than a 20B model guessing at it. Every rename
 * below is taken from the title of the file actually inside that lesson — "Video 3"
 * holds a Drive file called "Support Vector Machines", so that is what it is called.
 *
 * Where the evidence is thin the title says only what is defensible: a lesson whose
 * single file is named "Lecture" becomes "<Module> — Lecture", never an invented topic.
 * Those are flagged INFERRED in the output so they can be checked.
 *
 *   node scripts/improve-ai-bootcamp.mjs          # preview
 *   node scripts/improve-ai-bootcamp.mjs --apply  # write
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

// --- Renames, keyed by capsule id -------------------------------------------
const CAPSULES = {
  // Module 2 — Supervised ML. Each of these holds one Drive file, already named.
  '790099ab-d4fe-40c9-be88-22588ccd004c': {
    title: 'Cracking the AI Black Box',
    description: 'What a model is actually doing when it "learns".',
  },
  'abf66f3d-0e80-40b5-a1bd-9fa64053480d': {
    title: 'Three Ways to Predict a Number',
    description: 'Regression, from the ground up.',
  },
  'b4e0a008-5ee5-43c8-92d8-db45860a021c': {
    title: 'One Expert to a Dream Team',
    description: 'Why ensembles beat any single model.',
  },
  'b644fee9-8264-44c6-bec8-f0a127e14b60': {
    title: 'Support Vector Machines',
    description: 'Margins, kernels, and where SVMs still win.',
  },
  '3ecebff9-89fb-4799-a437-69b87d4b66a5': {
    title: 'Logistic Regression',
    description: 'The classifier everything else is measured against.',
  },
  '15f2a1a0-b6df-455c-8453-e36a740150fe': {
    title: 'Linear Discriminant Analysis',
    description: 'Classification through the lens of class separation.',
  },
  'b837abf0-37cd-4889-80da-589d4127361a': {
    title: 'Supervised ML — Full Lecture',
    description: 'The complete session, end to end.',
    inferred: 'the file is titled only "Lecture"; named from its module',
  },
  '0730b9ad-1532-4fd0-ad19-f8fc055c7df1': {
    title: 'AEB Project — Notebook, Code and Slides',
    description: 'The MetaDrive AEB notebook, the project repo, and the reference deck.',
  },

  // Module 3 — Motion Prediction and Planning
  'f63c3f01-7427-4fc2-9af0-7516e6ae78cc': {
    title: 'Motion Prediction and Planning — Lecture',
    description: 'How prediction feeds the planner.',
    inferred: 'the file is titled only "Lecture"; named from its module',
  },
  '743d05c6-0941-47cf-baa2-c2d7f412b448': {
    title: 'Prediction and Planning — Slides',
    description: 'Reference deck for the module.',
    inferred: 'the file is titled only "PPT"; named from its module',
  },

  // Module 4 — Deep Learning and Reinforcement Learning
  '31f5608e-4f22-420c-961e-ef835417ad96': {
    title: 'Deep Learning and Reinforcement Learning — Lecture',
    description: 'Neural networks, then policies that learn to drive.',
  },
  '19f23706-06d5-442b-a247-68bca19519ac': {
    title: 'DL & RL Notebooks — PyTorch, Traffic Signs, PPO in MetaDrive',
    description:
      'PyTorch from foundations to deployment; GTSRB traffic-sign classification; a PPO ' +
      'actor-critic agent driving end to end in MetaDrive.',
  },

  // Module 5 — Computer Vision
  '55f570d1-e13e-4bbd-80b0-c2ad952d6271': {
    title: 'Computer Vision — Lecture',
    description: 'The perception stack, from pixels to objects.',
  },
  'e68c7f09-50c8-4871-83c3-778cd5066075': {
    title: 'Vision Notebooks — KITTI, Lanes, Speed and Segmentation',
    description:
      'KITTI tracking and instance segmentation, EgoLanes, AutoSpeed and SceneSeg, plus ' +
      'the computer-vision master-class.',
  },

  // Module 6 — Multimodal LLMs and Generative Vision
  '590683fa-ce26-40b3-b713-e6b259007b91': {
    title: 'Multimodal LLMs and Generative Vision — Lecture',
    description: 'Transformers, VLMs and diffusion, and where they meet autonomy.',
  },
  '0b175b61-f9e3-45fd-90a0-fbf4695594b1': {
    title: 'Six Projects — Fine-Tuning, Agents, VLMs and ControlNet',
    description:
      'LLM pretraining and SFT; Unsloth fine-tuning; DataLab; an agentic system with ' +
      'LangChain; the Cosmos-Reason1 7B VLM; and ControlNet image generation.',
  },
};

// --- Module renames ----------------------------------------------------------
const MODULES = {
  'b9c0ca81-d8b1-4f59-8cd8-48a71a6a6656': {
    title: 'Multimodal LLMs and Generative Vision',
    description: 'Transformers, vision-language models, diffusion, and agentic systems.',
  },
  'c9af247f-52c4-405a-a515-ec585217b2dc': {
    title: 'Supervised Machine Learning',
    description: 'Regression, classification, ensembles — and your first AV project.',
  },
  '6114a8dd-8dd1-4bf2-8085-d63ded25bdc8': {
    title: 'Deep Learning and Reinforcement Learning',
    description: 'Neural networks, then agents that learn to drive.',
  },
  '012a1cb3-599f-4ec1-af32-c187f7d67517': {
    title: 'Computer Vision for Autonomous Systems',
    description: 'Detection, segmentation and tracking on real driving data.',
  },
};

// --- Module overviews: a "start here" lesson at the top of each module --------
const OVERVIEWS = [
  {
    module_id: '35c3a52f-aa58-4901-9742-699055a52034',
    title: 'What this module covers',
    body: `## Start here

Before any of the machine learning, you need to be able to *write* it. This module is the floor everything else stands on — and if you already have it, move fast and skip ahead.

Six notebooks, all runnable in Colab:

- **Python Basics** and **Python: Procedural, Functional, OOP & State Machines** — the language, and the four ways you will actually use it
- **Data Structures** and **Algorithms — Searching, Sorting & Pathfinding** — the search and graph algorithms that come back later as *planners*
- **Data Analysis Basics** — the pandas/NumPy work you will do before every model you ever train
- **SQL** — how the data gets to you in the first place

**Why it matters:** the pathfinding you write here is the same idea as global planning. The data wrangling here is what Module 2 assumes you can already do. This is not a warm-up; it is the toolbox.

**Next:** Module 1 turns that toolbox on the question of how a machine learns at all.`,
  },
  {
    module_id: '497c1e08-9802-4c86-a491-881e5a5957bd',
    title: 'What this module covers',
    body: `## Start here

You can write code. Now: what does it mean for a machine to *learn* something?

This module builds the intuition and the mathematics you need before any of the algorithms make sense.

- **How Machines Learn** — the shape of the problem: data, a model, a loss, and an optimiser
- **Foundations of ML: Probability and Unsupervised Learning** — the probability that underpins every model you will train, and what you can do without labels at all
- **Probability, Unsupervised Learning and ML Algorithms** — the reference material, a mind map of how it fits together, and a runnable notebook of the algorithms themselves

**Why it matters:** almost every failure in an ML system is a failure of the assumptions underneath it, not the code. Getting probability straight now is what lets you debug a model later instead of re-rolling it.

**Next:** Module 2 puts this to work on labelled data — and ends with your first autonomous-driving project.`,
  },
  {
    module_id: 'c9af247f-52c4-405a-a515-ec585217b2dc',
    title: 'What this module covers',
    body: `## Start here

This is where the theory becomes something you can ship. You have labelled data; you want a model that generalises.

The lecture sequence works up from intuition to the algorithms:

- **Cracking the AI Black Box** — what the model is really doing
- **Three Ways to Predict a Number** — regression
- **One Expert to a Dream Team** — why ensembles beat any single model
- **Support Vector Machines**, **Logistic Regression**, **Linear Discriminant Analysis** — the classical classifiers, and when each is the right tool

Then you build something:

- **Machine Learning Based AEB** — an Automatic Emergency Braking system, trained and run in the **MetaDrive** simulator, with the notebook and project repo alongside it

**Why it matters:** AEB is the "hello world" of ADAS, and it is a genuine one — a model whose false negatives are a collision and whose false positives are a rear-ending. It is the first time the metric you optimise has a physical consequence.

**Next:** Module 3 asks what happens *after* you have perceived the world — how you predict where everything is going, and plan through it.`,
  },
  {
    module_id: '0deb95cf-ece4-4a0d-a211-209bbae13776',
    title: 'What this module covers',
    body: `## Start here

Perception tells you what is around the car. It does not tell you what to *do*. This module is the bridge.

- **Motion Prediction and Planning — Lecture** — how prediction feeds the planner, and why the two cannot be designed apart
- **Slides** — the reference deck for the module

**Why it matters:** a planner that assumes other road users are static is useless, and a predictor that nothing consumes is a research demo. The interface between them is where most of the real engineering lives — and it is the part that interviews probe hardest.

**Next:** Module 4 replaces the hand-written parts of this pipeline with learned ones — including a reinforcement-learning agent that drives end to end.`,
  },
  {
    module_id: '6114a8dd-8dd1-4bf2-8085-d63ded25bdc8',
    title: 'What this module covers',
    body: `## Start here

Classical ML got you a working AEB. Deep learning is what happens when the features are too complicated to write down by hand — which, for driving, they always are.

- **Deep Learning and Reinforcement Learning — Lecture** — neural networks, then policies that learn by acting
- **PyTorch: From Foundations to Deployment** — the framework, taken all the way to a deployable model
- **Traffic Sign Classification (GTSRB)** — a real CNN on a real benchmark
- **RL Actor-Critic PPO in MetaDrive** — a PPO agent that drives end to end, no hand-written planner anywhere

**Why it matters:** the PPO notebook is the first time you build something with *no explicit rules at all* — the policy is learned from reward. Sitting it directly beside the rule-based pipeline from Module 3 is the point: you should come away able to argue for either.

**Next:** Module 5 goes back to the sensor and asks what the network actually sees.`,
  },
  {
    module_id: '012a1cb3-599f-4ec1-af32-c187f7d67517',
    title: 'What this module covers',
    body: `## Start here

Every module so far has assumed the car knows what is around it. This one earns that assumption.

- **Computer Vision — Lecture** and the **Master-Class** — the perception stack from pixels upward
- **KITTI Tracking Detection** and **KITTI Instance Segmentation** — detection and segmentation on the benchmark the field is built on
- **EgoLanes** — lane estimation
- **SceneSeg** — full scene segmentation
- **AutoSpeed** — speed estimation from vision alone

**Why it matters:** these are all real driving datasets, not toy ones. The gap between a model that works on curated images and one that works on KITTI is exactly the gap between a paper and a product — and this is where you close it.

**Next:** Module 6 is the frontier — models that read, reason and generate, not just classify.`,
  },
  {
    module_id: 'b9c0ca81-d8b1-4f59-8cd8-48a71a6a6656',
    title: 'What this module covers',
    body: `## Start here

The last module is the current frontier: models that do not merely label a scene but *reason* about it, and generate.

Six projects, each a runnable notebook:

1. **LLM Pretraining and Supervised Fine-Tuning** — how a language model is actually built
2. **Unsloth fine-tuning** — doing it efficiently, on hardware you have
3. **DataLab with LLM Intelligence** — an LLM as an analysis tool, not a chatbot
4. **Agentic AI with LangChain** — models that call tools and take actions
5. **Cosmos-Reason1 7B (VLM)** — a vision-language model reasoning over a scene
6. **ControlNet image generation** — controllable generative vision

**Why it matters:** vision-language models are moving quickly into autonomy — for scene understanding, for corner-case mining, for explaining what a stack did and why. This module is what lets you evaluate that claim for yourself rather than take a vendor's word for it.

**You have finished.** From Python, through classical ML and a working AEB, to a PPO agent, a real perception stack, and generative multimodal models. Go and build something.`,
  },
];

// ---------------------------------------------------------------------------

const { data: existingCapsules } = await db
  .from('capsules')
  .select('id, title, learning_path_id, order_index');

const byId = new Map(existingCapsules.map((c) => [c.id, c]));

console.log(APPLY ? '=== APPLYING ===\n' : '=== PREVIEW (pass --apply to write) ===\n');

console.log('MODULE RENAMES');
for (const [id, m] of Object.entries(MODULES)) {
  console.log(`  -> ${m.title}`);
  if (APPLY) {
    const { error } = await db
      .from('learning_paths')
      .update({ title: m.title, description: m.description })
      .eq('id', id);
    if (error) console.log(`     FAILED: ${error.message}`);
  }
}

console.log('\nLESSON RENAMES');
for (const [id, c] of Object.entries(CAPSULES)) {
  const current = byId.get(id);
  if (!current) {
    console.log(`  !! capsule ${id} no longer exists — skipped`);
    continue;
  }
  const flag = c.inferred ? `  [INFERRED: ${c.inferred}]` : '';
  console.log(`  "${current.title}"  ->  "${c.title}"${flag}`);
  if (APPLY) {
    const { error } = await db
      .from('capsules')
      .update({ title: c.title, description: c.description })
      .eq('id', id);
    if (error) console.log(`     FAILED: ${error.message}`);
  }
}

console.log('\nMODULE OVERVIEWS (new lesson, placed first)');
for (const o of OVERVIEWS) {
  // Never add a second overview to a module that already has one.
  const siblings = existingCapsules.filter((c) => c.learning_path_id === o.module_id);
  if (siblings.some((c) => /^what this module covers|^start here|^overview/i.test(c.title))) {
    console.log(`  module ${o.module_id.slice(0, 8)} already has an overview — skipped`);
    continue;
  }

  console.log(`  + "${o.title}"  (${o.body.split(/\s+/).length} words)`);
  if (!APPLY) continue;

  const { data: capsule, error: capsuleError } = await db
    .from('capsules')
    .insert({
      learning_path_id: o.module_id,
      title: o.title,
      description: 'Start here.',
      order_index: 0,
    })
    .select('id')
    .single();

  if (capsuleError) {
    console.log(`     FAILED: ${capsuleError.message}`);
    continue;
  }

  const { error: contentError } = await db.from('capsule_content').insert({
    capsule_id: capsule.id,
    content_type: 'text',
    title: o.title,
    content_value: o.body,
    order_index: 0,
  });

  if (contentError) {
    console.log(`     content FAILED: ${contentError.message}`);
    continue;
  }

  // An overview after the lessons it describes is pointless: shift everything down.
  const ordered = [capsule.id, ...siblings.sort((a, b) => a.order_index - b.order_index).map((c) => c.id)];
  const { error: orderError } = await db.rpc('reorder_entities', {
    p_entity: 'capsules',
    p_ids: ordered,
  });
  if (orderError) console.log(`     reorder FAILED: ${orderError.message}`);
}

console.log(
  APPLY
    ? '\nDone. Overviews lead each module; renames are live.'
    : '\nNothing written. Re-run with --apply.'
);
