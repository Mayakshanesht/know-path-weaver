/**
 * A "Welcome" module at the start of each course and a "What next" module at the end.
 *
 * The module overviews say what each module covers. Neither says what the COURSE is, who
 * it is for, or what you should do once it is finished — and the last thing a learner
 * currently sees is a lecture on MPC, followed by nothing.
 *
 * The outro also cross-sells, honestly: it names the course that genuinely follows from
 * this one and says why, rather than listing the catalogue.
 *
 *   node scripts/add-course-intro-outro.mjs          # preview
 *   node scripts/add-course-intro-outro.mjs --apply
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

const COURSES = {
  'AI Bootcamp': {
    intro: `# Welcome

You are here to build AI systems for autonomous driving, not to collect algorithms. That distinction shapes everything about how this course is arranged.

## What you will actually do

By the end you will have trained an emergency braking system that decides when to stop a car, a CNN that reads traffic signs, an RL agent that drives with no hand-written rules at all, a perception stack running on real KITTI data, and six projects on the current frontier — fine-tuned LLMs, an agentic system, a vision-language model reasoning over a driving scene, and controllable image generation.

## How it is arranged

Seven modules, and the order is the argument:

1. **Foundations** — Python, data structures, algorithms, SQL
2. **Foundations of ML** — how a machine learns anything at all
3. **Supervised ML** — the classical models, and your first real feature (AEB)
4. **Motion prediction and planning** — connecting perception to action
5. **Deep learning and RL** — when hand-written features run out
6. **Computer vision** — earning the assumption that the car can see
7. **Multimodal LLMs and generative vision** — where the field is going

Each module opens with a "What this module covers" lesson explaining why it follows the one before it. Read those. They are the thread.

## Who this is for

Engineers who can already program and want to build systems. If you are looking for a gentle introduction to AI, this is not it — Module 3 assumes you can wrangle data without being told how.

**Start with Module 1.** If you are already fluent in Python, skim it and move on — but do not skip the algorithms notebook. The pathfinding in it comes back as global planning.`,

    outro: `# What you have built

Look back at what is now in your repository.

- An **AEB system** that brakes a car in simulation, trained from data
- A **CNN** that classifies traffic signs on a real benchmark
- A **PPO agent** that drives end to end, learned entirely from reward
- A **perception stack** — detection, tracking, segmentation, lane estimation, speed from vision — on real KITTI data
- **Six frontier projects**: a pretrained and fine-tuned LLM, efficient fine-tuning, an agentic system, a VLM reasoning over a driving scene, and controllable generation

That is not a portfolio of tutorials. It is a portfolio of systems.

## What to do next

**Put the projects somewhere public.** The PPO agent and the KITTI work are the two that make a hiring manager stop scrolling. A repository with a clear README beats a certificate every time.

**Go deeper where it caught you.** If the AEB and PPO work is what you enjoyed, you are a controls person and did not know it. If KITTI and segmentation held your attention, you are a perception person.

## Where to go from here

**Advanced Driver Assistance Systems (ADAS): Engineering & Development** is the natural next step. This course taught you the AI; ADAS teaches you how it becomes a product — functional safety, ISO 26262, requirements, the V-model, and a Simulink capstone co-simulated against IPG CarMaker. It is the difference between a model that works and a feature that ships, and it is the gap most ML engineers never cross.

**Modern Vehicle Control (PID → LQR → MPC)** is the other direction — if the RL agent made you want to know what a *provably* good controller looks like, that is the course that answers it.

Congratulations. Go and build something.`,
  },

  'Advanced Driver Assistance Systems': {
    intro: `# Welcome

This course is about how ADAS systems are actually built — not how they are described in a paper.

## What you will actually do

Eleven projects and a capstone. You will build Automatic Emergency Braking from data, classify traffic signs with a CNN, train an RL agent to drive, assemble a full three-layer planning stack (A* → FSM → lattice planner), write an Adaptive Cruise Controller in C++, and finish by building AEB, ACC and Lane Keep Assist in Simulink, co-simulated against IPG CarMaker and validated with MIL/SIL testing and generated embedded code.

## How it is arranged

Thirteen modules, following the shape of the real thing:

**Foundations** → the lab and toolchain, then the programming
**Perception** → machine learning, deep learning, reinforcement learning
**Planning** → route, behaviour, trajectory
**Implementation** → modern C++, the language it ships in
**Control** → longitudinal, then lateral vehicle dynamics
**Safety** → ISO 26262, the V-model, and why any of this is allowed on a road
**Capstone** → all of it, run as an industry workflow

Each module opens with a "What this module covers" lesson explaining why it follows the last. That thread is the course.

## Who this is for

Engineers who want to work on ADAS as it is practised, with the process and the safety case, not just the algorithms. Set up MATLAB and IPG CarMaker in Module 1 — the capstone depends on it, and you do not want to discover that in week eleven.

**Start with Module 1.**`,

    outro: `# What you have built

Eleven projects and a capstone. Specifically:

- **AEB** from data, and again in Simulink
- **Traffic sign classification** with a CNN
- **An RL agent** that drives with no rules at all
- **A full planning stack** — A* global, FSM behaviour, Frenét lattice local, composed on a highway
- **Adaptive Cruise Control in C++**
- **Electronic Stability Control**, and the lateral dynamics behind it
- **A capstone**: AEB, ACC and LKA in Simulink, co-simulated against IPG CarMaker, MIL/SIL tested, with generated embedded code

The last one is the one that matters. Almost nobody outside the industry has taken a feature from a written requirement, through architecture and control design, to validated generated code. You now have.

## What to do next

**Lead with the capstone.** The Model-Based Design workflow — requirements → architecture → control → MIL/SIL — is what OEMs and Tier 1s hire for, and it is exactly what a portfolio of Colab notebooks cannot demonstrate.

**Be able to argue the safety case.** Nearly every ADAS interview eventually arrives at ISO 26262. "The model scored well on the test set" is not an answer, and knowing why is most of what separates a candidate from a hire.

## Where to go from here

**Modern Vehicle Control (PID → LQR → MPC)** goes deeper on the axis this course could only touch. You wrote a PID controller for ACC; that course takes you through LQR and MPC as one framework, with ESC, LKA and constrained trajectory tracking. If the control modules were the ones that held you, that is the next course.

**AI Bootcamp for Autonomous Driving** goes the other way — deeper into the learning side, through vision-language models and generative vision, which is where perception is currently heading.

Congratulations. That was the hard one.`,
  },

  'Advanced Vehicle Dynamics': {
    intro: `# Welcome

Most control courses teach PID, then LQR, then MPC as three unrelated topics. They are not three topics. They are one idea, arriving in stages, and each stage exists because the previous one ran out of road.

That is the argument this course makes.

## What you will actually do

Eight projects. Adaptive Cruise Control with a tuned PID, in C++. Stability analysis of the thing you just built. An end-to-end planner feeding a controller. An RL agent that learns the policy instead of being given one. Electronic Stability Control in Simulink. LQR, twice — once on a clean plant, once steering a car in its lane. And finally MPC, tracking a trajectory while respecting the limits the vehicle actually has.

## How it is arranged

**Foundations** → Python, then modern C++ (production controllers are C++, and yours will be)
**Longitudinal dynamics** → the straight-line problem, and PID
**Planning and control** → where the trajectory comes from
**Reinforcement learning** → the learned alternative, for contrast
**Lateral dynamics** → the hard axis: tyres, yaw, state estimation, and LQR
**Model Predictive Control** → control that sees ahead

Each module opens with a "What this module covers" lesson explaining why it follows the last.

## Who this is for

Engineers who want to design controllers for real vehicles and be able to defend the design. You will need to be comfortable with linear algebra — LQR is not a black box, and the whole point is that you can see inside it.

**Start with Module 1.**`,

    outro: `# What you have built

- **Adaptive Cruise Control** with a tuned PID, as a Gradio app and in C++
- **Stability analysis** of that controller — poles, margins, and why the tuning held
- **An end-to-end planner and controller**, closing the loop
- **A PPO agent** that learned the policy rather than being handed one
- **Electronic Stability Control** in Simulink
- **LQR**, on a clean plant and then on Lane Keep Assist
- **MPC** tracking a trajectory under real actuator constraints

## The thing you actually learned

PID reacts. LQR is optimal — but only for an unconstrained linear system with no view of the future. MPC optimises over a horizon *and* respects constraints, and it costs you compute for the privilege.

Knowing which one a problem deserves, and being able to say why, is the skill. It is also, almost always, the interview question.

## What to do next

**Push the C++.** A controller you can only demonstrate in a notebook is a controller nobody will let near a vehicle. The ACC project is in C++ for a reason — build on that.

**Get your hands on a real plant.** Simulation is honest about the maths and silent about everything else: sensor noise, actuator lag, the tyre that is not the tyre in your model.

## Where to go from here

**Advanced Driver Assistance Systems (ADAS): Engineering & Development** is where these controllers become features. You can design an LQR lane-keeper; ADAS teaches you to write its requirements, argue its safety case under ISO 26262, validate it with MIL/SIL testing, and generate the embedded code. That is the path from control engineer to ADAS engineer.

**AI Bootcamp for Autonomous Driving** is the other road — if the RL module made you want to know how the learned systems actually work, rather than treating them as the opposition.

Congratulations. PID → LQR → MPC, as one framework. Exactly as promised.`,
  },

  'Perception lab': {
    intro: `# Welcome

Perception is much easier to understand by breaking it than by reading about it. That is what this lab is for.

## What you will do

Work through the perception stack in the interactive playground — camera geometry, semantics, 3D structure, motion, reconstruction, and generative vision — changing things and watching what happens. The lecture and slides are there for the theory behind whatever you have just broken.

**Start with the playground.** Read the lecture when something surprises you.`,

    outro: `# Where to go from here

The playground gave you intuition. Two courses turn that into systems.

**AI Bootcamp for Autonomous Driving** takes the perception stack onto real data — KITTI detection, tracking and segmentation, lane estimation, speed from vision — and then keeps going into vision-language models and generative vision.

**Advanced Driver Assistance Systems (ADAS)** puts perception in its place: as one component of a safety-critical system that also has to plan, control, and pass a functional safety review.`,
  },
};

// ---------------------------------------------------------------------------
const { data: courses } = await db.from('courses').select('id, title');
const { data: mods } = await db.from('learning_paths').select('id, title, course_id, order_index');

console.log(APPLY ? '=== APPLYING ===\n' : '=== PREVIEW (pass --apply) ===\n');

for (const [key, content] of Object.entries(COURSES)) {
  const course = courses.find((c) => c.title.includes(key));
  if (!course) {
    console.log(`!! no course matching "${key}"`);
    continue;
  }

  const existing = mods
    .filter((m) => m.course_id === course.id)
    .sort((a, b) => a.order_index - b.order_index);

  const hasIntro = existing.some((m) => /^welcome/i.test(m.title));
  const hasOutro = existing.some((m) => /^what next|^wrap/i.test(m.title));

  console.log(`${course.title.slice(0, 50)}`);
  console.log(`  ${hasIntro ? 'has intro already' : '+ Welcome (intro)'}`);
  console.log(`  ${hasOutro ? 'has outro already' : '+ What next (outro)'}\n`);

  if (!APPLY) continue;

  const add = async (title, body, orderIndex) => {
    const { data: mod, error } = await db
      .from('learning_paths')
      .insert({ course_id: course.id, title, order_index: orderIndex })
      .select('id')
      .single();
    if (error) {
      console.log(`     FAILED module: ${error.message}`);
      return;
    }

    const { data: cap, error: capError } = await db
      .from('capsules')
      .insert({
        learning_path_id: mod.id,
        title,
        description:
          title === 'Welcome'
            ? 'What this course is, who it is for, and what you will have built by the end.'
            : 'What you built, what it means, and where to go next.',
        order_index: 0,
      })
      .select('id')
      .single();
    if (capError) {
      console.log(`     FAILED capsule: ${capError.message}`);
      return;
    }

    await db.from('capsule_content').insert({
      capsule_id: cap.id,
      content_type: 'text',
      title,
      content_value: body,
      order_index: 0,
    });
  };

  if (!hasIntro) {
    // Everything shifts down by one so Welcome can lead.
    for (const m of existing) {
      await db.from('learning_paths').update({ order_index: m.order_index + 1 }).eq('id', m.id);
    }
    await add('Welcome', content.intro, 0);
  }

  if (!hasOutro) {
    const last = Math.max(...existing.map((m) => m.order_index), -1) + 2;
    await add('What next', content.outro, last);
  }

  console.log(`  done\n`);
}

console.log(APPLY ? 'Done.' : 'Nothing written. Re-run with --apply.');
