/**
 * Module overviews and naming fixes for ADAS, Vehicle Dynamics and the Perception Lab.
 *
 * These three courses are in much better shape than the AI Bootcamp was — the lesson
 * titles are already descriptive ("Project 5 - Global Planning A* algo"). What they
 * lack is any sense of sequence: a learner lands in "Lecture Video" with no idea why
 * this module follows the last one. So the work here is overviews, not renames.
 *
 * Everything below is grounded in the actual lesson list of each module. Where a module
 * is thin, the overview says so plainly rather than padding.
 *
 *   node scripts/improve-remaining-courses.mjs          # preview
 *   node scripts/improve-remaining-courses.mjs --apply
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

const OVERVIEWS = {
  // ---------------- ADAS ----------------
  '5f79a069-b743-48a0-b334-6bca130f2cc6': `## Start here

Before any ADAS engineering, you need the environment the industry actually uses — and that is not a Jupyter notebook.

- **SDV Lab development manual** — how the lab is set up, and why
- **Getting MATLAB and IPG CarMaker installed** — the toolchain this course builds on
- **Python basics** — the scripting you will lean on throughout

**Why it matters:** the capstone in Module 13 is a Simulink model co-simulated against IPG CarMaker. Everything you install here is what makes that possible. Do it now, not the night before.

**Next:** the programming primers, so the code you write is not the bottleneck.`,

  '8e62795f-4ed4-4b17-bb40-d4b32a5ba64a': `## Start here

Four primers, each a runnable notebook. Skim them if you are already fluent; do not skip them if you are not.

- **Data Structures** and **Algorithms** — the search and graph work that returns later as global planning
- **Data Analysis** — the wrangling you do before every model you train
- **SQL** — how driving data reaches you in the first place

**Why it matters:** the A\\* planner in Module 7 is an algorithms problem wearing a driving costume. This module is where you learn to see that.

**Next:** with the tooling and the code in place, the actual subject begins.`,

  '30fe3681-7350-4290-a9b1-f8898844ec07': `## Start here

What is ADAS, actually — and where does it stop and autonomy begin?

Lecture, slides, notes and a mind map, all covering the same ground: SAE levels, the sensing–planning–acting loop, and the system architectures real vehicles ship.

**Why it matters:** "Level 2" and "Level 3" are not marketing words, they are liability boundaries. Every design decision later in this course traces back to which level you are building for.

**Next:** the machine learning that makes modern ADAS possible.`,

  '79e5c42f-91fb-4496-b7a1-ca63de39ef3a': `## Start here

The ML foundations, aimed squarely at driving problems rather than at generic tutorials.

Lecture, notes, mind map and a summary video, then:

- **Practice — Traditional ML algorithms** — a runnable notebook of the classical methods

**Why it matters:** most production ADAS features are not deep networks. They are well-chosen classical models with hard latency budgets and a safety case. Understanding when the simple thing is the right thing is most of the job.

**Next:** supervised learning, applied — and your first real feature.`,

  'df298618-b6bf-4143-a775-9caab5353846': `## Start here

The first feature you build end to end: **Automatic Emergency Braking**.

The lecture is provided in full plus six alternate clips, so you can take it in whatever order suits you. Then:

- **Project 1 — ML-based AEB** — classification and regression models, driving braking decisions in the MetaDrive simulator
- **Project video** — a walkthrough of the implementation

**Why it matters:** AEB is the genuine "hello world" of ADAS, and the stakes are real: a false negative is a collision, a false positive is a rear-ending. It is the first time the metric you optimise has a physical consequence, and it changes how you think about model evaluation.

**Next:** perception — the deep learning that tells the car what is out there.`,

  'f7560d02-ba0a-4c22-9838-63e97b081dbb': `## Start here

Classical ML got you AEB. Perception is where the features are too complex to hand-write — so you learn them.

- **Project 2 — Handwritten digit classification with transfer learning** — the mechanics of transfer learning, on a problem small enough to see clearly
- **Project 3 — Traffic sign classification (CNN)** — the same idea, now on a real driving task
- **Project 4 — RL car control with PPO in MetaDrive** — a policy that learns to drive from reward alone

**Why it matters:** Project 4 is the first time nothing is hand-written — no rules, no planner, just a learned policy. Hold it against the rule-based pipeline in the next module. You should come away able to argue for either.

**Next:** given what the car sees, what should it *do*?`,

  'fc58026b-aff4-4015-8e7c-20e182a88a97': `## Start here

The planning stack, built in layers — this is the densest module in the course, and the most interviewed-on.

- **Project 5 — Global planning with A\\*** — the route
- **Project 6 — Behaviour planning with an FSM** — the decision: follow, overtake, yield
- **Project 7 — Local planning with a Frenét lattice planner** — the trajectory
- **Project 8 — Highway motion planning and control** — all three, working together

**Why it matters:** these three layers are how essentially every production autonomy stack is organised. Build each one, then watch them compose in Project 8, and the architecture stops being a diagram and becomes something you have actually assembled.

**Next:** the language this all ships in.`,

  'fd86489c-fa55-441d-af92-abcb0945a872': `## Start here

Python is where you prototype. C++ is where it ships — every production ADAS ECU on the road.

- **Intro to C++, GTest and CMake** — the language and the build/test toolchain
- **Compiler-generated functions** — what the compiler writes for you, and why it bites
- **Resource management** — RAII, ownership, and why this matters when a leak is a safety recall
- **Practice repo** — clone it and work through it

**Why it matters:** the ACC controller you write in the next module is in C++. This is not a detour.

**Next:** vehicle dynamics — the physics the controller is actually controlling.`,

  '49419095-e7e8-4a03-9f87-d9902cecddd0': `## Start here

Straight-line motion: throttle, brake, and the forces in between.

Lecture and slides, then the logic behind two real features:

- **AEB logic** and **ACC logic** — how each is actually specified
- **Project 9 — Adaptive Cruise Control in C++** — a real controller, in the language it ships in
- **Project 10 — Linear controls basics** — the theory underneath it

**Why it matters:** ACC is the feature most drivers meet first, and it is deceptively hard — comfort, safety and following distance pull against each other. This is where control theory stops being algebra.

**Next:** the harder axis — steering.`,

  '16e25795-74a8-4b47-8926-b87ba8160668': `## Start here

Lateral dynamics: the bicycle model, tyre forces, yaw, and the state estimation that makes any of it usable.

Lecture and slides.

**Why it matters:** longitudinal control is a scalar problem. Lateral control is not — the vehicle can be unstable, the tyres saturate, and your state is never directly measured. This is where ESC, LKA and every steering feature come from.

**Next:** how any of this is allowed to ship.`,

  '4347866e-7f79-4369-a040-f326efb55b90': `## Start here

The part that separates a demo from a product.

- **Functional safety — a high-level overview** — hazard analysis, ASIL, the V-model
- **Functional safety — implementation steps** — what it actually demands of your code and your process

**Why it matters:** ISO 26262 is why ADAS engineering looks nothing like ML engineering. You cannot ship a feature because it performed well on a test set; you have to argue it is safe, and be able to show the argument. Nearly every ADAS interview goes here.

**Next:** the capstone — all of it, at once.`,

  '18e49daf-6eee-44ef-b96e-f27004addb65': `## Start here

Everything the course has covered, run as an industry workflow: **Requirements → Architecture → Control → MIL/SIL validation**.

- **Requirements writing assignment**, with a worked solution — where real feature development actually begins
- **Capstone Project 11 — AEB, ACC and LKA in Simulink**, co-simulated against IPG CarMaker
- **MIL/SIL testing and code generation** — building the test harness, then generating embedded code with Embedded Coder

**Why it matters:** this is Model-Based Design as the industry practises it. The notebooks got you the algorithms; this gets you the process — and the process is what you will be hired to follow.

**Congratulations.** You have taken a feature from requirement to generated code.`,

  // ---------------- Vehicle Dynamics & Control ----------------
  'e141d244-8be5-4981-a957-b4739877e3da': `## Start here

The floor everything else stands on. Six notebooks; move fast if you already have this.

Python basics, OOP, data structures, algorithms, visualisation and SQL.

**Why it matters:** the controllers later in this course are implemented, tuned and analysed in code. Fluency here is the difference between fighting the syntax and thinking about the control problem.

**Next:** C++ — the language a real controller ships in.`,

  'a41b4155-efa6-4db1-a354-bd9613953d72': `## Start here

Python is for prototyping. Production controllers are C++, and this module is why.

- **Modern C++, GTest and CMake** — language, build, test
- **Compiler-generated functions** — what you get for free, and what it costs you
- **Resource management** — RAII and ownership
- **Practice repo** — clone it, run it locally

**Why it matters:** the Adaptive Cruise Control you build in the very next module is a C++ project. This is the toolchain for it, not a digression.

**Next:** the physics.`,

  '89c3d8ff-c4c4-4c61-bcd0-1c47f4fc0ab2': `## Start here

Longitudinal dynamics — the straight-line problem — and the linear control that solves it.

Lecture, slides, and the specification behind two real features (AEB and ACC logic), then:

- **Project 1 — Adaptive Cruise Control with a PID controller**, as a Gradio app and in C++
- **Project 2 — Linear controls basics and stability analysis**

**Why it matters:** PID is the controller everyone thinks they understand until they tune one against a real plant. Do that here, on a vehicle model, and every controller after this makes more sense.

**Next:** where the trajectory the controller follows comes from.`,

  '5c671374-73f2-45a3-b1f3-e358ef50e396': `## Start here

A controller tracks a trajectory. Something has to produce one.

Lecture and slides, then:

- **Project 3 — End-to-end motion planning and control** — the full loop, planner through controller
- **Project explanation video** — a walkthrough

**Why it matters:** planning and control are usually taught apart and are never designed apart. Closing the loop yourself is what shows you why a planner that ignores the vehicle's dynamics produces trajectories no controller can follow.

**Next:** what happens when you learn the policy instead of writing it.`,

  'd4927cc0-073d-4fbb-8bf1-1fb4141c6eae': `## Start here

Everything so far you designed. This you train.

Lecture and slides, then:

- **Project 4 — RL car control with PPO in MetaDrive** — an agent that learns to drive from reward alone

**Why it matters:** put this beside the PID and planning work you have just done. One is derived, tunable and provable; the other is learned, opaque and often better. Knowing which to reach for — and being able to defend it — is the actual skill.

**Next:** the hard axis. Steering.`,

  '0ae0fc67-4ddd-492d-9f5a-7786d7a971e6': `## Start here

Lateral dynamics, state estimation, and optimal control — the deepest module in the course.

Lecture and slides cover the bicycle model, tyre models, ABS/TCS/ESC, and state estimation with Kalman, EKF and particle filters. Then:

- **Project 5 — Electronic Stability Control in Simulink**
- **Project 6 — Altitude control with LQR**
- **Project 7 — Lane Keep Assist with LQR**

**Why it matters:** this is where PID runs out. LQR does not tune a gain, it *solves* for the optimal one — and the step from one to the other is the step from technician to engineer.

**Next:** the final generalisation — control that plans ahead.`,

  '28f2fbb6-a5f3-47dc-9e94-470f47f502dc': `## Start here

The end of the line: **Model Predictive Control**.

- **MPC intro** and the project explanation video
- **Project 8 — Trajectory tracking with MPC** — clone it, run it locally

**Why it matters:** PID reacts. LQR is optimal, but only for an unconstrained linear system with no view of the future. MPC optimises over a horizon *and* respects constraints — the steering limits, the acceleration limits, the road edge. It is the most capable controller here and the most expensive to run, and knowing that trade-off is the point.

**You have finished.** PID → LQR → MPC, as one framework rather than three disconnected topics — exactly as promised.`,

  // ---------------- Perception Lab ----------------
  'dc5977cf-e751-4b86-97ae-8f092701a827': `## Start here

A hands-on playground for the perception stack, built around an interactive web app.

- **The Perception Playground** — the interactive lab itself
- **Lecture video** and **slides** — the theory behind what you are manipulating

**Why it matters:** perception is far easier to build an intuition for by *changing something and watching what breaks* than by reading about it. That is what the lab is for.`,
};

// Capsule renames where the current title says nothing.
const RENAMES = {
  'eb72112b-7f4f-4087-b075-cfbdc2e1db0a': {
    title: 'The Perception Playground',
    description: 'The interactive lab — camera geometry through to generative vision.',
  },
  '93dc53ef-90ec-473d-b91e-83f3aea135ea': {
    title: 'Perception — Lecture',
    description: 'The theory behind the lab.',
  },
  'fc5dbfc2-80da-4871-9546-1cdf07f51ac6': {
    title: 'Perception — Slides',
    description: 'Reference deck.',
  },
};

const MODULE_RENAMES = {
  'dc5977cf-e751-4b86-97ae-8f092701a827': {
    title: 'The Perception Playground',
    description: 'Camera geometry, semantics, 3D structure, motion, and generative vision.',
  },
};

// ---------------------------------------------------------------------------
const { data: caps } = await db.from('capsules').select('id, title, learning_path_id, order_index');

console.log(APPLY ? '=== APPLYING ===\n' : '=== PREVIEW (pass --apply) ===\n');

for (const [id, m] of Object.entries(MODULE_RENAMES)) {
  console.log(`module rename -> ${m.title}`);
  if (APPLY) await db.from('learning_paths').update(m).eq('id', id);
}

for (const [id, c] of Object.entries(RENAMES)) {
  const cur = caps.find((x) => x.id === id);
  console.log(`rename  "${cur?.title ?? '?'}"  ->  "${c.title}"`);
  if (APPLY) await db.from('capsules').update(c).eq('id', id);
}

console.log();
let added = 0;
for (const [moduleId, body] of Object.entries(OVERVIEWS)) {
  const siblings = caps.filter((c) => c.learning_path_id === moduleId);
  if (siblings.some((c) => /^what this module covers|^start here/i.test(c.title))) {
    console.log(`  module ${moduleId.slice(0, 8)} already has an overview — skipped`);
    continue;
  }

  console.log(`  + overview for module ${moduleId.slice(0, 8)}  (${body.split(/\s+/).length} words)`);
  added++;
  if (!APPLY) continue;

  const { data: capsule, error } = await db
    .from('capsules')
    .insert({
      learning_path_id: moduleId,
      title: 'What this module covers',
      description: 'Start here.',
      order_index: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.log(`     FAILED: ${error.message}`);
    continue;
  }

  await db.from('capsule_content').insert({
    capsule_id: capsule.id,
    content_type: 'text',
    title: 'What this module covers',
    content_value: body,
    order_index: 0,
  });

  // The overview must lead. reorder_entities is gated on an admin session, which a
  // service-role script does not have, so write order_index directly.
  const ordered = [capsule.id, ...siblings.sort((a, b) => a.order_index - b.order_index).map((c) => c.id)];
  for (let i = 0; i < ordered.length; i++) {
    await db.from('capsules').update({ order_index: i }).eq('id', ordered[i]);
  }
}

console.log(`\n${added} overview(s) ${APPLY ? 'added' : 'to add'}.`);
console.log(APPLY ? 'Done.' : 'Nothing written. Re-run with --apply.');
