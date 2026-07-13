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
Email: a subject line that says what is inside, not a tease. Body under 200 words, one clear call to action.`;

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
    // Ground the copy in the real course, so the model has facts to work from
    // rather than adjectives to invent.
    let courseContext = 'No specific course — write about the platform in general.';
    if (courseId) {
      const { data: course } = await asCaller
        .from('courses')
        .select('title, description, curriculum_preview, price_india, price_international')
        .eq('id', courseId)
        .maybeSingle();

      if (course) {
        courseContext = [
          `Course: ${course.title}`,
          course.description ? `Description: ${course.description}` : '',
          course.curriculum_preview ? `Curriculum: ${course.curriculum_preview}` : '',
          course.price_india ? `Price (India): INR ${course.price_india}` : '',
          course.price_international
            ? `Price (international): EUR ${course.price_international}`
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      }
    }

    const result = await structured<{ variants: Variant[] }>(groq(), {
      system: SYSTEM,
      schemaName: 'marketing_variants',
      schema: VARIANTS_SCHEMA,
      // Three posts of under 200 words each is ~1000 tokens of output. 2500 leaves
      // comfortable headroom while staying well inside the 8k/min TPM budget, which
      // charges input + this number together.
      maxTokens: 2500,
      prompt:
        `Write three ${channel === 'linkedin' ? 'LinkedIn posts' : 'marketing emails'} for this course.\n\n` +
        `${courseContext}\n\n` +
        `Goal: ${objective || 'drive qualified enrollments'}\n` +
        `Audience: ${audience || 'working engineers moving into autonomous driving and applied AI'}\n\n` +
        `Make the three genuinely different bets — not three rewordings of one idea. ` +
        `For example: one leading on a concrete technical outcome, one on the gap between ` +
        `knowing theory and shipping, one on who this is and is not for. ` +
        `Every factual claim must be supported by the course details above.`,
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
