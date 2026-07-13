import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { claude, structured } from '../_shared/claude.ts';

/**
 * Drafts marketing copy for a course — three variants, so the admin picks rather
 * than re-rolls.
 *
 * Authorization comes from the caller's JWT and is checked against the admin role:
 * this function spends money on API calls, so it must not be callable by a learner.
 * No web search and no citations here, so the whole thing is one structured call.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

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
            description: 'The opening line, on its own. This is what decides whether anyone reads on.',
          },
          subject: {
            type: 'string',
            description: 'Email subject line. Empty string for LinkedIn.',
          },
          body: {
            type: 'string',
            description: 'The full post or email body, ready to send.',
          },
          hashtags: {
            type: 'array',
            items: { type: 'string' },
            description: 'LinkedIn only, max 5, no leading #. Empty for email.',
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
} as const;

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
- No hype vocabulary: no "unlock", "supercharge", "game-changing", "revolutionize", "🚀".
- No fake urgency or invented scarcity.
- Write like an engineer who respects the reader's time.

LinkedIn: short lines, real line breaks, one idea per paragraph. Earn the "see more" click with the first line. Under 200 words.
Email: a subject line that says what is inside, not a tease. Body under 200 words, one clear call to action.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not authenticated' }, 401);

  const asCaller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
  } = await asCaller.auth.getUser();
  if (!user) return json({ error: 'Not authenticated' }, 401);

  // Generation costs money per call, so gate it on the admin role, not just on
  // being signed in.
  const { data: roles } = await asCaller
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (!roles?.some((r) => r.role === 'admin')) {
    return json({ error: 'Admins only' }, 403);
  }

  let body: {
    campaign_id?: string;
    channel?: 'linkedin' | 'email';
    course_id?: string | null;
    objective?: string;
    audience?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { campaign_id: campaignId, channel, objective, audience } = body;
  if (!campaignId || !channel) {
    return json({ error: 'campaign_id and channel are required' }, 400);
  }

  // Ground the copy in the real course, so the model has facts to work from rather
  // than adjectives to invent.
  let courseContext = 'No specific course — write about the platform in general.';
  if (body.course_id) {
    const { data: course } = await asCaller
      .from('courses')
      .select('title, description, curriculum_preview, price_india, price_international')
      .eq('id', body.course_id)
      .maybeSingle();

    if (course) {
      courseContext = [
        `Course: ${course.title}`,
        course.description ? `Description: ${course.description}` : '',
        course.curriculum_preview ? `Curriculum: ${course.curriculum_preview}` : '',
        course.price_india ? `Price (India): INR ${course.price_india}` : '',
        course.price_international ? `Price (international): EUR ${course.price_international}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
  }

  try {
    const client = claude();

    const result = await structured<{ variants: Variant[] }>(client, {
      system: SYSTEM,
      prompt:
        `Write three ${channel === 'linkedin' ? 'LinkedIn posts' : 'marketing emails'} for this course.\n\n` +
        `${courseContext}\n\n` +
        `Goal: ${objective || 'drive qualified enrollments'}\n` +
        `Audience: ${audience || 'working engineers moving into autonomous driving and applied AI'}\n\n` +
        `Make the three genuinely different bets — not three rewordings of one idea. ` +
        `For example: one leading on a concrete technical outcome, one on the gap between ` +
        `knowing theory and shipping, one on who this is and is not for. ` +
        `Every factual claim must be supported by the course details above.`,
      schema: VARIANTS_SCHEMA,
    });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Regenerating replaces the previous drafts rather than piling up.
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

    return json({ ok: true, count: result.variants.length }, 200);
  } catch (error) {
    console.error('generate-marketing failed:', error);
    return json({ ok: false, error: String(error) }, 500);
  }
});
