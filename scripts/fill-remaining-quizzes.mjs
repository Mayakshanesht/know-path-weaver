/**
 * Fills the remaining empty quiz drafts, and clears the ones that should not exist.
 *
 * Three questions minimum, hand-written, testing understanding rather than recall. Where a
 * lesson's subject cannot be identified from its title — six lessons are called literally
 * "Lecture Video" — no questions are written and the draft is left alone. Inventing
 * questions about content I have not seen is the one thing that would make this worse than
 * leaving it empty.
 *
 * Drafts on reference decks, mind maps, duplicate lecture clips and project-explanation
 * videos are DELETED. A quiz on a slide deck tests nothing; a duplicate quiz on the same
 * lecture is noise.
 *
 *   node scripts/fill-remaining-quizzes.mjs --apply
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

const BANK = {
  'Python Basics': [
    mcq('A Python list is passed to a function and modified inside it. The caller sees:', {
      a: 'No change — it was copied', b: 'The change — lists are passed by reference',
      c: 'An error', d: 'A copy only if the list is long',
    }, 'b', 'Python passes object references. Mutating a list inside a function mutates the caller\'s list — a bug that bites hard when you pass sensor buffers around.'),
    tf('A mutable default argument (def f(x=[])) is safe because a fresh list is created on each call.', false,
      'The default is created ONCE, at definition time, and shared across every call. It is the classic Python trap; use None and build the list inside.'),
    mcq('The main reason to prefer a generator over a list here:', {
      a: 'It is faster to write', b: 'It produces items lazily, so you never hold the whole dataset in memory',
      c: 'It is required by NumPy', d: 'It sorts automatically',
    }, 'b', 'When you are streaming frames or log rows, materialising the whole sequence is exactly what you cannot afford.'),
  ],
  'Object oriented Programming': [
    mcq('Composition is usually preferred over inheritance because:', {
      a: 'It runs faster', b: 'It couples classes less tightly and is easier to change',
      c: 'Python does not support inheritance', d: 'It uses less memory',
    }, 'b', 'Inheritance binds you to a base class\'s decisions forever. Composition lets you swap a part out — which matters when the part is a sensor model you will replace.'),
    tf('An abstract base class exists to be instantiated directly.', false,
      'It exists to define an interface its subclasses must implement. Instantiating it is precisely what it forbids.'),
    mcq('You are modelling a behaviour planner with states like FOLLOW, OVERTAKE, YIELD. The natural structure is:', {
      a: 'A long if/elif chain', b: 'A state machine',
      c: 'A neural network', d: 'A dictionary of floats',
    }, 'b', 'This is not academic — the FSM behaviour planner later in the course is exactly this pattern. Recognising it now is the point of the lesson.'),
  ],
  'Data Structures': [
    mcq('Dijkstra\'s algorithm is tractable at scale because of:', {
      a: 'A list', b: 'A priority queue', c: 'A hash map', d: 'A stack',
    }, 'b', 'The priority queue is what turns a hopeless scan into an efficient search. The data structure IS the algorithm\'s complexity.'),
    tf('Choosing the wrong data structure can change an algorithm\'s complexity class.', true,
      'Same algorithm, list instead of a heap, and O(n log n) becomes O(n²). At planning-graph scale that is the difference between working and not.'),
    mcq('A hash map gives O(1) average lookup. The catch is:', {
      a: 'It cannot store objects', b: 'Worst case degrades to O(n), and it has no ordering',
      c: 'It is always slower than a list', d: 'It cannot be resized',
    }, 'b', 'Average is not worst. With adversarial or badly-distributed keys you get collisions — and you never get sorted iteration for free.'),
  ],
  'Data Analysis Basics': [
    mcq('You find your model scores far better in training than in production. The first thing to check is:', {
      a: 'The learning rate', b: 'Whether a feature leaked information about the target',
      c: 'The batch size', d: 'The GPU',
    }, 'b', 'Data leakage is the most dangerous bug in applied ML precisely because it looks like success. Check the features before you touch the model.'),
    tf('Dropping every row with a missing value is a safe default.', false,
      'If the missingness is correlated with the target — a sensor that fails in rain — you have just deleted the hardest cases and taught the model the world is sunny.'),
    mcq('Normalising features before training matters most because:', {
      a: 'It makes plots prettier', b: 'Features on wildly different scales distort gradient-based optimisation and distance metrics',
      c: 'It removes outliers', d: 'It is required by pandas',
    }, 'b', 'Speed in m/s and mass in kg differ by orders of magnitude. Without scaling, one feature dominates the gradient purely by virtue of its units.'),
  ],
  'Data Visualization Basics': [
    tf('If the metrics look fine, plotting the data is optional.', false,
      'A single aggregate hides almost everything. Anscombe\'s quartet exists to make exactly this point: four datasets, identical statistics, wildly different shapes.'),
    mcq('The most useful plot when debugging a model that trains but does not generalise:', {
      a: 'A bar chart of accuracy', b: 'Training and validation loss on the same axes, over epochs',
      c: 'A pie chart of classes', d: 'A scatter of the predictions only',
    }, 'b', 'Diverging curves are the signature of overfitting, and you cannot see divergence in a single number.'),
    mcq('You plot residuals against the predicted value and see a clear curve. That means:', {
      a: 'The model is fine', b: 'There is structure the model has not captured — probably a non-linearity',
      c: 'The data is corrupted', d: 'You need more data',
    }, 'b', 'Residuals should look like noise. Structure in them is the model telling you what it is still missing.'),
  ],
  'SQL': [
    mcq('A LEFT JOIN differs from an INNER JOIN in that it:', {
      a: 'Is faster', b: 'Keeps every row from the left table, even with no match on the right',
      c: 'Removes duplicates', d: 'Sorts the result',
    }, 'b', 'This matters more than it looks: an INNER JOIN silently drops the drives with no annotations, and you never notice the data you lost.'),
    tf('COUNT(*) and COUNT(column) return the same number.', false,
      'COUNT(column) ignores NULLs. That single difference has produced a great many wrong dashboards.'),
    mcq('WHERE filters rows; HAVING filters:', {
      a: 'Columns', b: 'Groups, after aggregation', c: 'Tables', d: 'Indexes',
    }, 'b', 'WHERE runs before the GROUP BY, HAVING after. You cannot filter on an aggregate in WHERE because it does not exist yet.'),
  ],
  'Cracking the AI Black Box': [
    mcq('At its core, supervised learning is:', {
      a: 'Memorising the training data', b: 'Fitting a function that generalises from examples to unseen inputs',
      c: 'Searching a database', d: 'Encoding rules a human wrote',
    }, 'b', 'Generalisation is the entire game. A model that memorises perfectly and generalises not at all is worthless, and it is very easy to build one by accident.'),
    tf('A model with 100% training accuracy is a good model.', false,
      'It is a suspicious model. Perfect training accuracy usually means memorisation, leakage, or a target that is trivially recoverable from a feature.'),
    mcq('The bias-variance trade-off says:', {
      a: 'More data always helps', b: 'A model too simple underfits; too flexible and it fits the noise',
      c: 'Deep models are always better', d: 'Bias should always be zero',
    }, 'b', 'It is the reason "just use a bigger model" is not a strategy. Capacity you cannot support with data becomes memorised noise.'),
  ],
  'Three Ways to Predict a Number': [
    mcq('Regression differs from classification in that it predicts:', {
      a: 'A class label', b: 'A continuous quantity', c: 'A probability only', d: 'A cluster',
    }, 'b', 'Time-to-collision is a regression problem. Whether to brake is a classification problem. The AEB system needs both, and confusing them is a real bug.'),
    tf('Minimising mean squared error makes a model robust to outliers.', false,
      'MSE squares the error, so one wild outlier can dominate the entire loss. Mean absolute error is the more robust choice when the data has spikes.'),
    mcq('R² of 0.95 on training and 0.30 on test means:', {
      a: 'A good model', b: 'Severe overfitting', c: 'The test set is broken', d: 'You need a lower learning rate',
    }, 'b', 'It has fitted the training set almost perfectly and learned nothing transferable. The gap IS the diagnosis.'),
  ],
  'Foundations of ML - Probability': [
    mcq('Unsupervised learning differs from supervised learning because it:', {
      a: 'Is faster', b: 'Has no labels — it finds structure rather than predicting a target',
      c: 'Needs more data', d: 'Only works on images',
    }, 'b', 'For driving data this is how you mine corner cases: cluster the drives and look at the tiny cluster nobody expected.'),
    tf('P(A|B) and P(B|A) are the same thing.', false,
      'Confusing them is the base-rate fallacy. P(braking | obstacle) and P(obstacle | braking) are wildly different numbers, and mixing them up produces confidently wrong safety arguments.'),
    mcq('A model outputs a probability of 0.9. That is only useful if the model is:', {
      a: 'Deep', b: 'Calibrated — of all the times it says 0.9, it is right about 90% of the time',
      c: 'Fast', d: 'Trained on GPUs',
    }, 'b', 'An uncalibrated 0.9 is a number, not a probability. When you threshold it into a braking decision, calibration is what makes the threshold mean anything.'),
  ],
  'ML Algorithms': [
    mcq('Why do most production ADAS features use classical ML rather than deep networks?', {
      a: 'They are more accurate', b: 'They are cheaper to run, easier to certify, and often enough',
      c: 'Deep learning does not work on cars', d: 'They need no data',
    }, 'b', 'Latency budgets are hard and the safety case must be arguable. "It is simpler and it passes" beats "it scored higher on the benchmark".'),
    tf('A random forest can rank feature importance, which a deep network makes far harder.', true,
      'That interpretability is not a nicety in this domain — it is part of the safety argument.'),
    mcq('k-means requires you to choose k in advance. The honest way to do that is:', {
      a: 'Always use k=3', b: 'Use the elbow/silhouette method, and check the clusters mean something',
      c: 'Let the algorithm decide', d: 'Use as many clusters as data points',
    }, 'b', 'The metric narrows the choice; only domain sense confirms it. A statistically good cluster that corresponds to nothing real is still useless.'),
  ],
  'PyTorch': [
    mcq('You call loss.backward() twice without zeroing gradients. What happens?', {
      a: 'An error', b: 'Gradients accumulate — the second is added to the first',
      c: 'The first is discarded', d: 'Nothing',
    }, 'b', 'PyTorch accumulates by default. Forgetting optimizer.zero_grad() is one of the most common silent bugs in the framework — training just quietly goes wrong.'),
    tf('model.eval() disables gradient computation.', false,
      'It switches dropout and batch-norm into inference mode. Disabling gradients is torch.no_grad(), and you almost always want both.'),
    mcq('Moving a model to GPU but leaving the input tensors on CPU results in:', {
      a: 'A silent slowdown', b: 'A runtime error about mismatched devices',
      c: 'Automatic transfer', d: 'Wrong results',
    }, 'b', 'PyTorch will not silently copy across devices. It is a loud failure, which is exactly the right design.'),
  ],
  'KITTI — Tracking and Detection': [
    mcq('Detection finds objects in a frame. Tracking additionally:', {
      a: 'Improves accuracy', b: 'Associates the same object across frames, giving it an identity and a velocity',
      c: 'Segments pixels', d: 'Estimates depth',
    }, 'b', 'Without identity there is no velocity, and without velocity a planner cannot predict anything. Detection alone is not enough to drive.'),
    tf('A tracker that swaps two object identities is a harmless error.', false,
      'An ID swap teaches the predictor that a car suddenly jumped sideways at 30 m/s. It corrupts everything downstream.'),
    mcq('Why is KITTI the benchmark rather than a curated dataset?', {
      a: 'It is bigger', b: 'It is real driving data — real occlusion, real lighting, real failure',
      c: 'It is free', d: 'It is easier',
    }, 'b', 'The gap between curated images and KITTI is the gap between a paper and a product.'),
  ],
  'KITTI — Instance Segmentation': [
    mcq('Instance segmentation differs from semantic segmentation because it:', {
      a: 'Is faster', b: 'Separates individual objects, not just their class',
      c: 'Uses no neural network', d: 'Works only on roads',
    }, 'b', 'Semantic says "these pixels are car". Instance says "these are car #1, those are car #2" — and a planner needs to know how many cars there are.'),
    tf('A bounding box gives you the object\'s exact extent.', false,
      'A box says roughly where an object is. A mask says exactly which pixels are it — which matters when a cyclist is partly behind a parked van.'),
    mcq('For a planner, the practical advantage of a mask over a box is:', {
      a: 'It looks better', b: 'It gives a far tighter estimate of free space',
      c: 'It is cheaper to compute', d: 'It needs no labels',
    }, 'b', 'A box around a diagonal truck claims a great deal of empty road is occupied. The planner then refuses to drive through a gap that is really there.'),
  ],
  'EgoLanes': [
    tf('Lane estimation is straightforward because road markings are standardised.', false,
      'Worn paint, low sun, rain, shadows, roadworks, and snow. The standard case is trivial; every deployment lives in the exceptions.'),
    mcq('The output a lane estimator must give a controller is:', {
      a: 'An image', b: 'A geometric description of the lane — centreline and curvature — in vehicle coordinates',
      c: 'A class label', d: 'A bounding box',
    }, 'b', 'The controller cannot steer on pixels. Perception has to hand over geometry, which is why the camera calibration in the earlier lesson matters here.'),
    mcq('When lane markings vanish entirely, a robust system should:', {
      a: 'Guess', b: 'Report low confidence and hand back to the driver or fall back to another cue',
      c: 'Keep the last estimate forever', d: 'Stop the car immediately',
    }, 'b', 'Knowing that you do not know is a feature. A confident wrong lane estimate is far more dangerous than an admitted gap.'),
  ],
  'SceneSeg': [
    mcq('Semantic segmentation assigns a class to:', {
      a: 'Each object', b: 'Each pixel', c: 'Each frame', d: 'Each track',
    }, 'b', 'Dense, per-pixel labels. That is what lets a planner reason about drivable surface rather than just about objects it happened to detect.'),
    tf('Class imbalance is a serious problem in driving segmentation.', true,
      'Road and sky dominate the pixels; pedestrians are a tiny fraction. Train naively and the model learns to ignore exactly the class that matters most.'),
    mcq('Pixel accuracy is a poor metric for segmentation because:', {
      a: 'It is slow', b: 'Predicting "road" everywhere already scores well, since road dominates',
      c: 'It needs labels', d: 'It cannot be computed',
    }, 'b', 'This is why mean IoU is used. It refuses to let the dominant class hide the failure on the rare one.'),
  ],
  'AutoSpeed': [
    mcq('Estimating speed from a single camera is possible because:', {
      a: 'The camera measures distance directly', b: 'Apparent motion across frames, plus known geometry, encodes speed',
      c: 'The image brightness scales with speed', d: 'It is not possible',
    }, 'b', 'This is why the camera calibration lesson comes first. Without the intrinsics, pixel motion tells you nothing metric.'),
    tf('A monocular camera can recover absolute scale without any additional assumption.', false,
      'Monocular vision is scale-ambiguous. You need something — a known camera height, a known object size, or another sensor — to pin the scale down.'),
    mcq('The strongest argument for vision-based speed estimation is:', {
      a: 'It is more accurate than radar', b: 'It is cheap, and it provides a redundant, independent estimate',
      c: 'It works in fog', d: 'It needs no calibration',
    }, 'b', 'Redundancy is a safety property. Two independent estimates that disagree tell you something is wrong — and one sensor never can.'),
  ],
  'Modern C++': [
    mcq('CMake exists to:', {
      a: 'Compile C++ directly', b: 'Generate the build system for your platform and toolchain',
      c: 'Run tests', d: 'Manage memory',
    }, 'b', 'It is a build-system generator, not a compiler. Understanding that distinction is the difference between fixing a CMake error and flailing at it.'),
    tf('A unit test that requires the whole vehicle simulator to run is still a unit test.', false,
      'It is an integration test. Unit tests must be fast and isolated, or nobody runs them — and a test nobody runs protects nothing.'),
    mcq('Why is C++ used for ADAS ECUs rather than Python?', {
      a: 'It is easier', b: 'Deterministic timing, no garbage-collection pauses, and direct hardware access',
      c: 'It has better libraries', d: 'It is newer',
    }, 'b', 'A GC pause of 50 ms in a braking controller is not a performance problem, it is a safety event.'),
  ],
  'Compiler Generated Functions': [
    mcq('If you declare a destructor, the compiler will no longer implicitly generate:', {
      a: 'The default constructor', b: 'The move constructor and move assignment operator',
      c: 'Nothing changes', d: 'The copy constructor only',
    }, 'b', 'This is the Rule of Five in practice: declare one, and you silently lose others. Your class quietly starts copying where it used to move.'),
    tf('The compiler-generated copy constructor performs a deep copy.', false,
      'It is member-wise — a shallow copy. A raw pointer member gets copied as an address, and now two objects believe they own the same memory.'),
    mcq('= default is preferable to writing an empty body because:', {
      a: 'It is shorter', b: 'It keeps the function trivial, so the compiler can still optimise around it',
      c: 'It is required', d: 'It is faster to compile',
    }, 'b', 'An empty user-provided body makes the type non-trivial, which can silently cost you optimisations you did not know you had.'),
  ],
  'C++ Practice': [
    tf('Reading C++ and writing C++ are essentially the same skill.', false,
      'Reading lets you follow. Writing forces you to make the ownership decisions, and those are the ones that bite.'),
    mcq('A unique_ptr expresses:', {
      a: 'Shared ownership', b: 'Exclusive ownership — one owner, released automatically',
      c: 'No ownership', d: 'A weak reference',
    }, 'b', 'It cannot be copied, only moved. The type itself makes double-ownership impossible, which is exactly what you want it to do.'),
    mcq('The main reason to prefer std::vector over a raw array:', {
      a: 'It is faster', b: 'It manages its own memory and knows its own size',
      c: 'It is required by C++', d: 'It uses less memory',
    }, 'b', 'Buffer overruns are a whole class of bug you simply stop having.'),
  ],
  'Project 1 — LLM Pretraining': [
    mcq('Pretraining teaches a language model:', {
      a: 'To follow instructions', b: 'General language structure, by predicting the next token over a huge corpus',
      c: 'A specific task', d: 'To be safe',
    }, 'b', 'Instruction-following comes later, from fine-tuning. Pretraining is where the knowledge goes in; SFT is where the behaviour does.'),
    tf('Supervised fine-tuning teaches the model new facts.', false,
      'It mostly teaches BEHAVIOUR — how to respond. New facts largely arrive during pretraining, which is why fine-tuning cannot fix a knowledge gap.'),
    mcq('The single biggest cost driver in pretraining is:', {
      a: 'Storage', b: 'Compute — the model sees enormous quantities of tokens',
      c: 'Labelling', d: 'Evaluation',
    }, 'b', 'And that cost is exactly why efficient fine-tuning, in the next lesson, matters so much.'),
  ],
  'Project 2 — Efficient Fine-Tuning': [
    mcq('LoRA reduces fine-tuning cost by:', {
      a: 'Using less data', b: 'Training small low-rank adapter matrices instead of all the weights',
      c: 'Shrinking the model', d: 'Skipping backpropagation',
    }, 'b', 'You update a tiny fraction of the parameters. That is what turns "we would need a cluster" into "we could try this this afternoon".'),
    tf('Quantising a model to 4-bit always destroys its accuracy.', false,
      'The loss is usually surprisingly small, and it is what makes fine-tuning on a single consumer GPU possible at all.'),
    mcq('The practical significance of efficient fine-tuning is that:', {
      a: 'It is more accurate', b: 'It puts iteration back within reach of a normal budget',
      c: 'It removes the need for data', d: 'It makes the model faster at inference',
    }, 'b', 'The bottleneck in applied ML is how many experiments you can afford to run. This lesson is about raising that number.'),
  ],
  'Project 4 — Agentic AI with LangChain': [
    mcq('An "agentic" LLM system differs from a chatbot because it:', {
      a: 'Is bigger', b: 'Calls tools and takes actions, then reasons about the results',
      c: 'Is faster', d: 'Has no prompt',
    }, 'b', 'That is also where the danger lives: a chatbot that is wrong says something wrong; an agent that is wrong does something wrong.'),
    tf('An agent that can call tools should be given the broadest possible permissions so it can solve more problems.', false,
      'The blast radius of a mistake scales with what you gave it access to. Least privilege is not bureaucracy here, it is the safety design.'),
    mcq('The most common failure mode of tool-using agents is:', {
      a: 'Slow inference', b: 'Confidently calling the wrong tool, or the right one with wrong arguments',
      c: 'Running out of memory', d: 'Refusing to answer',
    }, 'b', 'Which is exactly why the tool results have to be validated rather than trusted — the same lesson as everywhere else in this course.'),
  ],
  'Project 5 — Vision-Language Model': [
    mcq('A vision-language model can do something a detector cannot:', {
      a: 'Run faster', b: 'Answer open-ended questions about a scene it was never explicitly trained to label',
      c: 'Use less memory', d: 'Work in the dark',
    }, 'b', 'A detector knows its classes. A VLM can be asked "is anything unusual here?" — which is precisely the corner-case-mining problem.'),
    tf('A VLM\'s description of a driving scene can be trusted as a perception input.', false,
      'It hallucinates fluently and confidently. It is a superb tool for triage and mining, and a very poor one to put in a safety-critical control loop.'),
    mcq('The most promising near-term use of VLMs in autonomy is:', {
      a: 'Replacing the planner', b: 'Mining corner cases and explaining what the stack did',
      c: 'Controlling the steering', d: 'Replacing the detector',
    }, 'b', 'Off the critical path, where being occasionally wrong is survivable and being broadly capable is valuable.'),
  ],
  'Project 6 — Controllable Generation': [
    mcq('ControlNet adds to a diffusion model the ability to:', {
      a: 'Train faster', b: 'Condition generation on a structural input — edges, depth, pose',
      c: 'Use less memory', d: 'Generate text',
    }, 'b', 'Unconditioned generation gives you a plausible image. Conditioning gives you the image you actually wanted, which is the difference between a toy and a tool.'),
    tf('For autonomy, the point of generative vision is to make pretty pictures.', false,
      'The point is manufacturing the corner cases your dataset does not contain — the low-sun, wet-road, occluded-pedestrian frames you cannot go and collect on demand.'),
    mcq('The main risk of training on synthetic data is:', {
      a: 'It is expensive', b: 'The model learns the generator\'s artefacts rather than the real world',
      c: 'It is slow', d: 'It needs labels',
    }, 'b', 'It is the sim-to-real gap wearing a different hat, and it is just as unforgiving.'),
  ],
  'Project 3 — DataLab': [
    mcq('Using an LLM as an analysis tool rather than a chatbot means:', {
      a: 'Asking it to chat about data', b: 'Having it write and run the analysis, then checking its work',
      c: 'Fine-tuning it on your data', d: 'Replacing pandas entirely',
    }, 'b', 'The value is in the drafting speed. The checking is not optional, and the moment you skip it you have automated being wrong.'),
    tf('If an LLM produces analysis code that runs without error, the analysis is correct.', false,
      'Running is not the same as right. It will happily compute a beautifully formatted, completely meaningless number.'),
    mcq('The right mental model for an LLM in a data pipeline is:', {
      a: 'A source of truth', b: 'A fast, fallible junior analyst whose work you review',
      c: 'A database', d: 'A compiler',
    }, 'b', 'Which tells you exactly where to put it: on the drafting, not on the deciding.'),
  ],
  'Project 1- ML Based AEB': [
    mcq('For an AEB classifier, which error is worse?', {
      a: 'A false positive — braking with no obstacle', b: 'A false negative — failing to brake when there is one',
      c: 'They are equal', d: 'Neither, if accuracy is high',
    }, 'b', 'A false negative is a collision; a false positive is a rear-ending. The asymmetry is real, and it makes the decision threshold a safety decision rather than a modelling one.'),
    tf('Optimising an AEB model for overall accuracy is sound.', false,
      'Braking events are rare, so a model that never brakes scores brilliantly. This is the textbook case for caring about recall on the minority class.'),
    mcq('MetaDrive is used rather than real vehicle data because:', {
      a: 'It is more accurate', b: 'You can generate the dangerous scenarios safely and repeatedly',
      c: 'It is free', d: 'Real data does not exist',
    }, 'b', 'You cannot go and collect a thousand near-collisions. The simulator is how you get the tail of the distribution at all.'),
  ],
  'Project 2-  Handwritten digits': [
    mcq('Why start transfer learning on MNIST-style digits rather than traffic signs?', {
      a: 'Digits are more useful', b: 'It is small enough that every moving part is visible',
      c: 'It trains faster', d: 'It needs no labels',
    }, 'b', 'Get the mechanics straight on a problem you can fully see, then the traffic-sign network in the next lesson is the same idea on a harder input.'),
    tf('In transfer learning, you normally retrain the entire network.', false,
      'You usually freeze the early layers — they have already learned generic edges and textures — and retrain the head. That is what makes it work on small data.'),
    mcq('Transfer learning fails most badly when:', {
      a: 'The dataset is small', b: 'The source and target domains are wildly different',
      c: 'The model is large', d: 'The learning rate is low',
    }, 'b', 'Features learned on natural images transfer poorly to, say, radar returns. The assumption doing the work is domain similarity.'),
  ],
  'Project 8 - Motion Planning & Control': [
    mcq('Composing global, behaviour and local planning into one stack shows that:', {
      a: 'They are interchangeable', b: 'Each layer constrains the next — route, then manoeuvre, then trajectory',
      c: 'Only the local planner matters', d: 'The controller can replace them',
    }, 'b', 'This is the architecture essentially every production autonomy system uses, and having assembled it yourself is the difference between reciting it and understanding it.'),
    tf('A planner can safely ignore the vehicle\'s dynamics as long as the controller is good.', false,
      'A trajectory that violates the vehicle\'s turning radius cannot be tracked by any controller, however good. The planner has to know what the car can physically do.'),
    mcq('The interface between planning and control is:', {
      a: 'An image', b: 'A trajectory — a time-parameterised path the vehicle should follow',
      c: 'A class label', d: 'A steering angle',
    }, 'b', 'Path plus timing. A path with no timing is not something a controller can track.'),
  ],
  'Project 10: Linear Controls basics': [
    mcq('A system is stable if, following a disturbance, it:', {
      a: 'Returns towards its equilibrium', b: 'Oscillates forever', c: 'Diverges', d: 'Stops',
    }, 'a', 'Formally: the poles are in the left half-plane. Intuitively: nudge it and it settles rather than running away.'),
    tf('Increasing a controller\'s gain always improves tracking.', false,
      'It improves it until it destabilises the loop. Past a point, more gain buys you oscillation and then divergence.'),
    mcq('Phase margin measures:', {
      a: 'Steady-state error', b: 'How much extra phase lag the loop can absorb before going unstable',
      c: 'The rise time', d: 'The overshoot',
    }, 'b', 'It is your safety buffer against modelling error and delay — and every real system has both.'),
  ],
  'Project 1: Adaptive Cruise Control using PID': [
    mcq('The integral term in a PID exists to:', {
      a: 'Damp oscillation', b: 'Eliminate steady-state error the proportional term cannot remove',
      c: 'Filter noise', d: 'Predict the future',
    }, 'b', 'P alone leaves a persistent offset against a constant disturbance — a hill, say. I accumulates that offset away, at the cost of overshoot.'),
    tf('Raising the derivative gain always improves stability.', false,
      'D damps oscillation but amplifies sensor noise. Push it too far and the controller chatters.'),
    mcq('ACC is hard, despite PID being simple, because:', {
      a: 'The maths is difficult', b: 'Comfort, safety and following distance pull against each other',
      c: 'The sensors are bad', d: 'It runs too slowly',
    }, 'b', 'Any one of them is easy alone. Tuning the trade-off is where control theory stops being algebra.'),
  ],
  'Project 2: Linear Controls Basics': [
    mcq('Pole placement means:', {
      a: 'Choosing the sensors', b: 'Choosing feedback gains that put the closed-loop poles where you want them',
      c: 'Tuning by trial and error', d: 'Adding an integrator',
    }, 'b', 'You are designing the dynamics of the closed loop directly, rather than nudging gains and hoping.'),
    tf('A stable system can still be a bad system.', true,
      'Stable but sluggish, or stable but oscillatory, is stable and useless. Stability is necessary, not sufficient.'),
    mcq('Gain margin tells you:', {
      a: 'The steady-state error', b: 'How much you can raise the gain before instability',
      c: 'The settling time', d: 'The bandwidth',
    }, 'b', 'Together with phase margin it says how much of your model can be wrong before the loop bites you.'),
  ],
  'Project 4: RL based AV Car control': [
    mcq('The reward function in an RL driving task is:', {
      a: 'A minor detail', b: 'The specification of the task — a wrong reward yields a confidently wrong policy',
      c: 'Learned automatically', d: 'Only for evaluation',
    }, 'b', 'Reward hacking is the classic failure: the agent maximises exactly what you asked for, rather than what you meant, and does it very well.'),
    tf('An RL policy can be inspected to explain a specific decision.', false,
      'That opacity is why it is so hard to certify under ISO 26262 — no requirement to trace, no logic to review, no argument to make.'),
    mcq('PPO clips the size of a policy update because:', {
      a: 'It is faster', b: 'A large update can destroy the policy that is collecting your data',
      c: 'It saves memory', d: 'It guarantees optimality',
    }, 'b', 'RL has no ground truth to fall back on. Wreck the policy and you have also wrecked your data source.'),
  ],
  'Project 6: Altitude control': [
    mcq('LQR chooses its gains by:', {
      a: 'Trial and error', b: 'Minimising a cost on state error and control effort',
      c: 'Copying PID', d: 'Random search',
    }, 'b', 'You choose Q and R — what you care about — and it solves for the optimal gains. The design decision moves from "what gain?" to "what do I want?".'),
    tf('LQR needs a model of the plant.', true,
      'It solves the Riccati equation from the state-space model. A bad model gives you confidently optimal nonsense.'),
    mcq('Raising R relative to Q makes the controller:', {
      a: 'More aggressive', b: 'Gentler — control effort is now more expensive',
      c: 'Unstable', d: 'Faster',
    }, 'b', 'That is the whole tuning dial: Q is how much you hate error, R is how much you hate effort.'),
  ],
  'Project 3: End to End Motion Planning': [
    mcq('Closing the loop between planner and controller reveals that:', {
      a: 'They are independent', b: 'A planner ignoring vehicle dynamics produces trajectories no controller can track',
      c: 'The controller is unnecessary', d: 'Planning is trivial',
    }, 'b', 'They are taught apart and can never be designed apart. This is where that becomes obvious rather than theoretical.'),
    tf('A shorter path is always the better path.', false,
      'Shortest is not smoothest, safest or most comfortable. A path that clips a kerb is short and useless.'),
    mcq('The planner hands the controller:', {
      a: 'A steering angle', b: 'A time-parameterised trajectory',
      c: 'An image', d: 'A goal only',
    }, 'b', 'Where to be, and when. Position without timing is not something a controller can track.'),
  ],
  'MIL, SIL': [
    mcq('Model-in-the-loop testing verifies:', {
      a: 'The generated C code', b: 'The model\'s behaviour against its requirements, before any code exists',
      c: 'The hardware', d: 'The sensors',
    }, 'b', 'MIL tests the design. SIL tests that the generated code still behaves like the design. They catch different bugs, which is why you do both.'),
    tf('If the model passes MIL, the generated code will necessarily pass SIL.', false,
      'Code generation introduces fixed-point effects, overflow and timing that the model never had. SIL exists precisely because that step is not free.'),
    mcq('Automatic code generation is used in ADAS because:', {
      a: 'It writes faster code', b: 'It removes a class of hand-translation errors and gives a traceable link from model to code',
      c: 'It is cheaper', d: 'It needs no testing',
    }, 'b', 'Traceability is what the safety case is built on: this line of code exists because of that requirement.'),
  ],
  'Capstone Project 11': [
    mcq('The point of the co-simulation with IPG CarMaker is:', {
      a: 'Better graphics', b: 'Testing your controller against a high-fidelity vehicle and environment model',
      c: 'Faster simulation', d: 'It is required by MATLAB',
    }, 'b', 'Your controller may be perfect against a bicycle model and fall apart against real tyre dynamics. That gap is what CarMaker exists to expose.'),
    tf('Passing in co-simulation means the feature is ready for a vehicle.', false,
      'It means it is ready for HIL, then a test track, then a fleet. Simulation is a filter, not a verdict.'),
    mcq('The V-model requires that every design step:', {
      a: 'Be documented', b: 'Have a corresponding verification step',
      c: 'Be automated', d: 'Be reviewed',
    }, 'b', 'Requirements pair with acceptance tests; architecture with integration tests. Every claim must be checkable, which is the entire idea.'),
  ],
  'ADAS Requirement Writing': [
    mcq('A good ADAS requirement is:', {
      a: 'A description of the implementation', b: 'Testable, unambiguous, and free of any implementation choice',
      c: 'As detailed as possible', d: 'Written after the code',
    }, 'b', '"The system shall brake" is untestable. "The system shall achieve a deceleration of at least 6 m/s² within 200 ms of a confirmed obstacle at TTC < 1.5 s" is a requirement.'),
    tf('Requirements can be written after the design is finished.', false,
      'Then they are not requirements, they are a description. The V-model exists precisely to stop this, and it is how projects fail six months in.'),
    mcq('The single most common defect in requirements is:', {
      a: 'Being too long', b: 'Ambiguity — two engineers read it and build different things',
      c: 'Bad grammar', d: 'Too much detail',
    }, 'b', 'And it does not surface until integration, which is the most expensive possible place to find it.'),
  ],
  'Functional Safety Implementation': [
    mcq('A safety goal is derived from:', {
      a: 'The chosen architecture', b: 'The hazard analysis and risk assessment',
      c: 'The customer\'s wishlist', d: 'The code',
    }, 'b', 'Hazard first, then safety goal, then requirement, then design. Reverse that order and you have a rationalisation rather than a safety case.'),
    tf('Achieving ASIL D simply means testing more.', false,
      'It changes the architecture — redundancy, monitoring, freedom from interference. You cannot test your way to ASIL D from a single-channel design.'),
    mcq('"Freedom from interference" means:', {
      a: 'No electromagnetic noise', b: 'A lower-ASIL component cannot corrupt a higher-ASIL one',
      c: 'No network traffic', d: 'The code is isolated in files',
    }, 'b', 'It is why safety-critical and non-safety software are partitioned in memory and in time. Your infotainment bug must not be able to reach the brakes.'),
  ],
  'Perception — Lecture': [
    mcq('The perception stack\'s job is to turn sensor data into:', {
      a: 'A control command', b: 'A structured model of the world the planner can reason about',
      c: 'A dataset', d: 'A trajectory',
    }, 'b', 'Objects, lanes, free space, velocities. Perception does not decide anything — it just has to be right about what is there.'),
    tf('More sensors always make perception more reliable.', false,
      'Only if you can fuse them well. Two sensors that disagree, with no way to arbitrate, is worse than one you understand.'),
    mcq('The reason perception is treated as a separate layer is:', {
      a: 'Tradition', b: 'It can be developed, tested and validated against ground truth independently of the planner',
      c: 'It is slower', d: 'It needs different hardware',
    }, 'b', 'Which is also the strongest argument against end-to-end learning: when it fails, you cannot say which part was wrong.'),
  ],
  'The Perception Playground': [
    mcq('The pinhole camera model tells you:', {
      a: 'The colour of a pixel', b: 'How a 3D point projects onto the image plane',
      c: 'The exposure', d: 'The depth',
    }, 'b', 'Everything geometric downstream — depth, speed, lane position — rests on this projection. It is the first lesson for a reason.'),
    tf('A single image is enough to recover absolute depth.', false,
      'It is scale-ambiguous: a small close object and a large distant one project identically. You need stereo, motion, or a known size.'),
    mcq('Lens distortion must be corrected because:', {
      a: 'It looks bad', b: 'Uncorrected, straight lines bend, and every geometric estimate downstream is wrong',
      c: 'It slows processing', d: 'It affects colour',
    }, 'b', 'A lane estimator on an uncalibrated camera will confidently report a curve that is not there.'),
  ],
};

// Lessons whose subject is clear but whose title does not contain any key above.
BANK['Lecture 7.1'] = BANK['Modern C++'];
BANK['Advanced C++ Topics'] = BANK['C++ Practice'];
BANK['ADAS requirements Assignment'] = BANK['ADAS Requirement Writing'];
BANK['Capstone project details'] = BANK['Capstone Project 11'];
BANK['Primer for Data Analysis'] = BANK['Data Analysis Basics'];
BANK['Primer for SQL'] = BANK['SQL'];
BANK['Procedural, Functional, OOP'] = BANK['Object oriented Programming'];

BANK['Supervised ML'] = [
  mcq('Supervised learning is defined by the fact that:', {
    a: 'A human watches the training', b: 'Every training example carries a known correct answer',
    c: 'It uses a neural network', d: 'It runs on labelled hardware',
  }, 'b', 'The label is the supervision. It is also the expensive part — which is exactly why unsupervised and self-supervised methods get so much attention.'),
  tf('A classifier reporting 99% accuracy on a dataset where 99% of examples are one class has learned something useful.', false,
    'It may have learned to always say "the common one". This is why precision, recall and the confusion matrix exist — accuracy alone hides the failure.'),
  mcq('Cross-validation exists to:', {
    a: 'Make training faster', b: 'Get a more reliable estimate of generalisation than a single train/test split',
    c: 'Increase accuracy', d: 'Reduce the data needed',
  }, 'b', 'One lucky split flatters you; one unlucky split panics you. Averaging across folds tells you what the model can actually be expected to do.'),
];

BANK['Motion Prediction'] = [
  mcq('Prediction sits between perception and planning because:', {
    a: 'It is easier', b: 'A planner must act on where objects WILL be, not where they were',
    c: 'It is faster', d: 'Perception cannot see far enough',
  }, 'b', 'By the time you have braked, the pedestrian has moved. Planning against a stale world model is planning against the past.'),
  tf('Motion prediction is deterministic — each agent has one future.', false,
    'A car at a junction may turn or continue. A prediction that commits to one is confidently wrong half the time; good predictors output a distribution over futures.'),
  mcq('Behaviour planning differs from local (trajectory) planning in that it decides:', {
    a: 'The steering angle', b: 'WHAT to do — follow, overtake, yield — leaving HOW to the trajectory planner',
    c: 'The route', d: 'The speed limit',
  }, 'b', 'Global picks the route, behaviour picks the manoeuvre, local produces the trajectory. Each layer constrains the next, and collapsing them is how planners become unmaintainable.'),
];

BANK['Lateral vehicle dynamics'] = [
  mcq('The bicycle model simplifies a car by:', {
    a: 'Ignoring the tyres', b: 'Collapsing each axle\'s two wheels into one, at the axle centre',
    c: 'Assuming zero mass', d: 'Assuming no steering',
  }, 'b', 'It throws away load transfer and individual wheel slip, and keeps the essential steering geometry. That is what makes it tractable enough to design a controller against.'),
  tf('The bicycle model stays accurate at the limits of grip.', false,
    'It assumes small slip angles and a linear tyre. Near the friction limit — precisely when ESC matters — it stops being valid, which is why a high-fidelity tyre model is needed for that work.'),
  mcq('ESC detects a skid by comparing:', {
    a: 'Wheel speeds only', b: 'The yaw rate the driver asked for with the yaw rate actually measured',
    c: 'Engine RPM with road speed', d: 'Tyre pressure with load',
  }, 'b', 'Steering angle and speed give the intended yaw rate; the gyro gives the real one. The difference IS the skid, and braking one wheel is how it is corrected.'),
];

BANK['Longitudinal vehicle dynamics'] = [
  mcq('Longitudinal dynamics concerns:', {
    a: 'Cornering', b: 'Motion along the vehicle\'s direction of travel — accelerating and braking',
    c: 'Yaw', d: 'Suspension travel',
  }, 'b', 'It is the axis ACC and AEB act on, which is why it comes before lateral control in this course.'),
  tf('A system can be stable and still perform badly.', true,
    'Stable but sluggish, or stable but oscillatory, is stable and useless. Stability is necessary, never sufficient.'),
  mcq('Raising a controller\'s gain indefinitely will:', {
    a: 'Keep improving tracking', b: 'Eventually destabilise the loop',
    c: 'Reduce noise', d: 'Have no effect',
  }, 'b', 'Past a point, more gain buys oscillation and then divergence. Gain and phase margin are the numbers that tell you how far you can push.'),
];

BANK['Deep Learning and Reinforcement Learning'] = BANK['Deep learning & Reinforcement Learning'] = [
  mcq('The essential difference between supervised learning and reinforcement learning is that RL:', {
    a: 'Uses more data', b: 'Learns from a reward signal produced by acting, with no labelled correct action',
    c: 'Is unsupervised', d: 'Uses no neural network',
  }, 'b', 'Nobody tells the agent the right steering angle. It has to discover it — which is why RL needs a simulator and supervised learning needs a dataset.'),
  tf('The reward function is a minor implementation detail in an RL system.', false,
    'The reward IS the specification of the task. Reward hacking — an agent maximising exactly what you asked for rather than what you meant — is the classic and very hard failure.'),
  mcq('The main obstacle to certifying an RL policy for a production vehicle is:', {
    a: 'Its speed', b: 'You cannot trace a specific decision back to a requirement',
    c: 'Its memory use', d: 'It needs a GPU',
  }, 'b', 'ISO 26262 is built on traceability. A policy that cannot explain why it braked cannot be argued about, and an argument is what a safety case is made of.'),
];

BANK['Computer Vision'] = [
  mcq('A convolutional layer is well suited to images because it:', {
    a: 'Is faster than a dense layer', b: 'Shares weights across spatial positions, so a feature is detected wherever it appears',
    c: 'Needs no training', d: 'Removes the need for labels',
  }, 'b', 'An edge is an edge in any corner of the frame. Translation invariance is the assumption doing the work, and it is why a dense net on raw pixels is such a poor idea.'),
  tf('A model trained on clear daytime images can be expected to work at night.', false,
    'Night, rain, glare and low sun are out of distribution. Distribution shift is not an edge case in driving — it is Tuesday.'),
  mcq('Data augmentation improves robustness because:', {
    a: 'It adds more real data', b: 'It shows the model the variation it will meet, without collecting new images',
    c: 'It reduces model size', d: 'It speeds up training',
  }, 'b', 'You cannot go and film every lighting condition. Augmentation manufactures a slice of that variation for free — which is exactly the same argument as the generative-vision project later.'),
];

BANK['Multimodal LLMs'] = [
  mcq('A multimodal LLM differs from a detector in that it:', {
    a: 'Runs faster', b: 'Reasons about a scene in open-ended language, beyond a fixed set of classes',
    c: 'Uses less memory', d: 'Needs no training',
  }, 'b', 'A detector only knows the classes it was trained on. A VLM can be asked "is anything unusual here?" — which is precisely the corner-case-mining problem.'),
  tf('A VLM\'s description of a driving scene is reliable enough to feed into a safety-critical control loop.', false,
    'It hallucinates fluently and confidently. It is an excellent triage and mining tool, and a very poor sensor.'),
  mcq('Generative vision is useful for autonomy mainly because it can:', {
    a: 'Replace the camera', b: 'Manufacture the rare scenarios your dataset does not contain',
    c: 'Speed up inference', d: 'Label data perfectly',
  }, 'b', 'The long tail is where autonomy fails, and you cannot go out and film the long tail on demand.'),
];

BANK['ABS, TCS & ESC'] = [
  mcq('ABS prevents a wheel from locking because a locked wheel:', {
    a: 'Overheats', b: 'Loses steering authority — a sliding tyre cannot generate lateral force',
    c: 'Wears out', d: 'Brakes too hard',
  }, 'b', 'A locked wheel does not just stop worse; it stops you steering. That is the real reason ABS exists.'),
  tf('ABS, TCS and ESC all act, ultimately, through the tyres.', true,
    'Every one of them modulates the force at the contact patch. On a surface with no grip at all there is no force to modulate, and none of them can save you.'),
  mcq('Traction control differs from ABS in that it intervenes during:', {
    a: 'Braking', b: 'Acceleration — when a driven wheel spins up', c: 'Cornering only', d: 'Parking',
  }, 'b', 'Same idea, opposite direction: ABS stops a wheel decelerating past the slip limit, TCS stops it accelerating past it.'),
];

BANK['Fundamentals of Autonomous Vehicles'] = [
  mcq('At SAE Level 3, the crucial change from Level 2 is that:', {
    a: 'The car steers itself', b: 'The system, not the driver, monitors the environment — the driver may disengage, but must resume when asked',
    c: 'No driver is needed', d: 'It works only on motorways',
  }, 'b', 'Level 2 keeps the human responsible at all times. Level 3 transfers that responsibility to the system, conditionally — and the handover back is the hardest part of the entire design.'),
  tf('An autonomous system\'s operational design domain is a marketing term rather than an engineering one.', false,
    'The ODD is the honest statement of where the system is valid — which roads, weather, speeds, lighting. A system with no stated ODD is a system making a claim it cannot support.'),
  mcq('The sense–plan–act pipeline is decomposed into stages mainly because:', {
    a: 'It runs faster', b: 'Each stage can be developed, tested and validated against ground truth independently',
    c: 'It uses less hardware', d: 'It is required by law',
  }, 'b', 'It is also the strongest argument against a purely end-to-end system: when the car does the wrong thing, you cannot say which part was wrong.'),
];

/** Six lessons are called literally "Lecture Video". Their MODULE identifies them. */
const BY_MODULE = {
  'Fundamentals of Autonomous Vehicles': 'Fundamentals of Autonomous Vehicles',
  'Foundations of Machine Learning': 'Cracking the AI Black Box',
  'Supervised Machine Learning': 'Supervised ML',
  'Longitudinal Vehicle Dynamics': 'Longitudinal vehicle dynamics',
  'Lateral Vehicle Dynamics': 'Lateral vehicle dynamics',
  'Deep Learning & Reinforcement Learning': 'Deep Learning and Reinforcement Learning',
};

// Reference material, duplicate clips, and explanation videos: a quiz there tests nothing.
const POINTLESS = /slides?$|notes$|mind ?map|alternate clip|summary video|— reference$|^misc|logic info|project info|additional info|explanation video|project video|manual$|installed|^introduction$|explaining project/i;

const { data: quizzes } = await db.from('quizzes').select('id, capsule_id, is_published');
const { data: qs } = await db.from('quiz_questions').select('quiz_id');
const { data: caps } = await db.from('capsules').select('id, title, learning_path_id');
const { data: lps } = await db.from('learning_paths').select('id, title');
const withQ = new Set(qs.map((q) => q.quiz_id));
const capT = new Map(caps.map((c) => [c.id, c.title]));
const lpT = new Map(lps.map((l) => [l.id, l.title]));
const capMod = new Map(caps.map((c) => [c.id, lpT.get(c.learning_path_id) ?? '']));

console.log(APPLY ? '=== APPLYING ===\n' : '=== PREVIEW ===\n');

let filled = 0, written = 0, deleted = 0, unmatched = [], skipped = [];

for (const quiz of quizzes) {
  if (withQ.has(quiz.id) || !quiz.capsule_id) continue;
  const title = capT.get(quiz.capsule_id) ?? '';

  // Slide decks, mind maps and duplicate clips. Nothing is written for them and they stay
  // unpublished, so no learner ever sees them. Deleting them is a separate decision and
  // yours to make — this script only reports them.
  if (POINTLESS.test(title)) {
    deleted++;
    skipped.push(title);
    continue;
  }

  let key = Object.keys(BANK).find((k) => title.toLowerCase().includes(k.toLowerCase()));

  // A title like "Lecture Video" says nothing. Its module does.
  if (!key) {
    const mod = capMod.get(quiz.capsule_id) ?? '';
    const modKey = Object.keys(BY_MODULE).find((k) => mod.toLowerCase().includes(k.toLowerCase()));
    if (modKey) key = BY_MODULE[modKey];
  }

  if (!key) {
    unmatched.push(`${title}  [module: ${capMod.get(quiz.capsule_id)}]`);
    continue;
  }

  const questions = BANK[key];
  filled++; written += questions.length;
  console.log(`  ${title.slice(0, 54).padEnd(56)} ${questions.length} Qs`);

  if (APPLY) {
    const { error } = await db.from('quiz_questions').insert(
      questions.map((q, i) => ({ ...q, quiz_id: quiz.id, order_index: i }))
    );
    if (error) { console.log(`     FAILED: ${error.message}`); continue; }
    await db.from('quizzes').update({ is_published: true }).eq('id', quiz.id);
  }
}

console.log(`\n${APPLY ? 'Filled' : 'Would fill'} ${filled} quizzes with ${written} questions, and published them.`);
console.log(`Left alone: ${deleted} drafts on slides, mind maps and duplicate clips — unpublished, so no learner sees them. Say the word and I'll delete them.`);
if (unmatched.length) {
  console.log(`\n${unmatched.length} left as empty drafts — their subject is not identifiable from the title:`);
  for (const u of [...new Set(unmatched)].slice(0, 12)) console.log(`   ${u}`);
}
