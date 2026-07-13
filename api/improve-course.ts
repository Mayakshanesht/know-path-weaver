import type { VercelRequest, VercelResponse } from '@vercel/node';
import { groq, structured, supabaseAsCaller } from './_lib/groq.js';

/**
 * The course improvement agent.
 *
 * It can do everything that has so far been done by hand: rename lessons from the
 * evidence inside them, write the intro that opens a lesson and the pointer that closes
 * it, write a module overview, write quiz questions, and split a bundled lesson into the
 * separate pieces of work it actually contains.
 *
 * Two rules shape the whole thing.
 *
 * It PROPOSES, never writes. This is paid content. A model that renames "Video 3" to
 * something plausible-but-wrong is worse than the placeholder, because the placeholder at
 * least admits it knows nothing — and a quiz that marks a right answer wrong destroys
 * trust in everything else on the platform.
 *
 * And it is aimed at UNDERSTANDING. A description that says "Runs in Colab" is a label; a
 * useful one says what you are about to do and why it comes here. A question that asks
 * what an acronym stands for tests nothing; a useful one asks what breaks if you get the
 * decision wrong. The prompt below is mostly an argument about that distinction.
 */

export const config = { maxDuration: 300 };

type Action = 'titles' | 'overviews' | 'quizzes' | 'structure';

const SCHEMA = {
  type: 'object',
  properties: {
    changes: {
      type: 'array',
      description: 'Renamed / re-described modules and lessons. Omit anything you would leave alone.',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['module', 'capsule'] },
          id: { type: 'string' },
          title: { type: 'string' },
          description: {
            type: 'string',
            description:
              'Two sentences. What this is, and why it comes HERE — what it builds on, or what it sets up.',
          },
          reason: { type: 'string' },
        },
        required: ['kind', 'id', 'title', 'description', 'reason'],
        additionalProperties: false,
      },
    },
    overviews: {
      type: 'array',
      description: 'A "what this module covers" lesson, for modules that have none.',
      items: {
        type: 'object',
        properties: {
          module_id: { type: 'string' },
          title: { type: 'string' },
          body: {
            type: 'string',
            description:
              'Markdown, 120-200 words. What the module covers, why it matters, what each lesson does, ' +
              'and — crucially — how it follows from the module before it and sets up the one after.',
          },
        },
        required: ['module_id', 'title', 'body'],
        additionalProperties: false,
      },
    },
    quizzes: {
      type: 'array',
      description: 'Questions for lessons whose subject you can actually identify. 3-5 per lesson.',
      items: {
        type: 'object',
        properties: {
          capsule_id: { type: 'string' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['mcq', 'true_false'] },
                question: { type: 'string' },
                options: {
                  type: 'array',
                  description: 'Exactly 4 options for mcq. EMPTY array for true_false.',
                  items: { type: 'string' },
                },
                correct: {
                  type: 'string',
                  description:
                    'For mcq: "a", "b", "c" or "d" — the index into options. For true_false: "true" or "false".',
                },
                explanation: {
                  type: 'string',
                  description:
                    'Teach here. Say WHY the answer is right and why the tempting wrong one is wrong. ' +
                    'This is the part the learner actually remembers.',
                },
              },
              required: ['type', 'question', 'options', 'correct', 'explanation'],
              additionalProperties: false,
            },
          },
        },
        required: ['capsule_id', 'questions'],
        additionalProperties: false,
      },
    },
    splits: {
      type: 'array',
      description:
        'Lessons that bundle several separate pieces of work and should become several lessons. ' +
        'Do NOT split one project that merely has several artifacts (a notebook + its repo + its slides).',
      items: {
        type: 'object',
        properties: {
          capsule_id: { type: 'string' },
          lessons: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                item_titles: {
                  type: 'array',
                  description: 'The content items this lesson takes, by their EXACT titles from the input.',
                  items: { type: 'string' },
                },
              },
              required: ['title', 'description', 'item_titles'],
              additionalProperties: false,
            },
          },
        },
        required: ['capsule_id', 'lessons'],
        additionalProperties: false,
      },
    },
    skipped: {
      type: 'string',
      description: 'One sentence on what you deliberately left alone, and why.',
    },
  },
  required: ['changes', 'overviews', 'quizzes', 'splits', 'skipped'],
  additionalProperties: false,
};

interface Change { kind: 'module' | 'capsule'; id: string; title: string; description: string; reason: string }
interface Overview { module_id: string; title: string; body: string }
interface Question { type: 'mcq' | 'true_false'; question: string; options: string[]; correct: string; explanation: string }
interface QuizProposal { capsule_id: string; questions: Question[] }
interface SplitLesson { title: string; description: string; item_titles: string[] }
interface Split { capsule_id: string; lessons: SplitLesson[] }

const SYSTEM = `You improve a paid engineering course on autonomous driving and applied AI. Your job is to make a learner UNDERSTAND and REMEMBER the material — not to decorate it.

THE ONE RULE THAT OVERRIDES EVERYTHING: never invent what a lesson contains.

For each lesson you are shown the titles of the files and links actually inside it. That is your evidence. A lesson called "Video 3" holding a file called "Support Vector Machines" is a lesson about SVMs — rename it. A lesson called "Video 6" holding a file called only "Lecture" tells you nothing — leave it alone and say so. Where you cannot identify the subject, you write no quiz for it. A confidently wrong question on a paid course destroys the learner's trust in everything else here.

WHAT MAKES EACH THING GOOD:

Titles: say what the lesson IS. Never a placeholder, never a format ("Video 2").

Descriptions: two sentences. The first says what the learner is about to do. The second — the one that earns its place — says why it comes HERE: what it builds on, what it sets up, or what breaks without it. "Runs in Colab" is a label, not a description; the learner can see the icon.

Module overviews: what the module covers, why it matters to someone building these systems, what each lesson in it does, and explicitly how it follows from the module before and sets up the one after. The course should read as an argument, not a playlist.

Quiz questions: test understanding, not recall.
  - BAD: "What does SVM stand for?" — tests nothing.
  - GOOD: "What does an SVM actually maximise?" — tests whether they know it is the margin.
  - BETTER: "For an AEB classifier, which error is worse — a false positive or a false negative?" — tests whether they understand that one is a rear-ending and the other is a collision.
  Ask about a decision the learner had to make, a trade-off, or what breaks if they get it wrong. The EXPLANATION is where the teaching happens: say why the right answer is right AND why the tempting wrong one is wrong. That is the sentence they will remember.

Splits: a lesson holding six separate notebooks is six lessons — one "Mark as Complete" button across six pieces of work gives the learner no signal about where they are. But a lesson holding one project's notebook, its repo and its slides is ONE lesson with three artifacts. Splitting that would be worse. The test is: is each item a separate piece of WORK, or a different view of the same work?

Half your value is in what you decline to touch. Say what you skipped.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated' });

  const asCaller = supabaseAsCaller(authHeader);
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { data: roles } = await asCaller.from('user_roles').select('role').eq('user_id', user.id);
  if (!roles?.some((r: { role: string }) => r.role === 'admin')) {
    return res.status(403).json({ error: 'Admins only' });
  }

  const {
    course_id: courseId,
    context,
    module_ids: moduleIds,
    actions = ['titles', 'overviews'],
  } = (req.body ?? {}) as {
    course_id?: string;
    context?: string;
    module_ids?: string[];
    actions?: Action[];
  };

  if (!courseId) return res.status(400).json({ error: 'course_id is required' });

  try {
    const { data: course } = await asCaller
      .from('courses')
      .select('title, tagline, description, syllabus')
      .eq('id', courseId)
      .maybeSingle();
    if (!course) return res.status(404).json({ error: 'Course not found' });

    let query = asCaller
      .from('learning_paths')
      .select('id, title, description, order_index, capsules(id, title, description, order_index)')
      .eq('course_id', courseId);
    if (moduleIds?.length) query = query.in('id', moduleIds);

    const { data: modules } = await query.order('order_index');
    if (!modules?.length) return res.status(400).json({ error: 'This course has no modules yet.' });

    const capsuleIds = modules.flatMap((m) => (m.capsules ?? []).map((c: { id: string }) => c.id));

    const [{ data: contents }, { data: existingQuizzes }] = await Promise.all([
      asCaller
        .from('capsule_content')
        .select('capsule_id, title, content_type')
        .in('capsule_id', capsuleIds),
      asCaller.from('quizzes').select('capsule_id').in('capsule_id', capsuleIds),
    ]);

    const quizzed = new Set(
      (existingQuizzes ?? []).map((q: { capsule_id: string | null }) => q.capsule_id)
    );

    const byCapsule = new Map<string, { title: string | null; content_type: string }[]>();
    for (const item of contents ?? []) {
      const list = byCapsule.get(item.capsule_id) ?? [];
      list.push({ title: item.title, content_type: item.content_type });
      byCapsule.set(item.capsule_id, list);
    }

    const structureText = modules
      .map((m) => {
        const caps = ((m.capsules ?? []) as {
          id: string; title: string; description: string | null; order_index: number;
        }[])
          .sort((a, b) => a.order_index - b.order_index)
          .map((c) => {
            const items = byCapsule.get(c.id) ?? [];
            const evidence = items.length
              ? items.map((i) => `${i.content_type} "${i.title ?? '(untitled)'}"`).join(', ')
              : 'NOTHING — no evidence, leave alone';
            return (
              `  - capsule id=${c.id}\n` +
              `    title: "${c.title}"\n` +
              `    description: ${c.description ? `"${c.description}"` : '(none)'}\n` +
              `    has a quiz already: ${quizzed.has(c.id) ? 'YES — write none' : 'no'}\n` +
              `    CONTAINS: ${evidence}`
            );
          })
          .join('\n');
        return `MODULE id=${m.id}\n  title: "${m.title}"\n${caps}`;
      })
      .join('\n\n');

    const hasOverview = new Set(
      modules
        .filter((m) =>
          ((m.capsules ?? []) as { title: string }[]).some((c) =>
            /^(what this module covers|overview|start here|introduction)/i.test(c.title.trim())
          )
        )
        .map((m) => m.id)
    );

    const want = new Set<Action>(actions);
    const asks: string[] = [];
    if (want.has('titles')) asks.push('- TITLES AND DESCRIPTIONS: rename what the evidence lets you rename, and write a two-sentence description for every lesson.');
    if (want.has('overviews')) asks.push('- MODULE OVERVIEWS: for the modules that do not have one.');
    if (want.has('quizzes')) asks.push('- QUIZZES: 3-5 questions for each lesson whose subject you can identify AND that has no quiz already.');
    if (want.has('structure')) asks.push('- SPLITS: lessons that bundle separate pieces of work.');

    // Size the reservation to what was actually asked for; the TPM budget charges input
    // plus this together, so an over-generous number gets the whole request rejected.
    const perCapsule =
      (want.has('titles') ? 70 : 0) +
      (want.has('quizzes') ? 320 : 0) +
      (want.has('structure') ? 40 : 0);
    const maxTokens = Math.min(
      5000,
      600 + capsuleIds.length * perCapsule + modules.length * (want.has('overviews') ? 340 : 0)
    );

    const s = (course.syllabus ?? {}) as { outcomes?: string[] };

    const result = await structured<{
      changes: Change[]; overviews: Overview[]; quizzes: QuizProposal[]; splits: Split[]; skipped: string;
    }>(groq(), {
      system: SYSTEM,
      schemaName: 'course_improvements',
      schema: SCHEMA,
      maxTokens,
      prompt:
        `COURSE: ${course.title}\n` +
        (course.tagline ? `${course.tagline}\n` : '') +
        (s.outcomes?.length ? `Covers: ${s.outcomes.join('; ')}\n` : '') +
        (context?.trim()
          ? `\nCONTEXT FROM THE COURSE AUTHOR — treat as authoritative:\n${context.trim()}\n`
          : '\n(No extra context. Rely entirely on the evidence below.)\n') +
        `\nWHAT TO PRODUCE:\n${asks.join('\n')}\n` +
        `Return EMPTY arrays for anything not asked for.\n` +
        (hasOverview.size
          ? `\nThese modules already have an overview — write none for them: ${[...hasOverview].join(', ')}\n`
          : '') +
        `\nSTRUCTURE AND EVIDENCE\n${structureText}\n\n` +
        `Copy every id exactly as given. Omit anything you would leave unchanged. Do not ` +
        `invent a subject for a lesson whose contents you cannot identify from the evidence.`,
    });

    // Nothing is trusted that has not been checked. The strict-schema fallback in
    // structured() means the response may not have been constrained at all, and an id the
    // model invented must never be written to.
    const validModules = new Set(modules.map((m) => m.id));
    const validCapsules = new Set(capsuleIds);
    const ok = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

    const changes = (Array.isArray(result.changes) ? result.changes : []).filter(
      (c): c is Change =>
        !!c && ok(c.id) && ok(c.title) &&
        (c.kind === 'module' ? validModules.has(c.id) : validCapsules.has(c.id))
    );

    const overviews = (Array.isArray(result.overviews) ? result.overviews : []).filter(
      (o): o is Overview =>
        !!o && ok(o.module_id) && ok(o.title) && ok(o.body) &&
        validModules.has(o.module_id) && !hasOverview.has(o.module_id)
    );

    const quizzes = (Array.isArray(result.quizzes) ? result.quizzes : [])
      .filter((q): q is QuizProposal => !!q && validCapsules.has(q.capsule_id) && !quizzed.has(q.capsule_id))
      .map((q) => ({
        ...q,
        questions: (q.questions ?? []).filter(
          (x) =>
            ok(x.question) && ok(x.explanation) &&
            (x.type === 'true_false'
              ? x.correct === 'true' || x.correct === 'false'
              : Array.isArray(x.options) &&
                x.options.length === 4 &&
                ['a', 'b', 'c', 'd'].includes(x.correct))
        ),
      }))
      // A one-question quiz is a coin-flip, not an assessment.
      .filter((q) => q.questions.length >= 3);

    const splits = (Array.isArray(result.splits) ? result.splits : [])
      .filter((sp): sp is Split => !!sp && validCapsules.has(sp.capsule_id) && Array.isArray(sp.lessons))
      .map((sp) => {
        const items = (byCapsule.get(sp.capsule_id) ?? []).map((i) => i.title ?? '');
        return {
          ...sp,
          lessons: sp.lessons.filter(
            (l) => ok(l.title) && Array.isArray(l.item_titles) && l.item_titles.every((t) => items.includes(t))
          ),
        };
      })
      // A split that loses a content item is worse than no split. Drop any that does not
      // account for every single item in the capsule.
      .filter((sp) => {
        const items = byCapsule.get(sp.capsule_id) ?? [];
        const claimed = sp.lessons.flatMap((l) => l.item_titles);
        return sp.lessons.length > 1 && claimed.length === items.length;
      });

    return res.status(200).json({
      ok: true, changes, overviews, quizzes, splits, skipped: result.skipped ?? '',
    });
  } catch (error) {
    console.error('improve-course failed:', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
}
