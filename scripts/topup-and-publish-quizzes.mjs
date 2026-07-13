/**
 * Brings every written quiz up to at least three questions, then publishes it.
 *
 * A one-question quiz is a coin-flip, not an assessment. Three is the minimum at which a
 * pass actually means something.
 *
 * Only quizzes that HAVE questions are published. The 117 empty drafts stay unpublished —
 * an empty quiz a learner can open is worse than no quiz at all. And nothing was written
 * for lessons whose subject I cannot see ("Lecture Video"), so those stay drafts with
 * their brief.
 *
 *   node scripts/topup-and-publish-quizzes.mjs --apply
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

const mcq = (question_text, options, correct_answer, explanation) => ({
  question_type: 'mcq', question_text, options, correct_answer, explanation, points: 1,
});
const tf = (question_text, correct, explanation) => ({
  question_type: 'true_false', question_text, options: null,
  correct_answer: correct ? 'true' : 'false', explanation, points: 1,
});

/** Extra questions, keyed on a substring of the lesson title. */
const TOPUP = {
  'One Expert to a Dream Team': [
    mcq('Bagging (as in random forests) primarily reduces:', {
      a: 'Bias', b: 'Variance', c: 'Training time', d: 'The number of features needed',
    }, 'b', 'Bagging averages many high-variance, low-bias learners. Boosting is the opposite: it stacks weak learners to attack bias.'),
    tf('Adding more models to an ensemble always improves it.', false,
      'It improves while the new models bring uncorrelated errors. Add a tenth copy of the same model and you gain nothing but compute.'),
  ],
  'Linear Discriminant Analysis': [
    mcq('The key difference between LDA and PCA is that:', {
      a: 'LDA is unsupervised', b: 'PCA uses the class labels', c: 'LDA uses the class labels; PCA does not', d: 'They are the same',
    }, 'c', 'PCA maximises variance and never looks at the labels. LDA maximises class separability, which requires them.'),
    tf('LDA assumes the classes share the same covariance structure.', true,
      'That assumption is what makes the decision boundary linear. When it fails badly, QDA or a non-linear model is the honest answer.'),
  ],
  'How Machines Learn': [
    mcq('Which is the clearest sign of overfitting?', {
      a: 'Training loss is high', b: 'Training loss keeps falling while validation loss rises', c: 'Both losses fall together',
      d: 'The model trains slowly',
    }, 'b', 'The model is memorising the training set rather than learning the pattern. It is the diverging curves that tell you, not the absolute numbers.'),
    mcq('Data leakage means:', {
      a: 'Losing data during training', b: 'Information from the target sneaking into the features',
      c: 'A memory leak', d: 'Corrupted labels',
    }, 'b', 'It is the most dangerous bug in applied ML precisely because it looks like success: the model scores brilliantly, then collapses in production.'),
  ],
  'Resource Management': [
    mcq('Why does RAII matter more in an ADAS ECU than in a script?', {
      a: 'C++ is faster', b: 'The process may run for the vehicle\'s whole lifetime, so a slow leak eventually kills it',
      c: 'It reduces binary size', d: 'It is required by the compiler',
    }, 'b', 'A short-lived script can leak with impunity — the OS reclaims everything at exit. A controller that runs for years cannot.'),
    tf('A raw owning pointer is safe as long as you remember to call delete.', false,
      'An early return, a thrown exception, or the next engineer to edit the function all break that promise. Ownership belongs in the type, not in your memory.'),
  ],
  'Algorithms': [
    mcq('What does A* actually search over in global planning?', {
      a: 'The image', b: 'A graph of the road network', c: 'The vehicle state space', d: 'The trajectory',
    }, 'b', 'Nodes are road segments or waypoints; edges are the connections and their costs. The trajectory comes much later, from the local planner.'),
    tf('The choice of data structure can change an algorithm\'s complexity class.', true,
      'A priority queue is exactly why Dijkstra is tractable. Use a list instead and the same algorithm becomes unusable at scale.'),
  ],
  'Project 4 - RL based car control': [
    mcq('The reward function in an RL driving task is:', {
      a: 'A minor detail', b: 'The specification of the task — a wrong reward produces a confidently wrong policy',
      c: 'Learned automatically', d: 'Only needed for evaluation',
    }, 'b', 'Reward hacking is the classic failure: an agent that maximises what you asked for rather than what you meant, and does it perfectly.'),
    tf('An RL policy can be inspected to explain why it made a specific decision.', false,
      'That opacity is precisely why RL is hard to certify under ISO 26262. There is no requirement to trace, no logic to review.'),
  ],
  'Project 7: Lane Keep Assist': [
    mcq('In LQR, the Q and R matrices encode:', {
      a: 'The plant dynamics', b: 'The relative cost of state error against control effort',
      c: 'The sensor noise', d: 'The sampling rate',
    }, 'b', 'That is the design decision. Push Q up and it tracks aggressively; push R up and it acts gently. The gains fall out of that choice.'),
    tf('LQR requires a model of the system.', true,
      'It solves the Riccati equation using the state-space model. No model, no LQR — which is exactly why a bad model gives you confidently optimal nonsense.'),
  ],
  'Electronic Stability Controller': [
    mcq('ESC detects a skid by comparing:', {
      a: 'Wheel speeds only', b: 'The yaw rate the driver requested with the yaw rate actually measured',
      c: 'Engine RPM with vehicle speed', d: 'Tyre pressure with load',
    }, 'b', 'Steering angle and speed give the intended yaw rate. The gyro gives the real one. The difference is the skid.'),
    tf('ESC can restore control on a surface with no grip at all.', false,
      'ESC works through the tyres. If the tyres have nothing to push against, there is no moment to generate and no control to restore.'),
  ],
  'RL — PPO Agent Driving in MetaDrive': [
    tf('A reward function that scores the agent only on distance travelled is sufficient for safe driving.', false,
      'It will happily learn to speed, cut corners and ignore lanes, because that is what you rewarded. Specifying the reward IS specifying the task.'),
  ],
  'Logistic Regression': [
    mcq('The sigmoid maps the model output to:', {
      a: 'A class label', b: 'A probability between 0 and 1', c: 'A distance from the boundary', d: 'A log-odds value',
    }, 'b', 'The linear part produces log-odds; the sigmoid squashes them into a probability. The label only appears when you pick a threshold — which is a separate decision.'),
  ],
  'Traffic sign classification': [
    tf('A model with 99% accuracy on GTSRB is safe to deploy on a vehicle.', false,
      'Benchmark accuracy is a floor. Motion blur, glare, occlusion and worn signs are all out of distribution, and all completely routine on a road.'),
  ],
  'Traffic Sign Classification (GTSRB)': [
    mcq('When fine-tuning a pretrained CNN, you usually freeze the early layers because:', {
      a: 'They are the slowest to train', b: 'They have learned generic edges and textures that transfer',
      c: 'They contain the classifier', d: 'They cause overfitting',
    }, 'b', 'The early layers are generic; the late layers are task-specific. That is the whole basis of transfer learning.'),
  ],
  'Project 6 - Behavior planning': [
    tf('A behaviour planner outputs a steering angle.', false,
      'It outputs a discrete manoeuvre — follow, overtake, yield. Turning that into steering is the local planner and the controller\'s job.'),
  ],
  'Functional Safety': [
    mcq('The V-model pairs each design step with:', {
      a: 'A code review', b: 'A corresponding verification or validation step',
      c: 'A sprint', d: 'A budget approval',
    }, 'b', 'Requirements pair with acceptance tests, architecture with integration tests, unit design with unit tests. Every claim you make must be checkable.'),
  ],
  'Machine Learning Based AEB': [
    mcq('The decision threshold for an AEB classifier is:', {
      a: 'A modelling detail, best left at 0.5', b: 'A safety decision, because it sets the trade between missed braking and false braking',
      c: 'Learned automatically', d: 'Irrelevant if accuracy is high',
    }, 'b', 'The model gives a probability; the threshold turns it into an action. That conversion is where the safety argument actually lives.'),
  ],
  'Adaptive cruise control': [
    mcq('Integral windup happens when:', {
      a: 'The derivative gain is too high', b: 'The actuator saturates and the integral term keeps accumulating error',
      c: 'The setpoint changes too fast', d: 'The sensor is noisy',
    }, 'b', 'The brake is already fully applied but the integrator keeps winding up, so when the error finally reverses the controller overshoots badly. Clamping the integrator is the standard fix.'),
  ],
  'Global Planning': [
    tf('A* explores fewer nodes than Dijkstra while still finding an optimal path, provided the heuristic is admissible.', true,
      'That is exactly the bargain A* strikes: the same optimality guarantee, far less search — as long as the heuristic never overestimates.'),
  ],
  'Local Planning': [
    mcq('The lateral coordinate d in a Frenét frame measures:', {
      a: 'Distance travelled along the road', b: 'Offset perpendicular to the road centreline',
      c: 'Heading error', d: 'Curvature',
    }, 'b', 's runs along the road, d runs across it. That decoupling is precisely what makes the planning problem tractable.'),
  ],
  'Primer for Algorithms': [
    mcq('Big-O describes:', {
      a: 'Exact runtime in milliseconds', b: 'How runtime grows as the input grows',
      c: 'Memory usage only', d: 'The number of lines of code',
    }, 'b', 'It is about growth, not speed. An O(n²) algorithm can beat an O(n log n) one on small inputs — and lose catastrophically on large ones.'),
    tf('An algorithm with better Big-O is always the better choice in practice.', false,
      'Constants and cache behaviour matter. This is why real sort implementations switch to insertion sort below a size threshold.'),
  ],
};

const { data: quizzes } = await db.from('quizzes').select('id, capsule_id, title, is_published');
const { data: caps } = await db.from('capsules').select('id, title');
const { data: existing } = await db.from('quiz_questions').select('id, quiz_id');

const capTitle = new Map(caps.map((c) => [c.id, c.title]));
const counts = {};
for (const q of existing) counts[q.quiz_id] = (counts[q.quiz_id] ?? 0) + 1;

console.log(APPLY ? '=== APPLYING ===\n' : '=== PREVIEW ===\n');

let added = 0;
for (const quiz of quizzes) {
  const n = counts[quiz.id] ?? 0;
  if (n === 0 || n >= 3) continue;

  const title = capTitle.get(quiz.capsule_id) ?? '';
  const key = Object.keys(TOPUP).find((k) => title.toLowerCase().includes(k.toLowerCase()));
  if (!key) {
    console.log(`  !! ${title.slice(0, 48)} has ${n} and no top-up written — will NOT be published`);
    continue;
  }

  const extra = TOPUP[key].slice(0, Math.max(0, 3 - n));
  console.log(`  ${title.slice(0, 48).padEnd(50)} ${n} -> ${n + extra.length}`);
  added += extra.length;

  if (APPLY) {
    await db.from('quiz_questions').insert(
      extra.map((q, i) => ({ ...q, quiz_id: quiz.id, order_index: n + i }))
    );
    counts[quiz.id] = n + extra.length;
  }
}

console.log(`\n${APPLY ? 'Added' : 'Would add'} ${added} questions.\n`);

// Publish only what has at least three questions. An empty quiz a learner can open is
// worse than no quiz.
let published = 0;
for (const quiz of quizzes) {
  const n = counts[quiz.id] ?? 0;
  if (n < 3) continue;
  published++;
  if (APPLY && !quiz.is_published) {
    await db.from('quizzes').update({ is_published: true }).eq('id', quiz.id);
  }
}

console.log(`${APPLY ? 'Published' : 'Would publish'} ${published} quizzes (>= 3 questions).`);
console.log(`Left unpublished: ${quizzes.length - published} (empty drafts, and anything under 3).`);
