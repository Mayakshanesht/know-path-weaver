import type { VercelRequest, VercelResponse } from '@vercel/node';
import { groq, structured, supabaseAdmin, supabaseAsCaller } from './_lib/groq.js';

/**
 * Drafts marketing copy for a course — three variants, so the admin picks rather
 * than re-rolls.
 *
 * Authorisation is resolved from the caller's Supabase JWT and checked against the
 * admin role. This route spends money on every call, so "signed in" is not a
 * sufficient bar — it has to be an admin.
 */

export const config = {
  maxDuration: 120,
};

const VARIANTS_SCHEMA = {
  type: 'object',
  properties: {
    variants: {
      type: 'array',
      description: 'Exactly three drafts, each taking a genuinely different angle.',
      items: {
        type: 'object',
        properties: {
          hook: {
            type: 'string',
            description: 'The opening line alone. This decides whether anyone reads on.',
          },
          subject: {
            type: 'string',
            description: 'Email subject line. Empty string for LinkedIn.',
          },
          body: { type: 'string', description: 'The full post or email, ready to send.' },
          hashtags: {
            type: 'array',
            items: { type: 'string' },
            description: 'LinkedIn only, max 5, no leading #. Empty array for email.',
          },
          angle: {
            type: 'string',
            description: 'One line: what this variant is betting on, so the admin can choose.',
          },
        },
        required: ['hook', 'subject', 'body', 'hashtags', 'angle'],
        additionalProperties: false,
      },
    },
  },
  required: ['variants'],
  additionalProperties: false,
};

interface Variant {
  hook: string;
  subject: string;
  body: string;
  hashtags: string[];
  angle: string;
}

const SYSTEM = `You write marketing copy for KnowGraph, which teaches autonomous driving and applied AI to working engineers.

Your audience are practitioners. They can tell the difference between a real technical claim and marketing noise, and the second one loses them permanently. So:
- Lead with something concrete and true about the course.
- Never invent a statistic, a testimonial, a company name, an outcome, or a salary figure.
- No hype vocabulary: no "unlock", "supercharge", "game-changing", "revolutionize", no rocket emoji.
- No fake urgency or invented scarcity.
- Write like an engineer who respects the reader's time.

LinkedIn: short lines, real line breaks, one idea per paragraph. Earn the "see more" click with the first line. Under 200 words.
Email: a subject line that says what is inside, not a tease. Body under 200 words, one clear call to action.

Use ONLY the facts given to you below. If a fact is not there, it does not go in the post.`;

/**
 * Things about the platform that are true, so the model has them to hand rather than
 * inventing plausible-sounding equivalents.
 *
 * Everything here must stay true. This text is what the model treats as ground truth,
 * so a stale line becomes a false claim in front of paying customers.
 */
const PLATFORM_FACTS = `
PLATFORM
- KnowGraph teaches autonomous driving and applied AI to working engineers.
- Sign up / enroll: https://know-path-weaver.vercel.app
- Learners get a certificate on course completion, downloadable as an image.
- Learners can download an invoice for every approved enrollment.
- Payment is by PhonePe QR (India) or bank transfer; an admin approves each enrollment.

RECENT ANNOUNCEMENT — the platform has moved to new infrastructure
- Existing learners: courses, enrollments and progress are all preserved.
- They sign in with the password they already use, and are asked to set a new one, ONCE.
  This is unavoidable: password hashes cannot be transferred between systems.
- Nothing else is required of them, and nothing has been lost.
- New learners: just enroll at the link above.
`.trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated' });

  const asCaller = supabaseAsCaller(authHeader);

  const {
    data: { user },
  } = await asCaller.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { data: roles } = await asCaller
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (!roles?.some((r: { role: string }) => r.role === 'admin')) {
    return res.status(403).json({ error: 'Admins only' });
  }

  const {
    campaign_id: campaignId,
    channel,
    course_id: courseId,
    objective,
    audience,
  } = (req.body ?? {}) as {
    campaign_id?: string;
    channel?: 'linkedin' | 'email';
    course_id?: string | null;
    objective?: string | null;
    audience?: string | null;
  };

  if (!campaignId || !channel) {
    return res.status(400).json({ error: 'campaign_id and channel are required' });
  }

  try {
    // Ground the copy in real facts, so the model has something to work from rather
    // than adjectives to invent. A campaign with no course selected is usually a
    // platform announcement, so it gets the whole catalogue plus the platform facts —
    // otherwise the model has nothing concrete and reaches for hype.
    const { data: courses } = await asCaller
      .from('courses')
      .select('id, title, tagline, description, syllabus, price_india, price_international')
      .eq('is_published', true);

    const describe = (c: NonNullable<typeof courses>[number]) => {
      const s = (c.syllabus ?? {}) as {
        outcomes?: string[];
        modules?: { title: string }[];
        projects?: { name: string }[];
      };
      return [
        `## ${c.title}`,
        c.tagline ? `Tagline: ${c.tagline}` : '',
        c.description ? `About: ${c.description}` : '',
        s.outcomes?.length ? `Covers: ${s.outcomes.join('; ')}` : '',
        s.modules?.length ? `Modules: ${s.modules.map((m) => m.title).join('; ')}` : '',
        s.projects?.length ? `Projects: ${s.projects.map((p) => p.name).join('; ')}` : '',
        c.price_india ? `Price: INR ${c.price_india} (India) / EUR ${c.price_international} (international)` : '',
      ]
        .filter(Boolean)
        .join('\n');
    };

    const selected = courseId ? courses?.find((c) => c.id === courseId) : null;

    const courseContext = selected
      ? describe(selected)
      : (courses ?? []).map(describe).join('\n\n');

    const platformContext = PLATFORM_FACTS;

    const result = await structured<{ variants: Variant[] }>(groq(), {
      system: SYSTEM,
      schemaName: 'marketing_variants',
      schema: VARIANTS_SCHEMA,
      // Three posts of under 200 words each is ~1000 tokens of output. 2500 leaves
      // comfortable headroom while staying well inside the 8k/min TPM budget, which
      // charges input + this number together.
      maxTokens: 2500,
      prompt:
        `Write three ${channel === 'linkedin' ? 'LinkedIn posts' : 'marketing emails'} for KnowGraph.\n\n` +
        `${platformContext}\n\n` +
        `${selected ? 'THE COURSE THIS IS ABOUT' : 'ALL COURSES ON THE PLATFORM'}\n${courseContext}\n\n` +
        `Goal: ${objective || 'drive qualified enrollments'}\n` +
        `Audience: ${audience || 'working engineers moving into autonomous driving and applied AI'}\n\n` +
        `Make the three genuinely different bets — not three rewordings of one idea. ` +
        `For example: one leading on a concrete technical outcome, one on the gap between ` +
        `knowing theory and shipping, one on who this is and is not for.\n\n` +
        `Every factual claim must be supported by the facts above. If the goal is an ` +
        `announcement, lead with what an existing learner has to DO, since that is the ` +
        `only part of the post that is urgent to them — then cover what is new for ` +
        `everyone else.`,
    });

    const admin = supabaseAdmin();

    // Regenerating replaces the previous drafts rather than piling them up.
    await admin.from('marketing_posts').delete().eq('campaign_id', campaignId);

    const { error } = await admin.from('marketing_posts').insert(
      result.variants.slice(0, 3).map((v, index) => ({
        campaign_id: campaignId,
        variant: index + 1,
        subject: channel === 'email' ? v.subject || null : null,
        body: v.body,
        hashtags: channel === 'linkedin' ? v.hashtags.slice(0, 5) : [],
        hook: v.angle ? `${v.hook}\n\nAngle: ${v.angle}` : v.hook,
      }))
    );

    if (error) throw error;

    return res.status(200).json({ ok: true, count: result.variants.length });
  } catch (error) {
    console.error('generate-marketing failed:', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
}
