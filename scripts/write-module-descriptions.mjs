/**
 * Writes the module description shown on each module's first lesson.
 *
 * The field existed and was rendered nowhere, so most modules had nothing in it. A learner
 * arriving at Module 6 saw a lesson title and no sense of what the module was for or why it
 * came after Module 5.
 *
 * Each description does two jobs: says what the module covers, and says why it comes HERE —
 * what it builds on, or what would break without it. The second sentence is the one that
 * earns its place; without it this is a table of contents, not teaching.
 *
 * Welcome and What-next modules are skipped: they open with an intro lesson that already
 * says this, and a callout repeating it would just be noise.
 *
 *   node scripts/write-module-descriptions.mjs --apply
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

const D = {
  // --- ADAS: Engineering & Development ---
  'SDV Lab & Industry Workflow Foundations':
    'Sets up the toolchain you will use for the rest of the course — the SDV lab, MATLAB and IPG CarMaker — and walks the workflow a real ADAS feature actually travels through, from requirement to co-simulation. It comes first because every later module hands its output to the next stage of this pipeline, and it is far easier to follow that handoff once you have seen the whole shape of it.',
  'Programming Foundations for ADAS':
    'Python, data structures and SQL, aimed squarely at the work ahead: handling drive logs, querying annotation sets, and writing the code the ML modules assume you can write. If you already program, treat it as calibration rather than instruction — the projects later in the course start from this baseline and do not re-teach it.',
  'Fundamentals of Autonomous Vehicles & ADAS':
    'The vocabulary and the architecture: SAE levels, the operational design domain, and the sense–plan–act pipeline that the rest of the course decomposes into modules. This is the map. Every later module is one box on this diagram, and knowing which box you are standing in is what stops the course feeling like a pile of unrelated topics.',
  'Foundations of Machine Learning for ADAS':
    'How learning from data actually works — generalisation, the bias-variance trade-off, and the failure modes that matter more here than anywhere else. It comes before the AEB project deliberately: you cannot reason about whether a braking classifier is safe until you can reason about why a model that scores 99% might still be dangerous.',
  'Supervised Machine Learning & AEB Project':
    'Takes supervised learning from theory to a working automatic emergency braking classifier trained in MetaDrive. This is where the abstract asymmetry between error types becomes concrete: a false negative is a collision, a false positive is a rear-ending, and choosing the threshold between them turns out to be a safety decision rather than a modelling one.',
  'Perception: Deep Learning & Reinforcement Learning':
    'Moves from hand-designed features to learned ones — the deep networks that turn raw camera pixels into objects, lanes and free space, plus an introduction to policies learned by acting. Perception is the first stage of the pipeline, and everything downstream inherits its mistakes, so this is where the quality of the whole stack is set.',
  'Motion Prediction & Planning':
    'Given a model of the world, decide what to do: predict where other agents will go, choose a manoeuvre, and produce a trajectory the vehicle can actually follow. It sits after perception for a reason — a planner acting on where objects WERE, rather than where they will be, is planning against the past.',
  'Modern C++ for ADAS & SDV':
    'C++ as it is actually written on an ECU: ownership, RAII, compiler-generated functions, and testing with GTest and CMake. Python got you through the modelling; it will not get you onto the vehicle, where a garbage-collection pause in a braking controller is not a performance problem but a safety event.',
  'Longitudinal Vehicle Dynamics & Control':
    'The physics of accelerating and braking, and the linear control theory that lets you command them — stability, gain and phase margin, and PID. This is the axis that ACC and AEB act along, which is why it comes before the lateral case: you are building the controller that the emergency braking model has been asking for.',
  'Lateral Vehicle Dynamics, Estimation & Optimal Control':
    'Steering, tyre behaviour, the bicycle model, and the estimators (Kalman, EKF, particle) that recover a state you cannot measure directly — then LQR, where you stop tuning gains and start specifying what you want. Longitudinal control was one dimension; this is where the vehicle becomes a system that can be genuinely difficult to control.',
  'Systems Engineering & Functional Safety for ADAS':
    'Requirements, the V-model, ISO 26262, ASIL and the argument that a feature is safe enough to sell. Everything you have built so far could be technically excellent and still unshippable, because a safety case is not made of code — it is made of traceability from a hazard, through a requirement, to a test that passes.',
  'ADAS Capstone: AEB, ACC & LKA (Production Workflow)':
    'The whole course in one build: emergency braking, adaptive cruise and lane keeping, taken through MIL and SIL to code generation and co-simulation in IPG CarMaker. Each piece is something you already know; the capstone is about the part nobody teaches, which is what happens when they all have to work at once, on the same vehicle, at the same time.',

  // --- Advanced Vehicle Dynamics & Control ---
  'Fundamentals of Programming and Data Structures':
    'Python, the core data structures, and the algorithmic thinking the control and planning work later leans on. It is deliberately short: the point is not to make you a software engineer but to make sure that when a planner needs a priority queue, you know why it needs one.',
  'Modern C++':
    'Ownership, RAII, compiler-generated functions and the testing toolchain — C++ as it is written for real-time systems rather than as it is taught. Controllers ship in C++ because a garbage-collection pause of 50 ms in a braking loop is not slow, it is dangerous, and this module is where you stop prototyping and start writing code that could run on a vehicle.',
  'Longitudinal Vehicle Dynamics & Linear Controls':
    'The forces along the vehicle\'s direction of travel, and the linear control theory that commands them: stability, poles, gain and phase margin, and PID tuned properly rather than by feel. Everything later in the course — LQR, MPC, RL — is an answer to a limitation you will meet here first.',
  'Motion Planning & Control':
    'Closes the loop between deciding where to go and actually going there. Planning and control are almost always taught apart and can never be designed apart: a trajectory that ignores the vehicle\'s turning radius cannot be tracked by any controller, however good, and this module is where that stops being an abstract warning.',
  'Reinforcement Learning':
    'Learning a driving policy by acting rather than by being told, using PPO in a simulator. It comes after classical control on purpose — you now know what a well-understood, provable controller looks like, which is exactly what you need in order to judge honestly what RL buys you and what it costs you in explainability.',
  'Lateral Vehicle dynamics, Estimation and Optimal(LQR)/Predictive Control(MPC)':
    'Steering, tyre models, and the estimators that recover the state you cannot measure — then LQR and MPC, where you specify what you want rather than tune how to get it. This is the heart of the course: the point where control stops being a set of gains and becomes an optimisation problem you pose.',
  'Model Predictive Control for Trajectory Tracking':
    'MPC applied to the real problem: track a trajectory while respecting the constraints the vehicle genuinely has. LQR was optimal but could not say the word "cannot"; MPC can, and that single difference — the ability to encode a limit rather than hope you stay inside it — is why it is what modern autonomy actually runs.',

  // --- AI Bootcamp for Autonomous Driving ---
  'Motion Prediction and Planning':
    'Where perception ends and decision-making begins: predicting the futures of other agents, then choosing a manoeuvre and a trajectory. Prediction is not a detail bolted onto planning — by the time you have braked, the pedestrian has moved, so a planner that reasons about the present is already reasoning about the past.',
};

const { data: lps } = await db.from('learning_paths').select('id, title, description');

console.log(APPLY ? '=== APPLYING ===\n' : '=== PREVIEW ===\n');

let n = 0;
for (const lp of lps) {
  const text = D[lp.title];
  if (!text) continue;
  if (lp.description?.trim()) { console.log(`  skip (already has one): ${lp.title.slice(0, 50)}`); continue; }
  n++;
  console.log(`  ${lp.title.slice(0, 58)}`);
  if (APPLY) {
    const { error } = await db.from('learning_paths').update({ description: text }).eq('id', lp.id);
    if (error) console.log(`     FAILED: ${error.message}`);
  }
}

const covered = new Set(lps.map((l) => l.title));
const unused = Object.keys(D).filter((k) => !covered.has(k));
if (unused.length) console.log(`\nWrote for a module that does not exist (check the title): ${unused.join(', ')}`);

console.log(`\n${APPLY ? 'Wrote' : 'Would write'} ${n} module descriptions.`);
