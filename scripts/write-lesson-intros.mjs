/**
 * Proper lesson descriptions — two sentences that say what it is and why it is there.
 *
 * The first pass at this produced labels ("Runs in Colab."), which tell a learner
 * nothing they could not see from the icon. A lesson header should answer: what am I
 * about to do, and why does it come here rather than somewhere else?
 *
 * Projects are hand-written, because each one is a specific thing and a template cannot
 * know what. Structural lessons (lecture, slides, notes) are templated — but the
 * template says why the lesson exists, not what format it is in.
 *
 *   node scripts/write-lesson-intros.mjs          # preview
 *   node scripts/write-lesson-intros.mjs --apply
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
 * Hand-written, matched on the lesson title. Each says what you build and where it sits
 * in the pipeline — the second sentence is the one that earns its place.
 */
const WRITTEN = [
  // ---- ADAS ----
  ['Project 1- ML Based AEB', 'Build Automatic Emergency Braking with classification and regression models, driving the brake decision in MetaDrive. It is the first feature where your metric has a physical consequence: a false negative is a collision, a false positive is a rear-ending.'],
  ['Project 2-  Handwritten digits', 'Transfer learning, on a problem small enough to see every moving part. Get the mechanics straight here and the traffic-sign network in the next lesson is the same idea on a harder input.'],
  ['Project 3 - Traffic sign classification', 'A CNN that reads road signs — the same transfer-learning pattern, now on a real driving task with real failure modes. This is perception doing something the car actually depends on.'],
  ['Project 4 - RL based car control', 'A PPO agent that learns to drive from reward alone. Nothing here is hand-written — no rules, no planner — so hold it against the rule-based stack you build next and be ready to argue for either.'],
  ['Project 5 - Global Planning', 'A* over the road network: given a start and a goal, find the route. This is the top layer of the planning stack, and the two lessons after it refine what this produces.'],
  ['Project 6 - Behavior planning', 'A finite state machine that decides what to do — follow, overtake, yield — given the route. The global planner said where to go; this says how to behave on the way.'],
  ['Project 7 - Local Planning', 'A Frenét lattice planner turning the behaviour decision into an actual trajectory the vehicle can drive. Route, behaviour, trajectory: this completes the three-layer stack that essentially every production autonomy system uses.'],
  ['Project 8 - Motion Planning & Control', 'All three planning layers running together on a highway scenario, feeding a controller. This is where the architecture stops being a diagram and becomes something you have assembled yourself.'],
  ['Project 9 - Adaptive cruise control in C++', 'ACC written in the language it actually ships in. Comfort, safety and following distance pull against each other — tuning that trade-off is where control theory stops being algebra.'],
  ['Project 10: Linear Controls basics', 'The control theory underneath the controller you just wrote. Do it in this order deliberately: the maths lands harder once you have already felt the thing misbehave.'],
  ['Capstone Project 11', 'The whole course at once: AEB, ACC and LKA built in Simulink and co-simulated against IPG CarMaker. This is Model-Based Design as the industry actually practises it — the process you will be hired to follow.'],
  ['MIL, SIL Testing and Code generation', 'Build the test harness, run model- and software-in-the-loop tests, then generate embedded code. This is the step that separates a model that works from a feature that ships.'],
  ['ADAS Requirement Writing Assignment', 'Write the requirements for an ADAS feature before any code exists. Real feature development starts here, and getting this wrong is how projects fail six months later.'],
  ['Practice Project - ML Algorithms', 'A runnable tour of the classical ML algorithms. Most production ADAS features are not deep networks — they are well-chosen classical models under a hard latency budget.'],

  // ---- Vehicle Dynamics & Control ----
  ['Project 1: Adaptive Cruise Control using PID', 'Tune a PID controller against a real vehicle model, delivered as both a Gradio app and C++. Everyone thinks they understand PID until they tune one against a plant that fights back.'],
  ['Project 2: Linear Controls Basics', 'Stability analysis for the controller you just built — poles, margins, and why your tuning worked. This is the theory arriving after the intuition, which is the right order.'],
  ['Project 3: End to End Motion Planning', 'Close the loop: a planner producing trajectories and a controller tracking them. Planning and control are taught apart and never designed apart, and this is where you find out why.'],
  ['Project 4: RL based AV Car control', 'A PPO agent that learns the driving policy instead of being given one. Put it beside the PID and planning work you have just done — one is derived and provable, the other is learned and often better.'],
  ['Project 5 : Electronic Stability Controller', 'ESC in Simulink: detect a skid from yaw error and brake individual wheels to correct it. This is lateral dynamics doing something a driver would feel and a regulator would test.'],
  ['Project 6: Altitude control with Linear Quadratic Regulator', 'LQR on a clean, tractable plant. It does not tune a gain — it solves for the optimal one, and the step from PID to LQR is the step from technician to engineer.'],
  ['Project 7: Lane Keep Assist with Linear Quadratic Regulator', 'The same optimal control, now steering a car in its lane. Same maths as the last lesson, real consequences.'],
  ['Project 8: Trajectory Tracking with Model Predictive Controller', 'MPC: optimise over a horizon while respecting the steering and acceleration limits the vehicle actually has. PID reacts and LQR is optimal but blind to constraints — this is the controller that sees ahead, and it is the most expensive to run.'],

  // ---- AI Bootcamp ----
  ['Cracking the AI Black Box', 'What a model is really doing when it "learns" — the shape of the problem, before any algorithm. Get this straight and everything downstream is bookkeeping.'],
  ['Three Ways to Predict a Number', 'Regression from three angles. The point is not the algorithms; it is seeing that a prediction problem admits several honest answers.'],
  ['One Expert to a Dream Team', 'Why an ensemble beats any single model, and when it does not. This is the most reliable free win in applied ML.'],
  ['Support Vector Machines', 'Margins and kernels — the classifier that dominated before deep learning and still wins on small, clean data. Knowing when the simple thing is the right thing is most of the job.'],
  ['Logistic Regression', 'The classifier every other classifier is measured against. If your neural network cannot beat it, the network is not the problem.'],
  ['Linear Discriminant Analysis', 'Classification framed as class separation rather than boundary-fitting — a different lens on the same problem.'],
  ['Machine Learning Based AEB', 'Automatic Emergency Braking, trained and driven in the MetaDrive simulator. The first time your model failing means the car hits something.'],
  ['PyTorch — From Foundations to Deployment', 'PyTorch from tensors through to a deployable model. This is the framework everything after this lesson is written in.'],
  ['Traffic Sign Classification (GTSRB)', 'A CNN on a real benchmark, with real class imbalance and real degraded images. The gap between a curated dataset and GTSRB is the gap between a paper and a product.'],
  ['RL — PPO Agent Driving in MetaDrive', 'An actor-critic agent that learns to drive end to end. No planner, no rules — just reward, and it is unsettling how well it works.'],
  ['KITTI — Tracking and Detection', 'Detection and tracking on the benchmark the entire field is built on. Every perception claim you will read is measured against this data.'],
  ['KITTI — Instance Segmentation', 'Per-object masks rather than boxes — the difference between knowing a car is there and knowing exactly where it ends.'],
  ['EgoLanes — Lane Estimation', 'Find the lane you are in, from images alone. It sounds simple until the paint is worn, the sun is low, and it is raining.'],
  ['SceneSeg — Scene Segmentation', 'Label every pixel: road, vehicle, pedestrian, sky. This is the dense understanding that planners quietly assume they have.'],
  ['AutoSpeed — Speed from Vision', 'Estimate speed from a camera alone, with no radar and no wheel odometry. A good demonstration of how much geometry is recoverable from pixels.'],
  ['Project 1 — LLM Pretraining', 'Pretrain a language model, then fine-tune it with supervision. Doing it once, end to end, demystifies the entire category.'],
  ['Project 2 — Efficient Fine-Tuning with Unsloth', 'Fine-tune on hardware you actually own. The reason this matters is that it turns "we would need a cluster" into "we could try it this afternoon".'],
  ['Project 3 — DataLab with LLM Intelligence', 'An LLM as an analysis tool rather than a chatbot — pointed at data, asked to reason, and checked.'],
  ['Project 4 — Agentic AI with LangChain', 'A model that calls tools and takes actions. This is where LLMs stop answering and start doing, along with all the failure modes that implies.'],
  ['Project 5 — Vision-Language Model', 'Cosmos-Reason1 7B reasoning over a driving scene — describing it, answering questions about it, flagging what is unusual. This is the direction perception is currently moving.'],
  ['Project 6 — Controllable Generation with ControlNet', 'Generative vision you can steer. For autonomy this matters as a way of manufacturing the corner cases your dataset does not contain.'],

  // ---- Programming foundations (shared across courses) ----
  ['Python Basics', 'Python from the ground up, in a notebook you can run and break. Everything in this course is written in it, so fluency here buys you attention for the actual problem later.'],
  ['Python — Procedural, Functional, OOP', 'The four ways you will actually structure code: procedural, functional, object-oriented, and as a state machine. That last one is not academic — behaviour planners are state machines.'],
  ['Object oriented Programming', 'Classes, inheritance and composition, aimed at code that has to be maintained rather than demonstrated.'],
  ['Data Structures', 'What to reach for and when. The right structure turns an intractable search into a fast one, which is exactly the difference a planner lives or dies on.'],
  ['Algorithms', 'Searching, sorting and pathfinding. The pathfinding here returns later as global planning — this is the same A* wearing different clothes.'],
  ['Data Analysis Basics', 'pandas and NumPy — the wrangling you will do before every model you ever train. It is unglamorous and it is most of the job.'],
  ['Data Visualization Basics', 'Plotting that shows you what the data is doing. Most model bugs are visible in a chart long before they are visible in a metric.'],
  ['SQL', 'How driving data actually reaches you. Nobody hands you a clean CSV — they hand you a database and a deadline.'],

  // ---- C++ ----
  ['Modern C++, GTest & CMake', 'The language production ADAS ships in, plus the build and test toolchain around it. Python is where you prototype; this is where it goes to run in a car.'],
  ['Intro to C++, GTest and GMake', 'C++ with its build and test toolchain. Every ADAS ECU on the road runs this language, so it is not optional.'],
  ['Compiler Generated Functions', 'What the compiler quietly writes for you — constructors, assignment, moves — and how it bites when you assume otherwise.'],
  ['Resource Management', 'RAII and ownership. In a domain where a memory leak can become a safety recall, this is the lesson that matters most.'],
  ['C++ Practice', 'Clone the repo and work through it locally. Reading C++ and writing C++ are different skills, and only one of them is being tested.'],

  // ---- ML foundations ----
  ['How Machines Learn', 'The shape of the problem before any algorithm: data, a model, a loss, an optimiser. Nearly every ML failure is a failure of the assumptions underneath, not of the code.'],
  ['Foundations of ML - Probability and Unsupervised Learning', 'The probability that underpins every model you will train, and what can be done with no labels at all. This is the part people skip and later wish they had not.'],
  ['Probability and Unsupervised Learning — Notes', 'The reference material, with a mind map of how the pieces connect.'],
  ['ML Algorithms — Notebook', 'The classical algorithms, runnable. Change something, watch it break, understand why.'],
  ['Supervised ML — Full Lecture', 'The complete supervised-learning session, end to end.'],

  // ---- Safety ----
  ['Functional Safety - High level overview', 'Hazard analysis, ASIL levels and the V-model. This is why ADAS engineering looks nothing like ML engineering: you cannot ship because a test set looked good, you have to argue the thing is safe.'],
  ['Functional Safety Implementation steps', 'What ISO 26262 actually demands of your code and your process. Almost every ADAS interview eventually arrives here.'],

  // ---- Course-specific structural lessons ----
  ['SDV Lab development Manual', 'How the lab is set up and why it is set up that way. Read it before you fight the toolchain.'],
  ['Introduction', 'Orientation: what this course covers, who it is for, and what you will have built by the end.'],
  ['Capstone project details', 'The capstone brief and the project files. Read this before you start building, not halfway through.'],
  ['AEB Project — Notebook, Code and Slides', 'The AEB project in full: the Colab notebook, the source repository, and the reference deck. One project, three artifacts.'],
  ['Computer Vision — Master-Class', 'The long-form vision session, covering the stack from pixels to objects.'],
  ['The Perception Playground', 'An interactive lab for the perception stack. Perception is far easier to build intuition for by changing something and watching what breaks than by reading about it.'],
  ['— Reference', 'Supporting material for the module — the deck and the background reading.'],
  ['Project 5 Explanation - ABS, TCS & ESC', 'A walkthrough of how anti-lock braking, traction control and stability control actually work — and how they differ. Watch this before building the ESC in Simulink.'],
];

const TEMPLATES = [
  [/^what this module covers/i, () => 'Start here — what this module covers and why it follows the last one.'],
  [/alternate clip/i, () => 'An alternate recording of the same lecture. Same content; take whichever presentation suits you.'],
  [/lecture slides?$|— slides$|^slides|slide$|project \d+ - slides/i, (m) => `The slides from the ${m} lecture. Use them to revisit a specific derivation without re-watching an hour of video.`],
  [/lecture notes/i, (m) => `Written notes for ${m} — the same material in a form you can search and quote.`],
  [/mind ?map/i, (m) => `A single page showing how the ideas in ${m} connect. Worth a look before an interview.`],
  [/summary video/i, () => 'A condensed run-through of the lecture, for revision rather than first contact.'],
  [/project video|explanation video|explaining project|explaination/i, () => 'A walkthrough of the implementation — watch this if the project fights you.'],
  [/lecture video|full lecture|— lecture$|^lecture$/i, (m) => `The full lecture for ${m}. The projects in this module assume it, so take it first.`],
  [/^primer for/i, () => 'A runnable primer. Skim it if you already know this; do not skip it if you do not.'],
  [/assignment/i, () => 'Attempt this yourself before you open the solution. The gap between the two is the lesson.'],
  [/installed|install/i, () => 'Setup. Do this before the projects, not the night before the capstone.'],
  [/logic info|project info|additional info|misc/i, (m) => `Supporting material for ${m}.`],
  [/practice/i, () => 'Practice material. Reading it is not the same as working through it.'],
];

const { data: mods } = await db.from('learning_paths').select('id,title');
const { data: caps } = await db.from('capsules').select('id,title,learning_path_id');
const modTitle = new Map(mods.map((m) => [m.id, m.title]));

let set = 0;
const unmatched = [];

for (const cap of caps) {
  const mod = modTitle.get(cap.learning_path_id) ?? 'this module';
  let text = null;

  const hand = WRITTEN.find(([key]) => cap.title.toLowerCase().includes(key.toLowerCase()));
  if (hand) {
    text = hand[1];
  } else {
    const tpl = TEMPLATES.find(([re]) => re.test(cap.title));
    if (tpl) text = tpl[1](mod);
  }

  if (!text) {
    unmatched.push(`${mod.slice(0, 28).padEnd(30)} ${cap.title}`);
    continue;
  }

  set++;
  if (APPLY) await db.from('capsules').update({ description: text }).eq('id', cap.id);
}

console.log(`${APPLY ? 'Wrote' : 'Would write'} ${set} descriptions.\n`);
if (unmatched.length) {
  console.log(`${unmatched.length} lesson(s) fell through to the generic path:`);
  for (const u of unmatched.slice(0, 25)) console.log(`   ${u}`);
  if (unmatched.length > 25) console.log(`   ... and ${unmatched.length - 25} more`);
}
console.log(APPLY ? '\nDone.' : '\nNothing written. Re-run with --apply.');
