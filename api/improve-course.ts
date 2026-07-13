import type { VercelRequest, VercelResponse } from '@vercel/node';
import { groq, structured, supabaseAsCaller } from './_lib/groq.js';

/**
 * Proposes better titles and descriptions for a course's modules and capsules.
 *
 * It proposes. It never writes. This is paid course content, and a model that renames
 * "Video 3" to something plausible-but-wrong is worse than the placeholder, because
 * the placeholder at least admits it knows nothing. Every suggestion comes back for
 * the admin to accept or reject.
 *
 * Grounding is the whole design. The model is given, for each capsule, the titles and
 * types of the content items actually inside it — which is where the real signal lives
 * ("Video 3" contains a Drive file titled "Support Vector Machines") — plus the
 * course syllabus and whatever context the admin types in. It is told, repeatedly,
 * that a capsule with no usable signal must be returned unchanged rather than guessed
 * at.
 */

export const config = { maxDuration: 120 };

const SUGGESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    modules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The module id, copied exactly from the input.' },
          title: { type: 'string', description: 'Improved title, or the existing one unchanged.' },
          description: {
            type: 'string',
            description:
              'One line on what this module is for. Empty string if there is nothing to say.',
          },
          changed: { type: 'boolean', description: 'False if you are proposing no change.' },
          reason: {
            type: 'string',
            description: 'Short: what evidence supports this. Empty if unchanged.',
          },
        },
        required: ['id', 'title', 'description', 'changed', 'reason'],
        additionalProperties: false,
      },
    },
    capsules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The capsule id, copied exactly from the input.' },
          title: { type: 'string' },
          description: { type: 'string', description: 'One line. Empty string if unknown.' },
          changed: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['id', 'title', 'description', 'changed', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['modules', 'capsules'],
  additionalProperties: false,
};

interface Suggestion {
  id: string;
  title: string;
  description: string;
  changed: boolean;
  reason: string;
}

const SYSTEM = `You improve the titles and descriptions of lessons in a paid engineering course on autonomous driving and applied AI.

The single rule that matters: NEVER INVENT WHAT A LESSON CONTAINS.

You will see, for each lesson, the titles of the files and links actually inside it. That is your evidence. A lesson called "Video 3" containing a file titled "Support Vector Machines" is a lesson about support vector machines — rename it. A lesson called "Video 6" containing a file titled only "Lecture" tells you nothing — leave it alone and set changed=false.

- Prefer the evidence over your own knowledge of what a module "should" cover.
- A lesson holding many files is a collection of materials. Name it for the collection, not for the first file in it.
- Descriptions must describe what is actually in the lesson. If you do not know, return an empty description rather than a guess.
- Write plainly, for a working engineer. No marketing language.
- If a title is already good, set changed=false and return it unchanged.

Half the value here is what you decline to touch.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated' });

  const asCaller = supabaseAsCaller(authHeader);
  const {
    data: { user },
  } = await asCaller.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { data: roles } = await asCaller.from('user_roles').select('role').eq('user_id', user.id);
  if (!roles?.some((r: { role: string }) => r.role === 'admin')) {
    return res.status(403).json({ error: 'Admins only' });
  }

  const { course_id: courseId, context } = (req.body ?? {}) as {
    course_id?: string;
    context?: string;
  };
  if (!courseId) return res.status(400).json({ error: 'course_id is required' });

  try {
    const { data: course } = await asCaller
      .from('courses')
      .select('title, tagline, description, syllabus')
      .eq('id', courseId)
      .maybeSingle();

    if (!course) return res.status(404).json({ error: 'Course not found' });

    const { data: modules } = await asCaller
      .from('learning_paths')
      .select('id, title, description, order_index, capsules(id, title, description, order_index)')
      .eq('course_id', courseId)
      .order('order_index');

    if (!modules?.length) {
      return res.status(400).json({ error: 'This course has no modules yet.' });
    }

    // The content items are the evidence. Without them the model is guessing, so this
    // is the most important part of the prompt.
    const capsuleIds = modules.flatMap((m) =>
      (m.capsules ?? []).map((c: { id: string }) => c.id)
    );

    const { data: contents } = await asCaller
      .from('capsule_content')
      .select('capsule_id, title, content_type, description')
      .in('capsule_id', capsuleIds);

    const byCapsule = new Map<string, { title: string | null; content_type: string }[]>();
    for (const item of contents ?? []) {
      const list = byCapsule.get(item.capsule_id) ?? [];
      list.push({ title: item.title, content_type: item.content_type });
      byCapsule.set(item.capsule_id, list);
    }

    const s = (course.syllabus ?? {}) as { outcomes?: string[] };

    const structureText = modules
      .map((m) => {
        const capsules = ((m.capsules ?? []) as {
          id: string;
          title: string;
          description: string | null;
          order_index: number;
        }[])
          .sort((a, b) => a.order_index - b.order_index)
          .map((c) => {
            const items = byCapsule.get(c.id) ?? [];
            const evidence = items.length
              ? items
                  .map((i) => `${i.content_type}: "${i.title ?? '(untitled)'}"`)
                  .join(', ')
              : 'NO CONTENT — you have no evidence, leave unchanged';
            return (
              `  - capsule id=${c.id}\n` +
              `    current title: "${c.title}"\n` +
              `    current description: ${c.description ? `"${c.description}"` : '(none)'}\n` +
              `    CONTAINS (${items.length} item${items.length === 1 ? '' : 's'}): ${evidence}`
            );
          })
          .join('\n');

        return (
          `MODULE id=${m.id}\n` +
          `  current title: "${m.title}"\n` +
          `  current description: ${m.description ? `"${m.description}"` : '(none)'}\n` +
          capsules
        );
      })
      .join('\n\n');

    const result = await structured<{ modules: Suggestion[]; capsules: Suggestion[] }>(groq(), {
      system: SYSTEM,
      schemaName: 'course_suggestions',
      schema: SUGGESTIONS_SCHEMA,
      maxTokens: 4000,
      prompt:
        `COURSE: ${course.title}\n` +
        (course.tagline ? `${course.tagline}\n` : '') +
        (course.description ? `${course.description}\n` : '') +
        (s.outcomes?.length ? `Covers: ${s.outcomes.join('; ')}\n` : '') +
        (context?.trim()
          ? `\nCONTEXT FROM THE COURSE AUTHOR (treat as authoritative):\n${context.trim()}\n`
          : '\n(The author gave no extra context. Rely on the evidence below.)\n') +
        `\nSTRUCTURE AND EVIDENCE\n${structureText}\n\n` +
        `Return one entry per module and one per capsule, using the ids exactly as given. ` +
        `Set changed=false for anything you cannot improve from the evidence. Do not ` +
        `invent a subject for a lesson whose contents you cannot identify.`,
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('improve-course failed:', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
}
