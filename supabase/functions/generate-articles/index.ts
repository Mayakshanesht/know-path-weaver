import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import type Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.68.0';
import { MODEL, claude, slugify, structured, textOf } from '../_shared/claude.ts';

/**
 * Writes the day's research articles for the home page.
 *
 * Runs in two passes, and it has to:
 *   1. Research with the web_search tool. Search results arrive as citations, and
 *      the API rejects structured outputs on any response carrying citations.
 *   2. Shape that research into an article with a JSON schema and no tools.
 *
 * Trying to do both in one call returns a 400. The split is also what lets the
 * article record which sources were actually read.
 */

const TOPICS = [
  'autonomous driving perception, sensor fusion, and end-to-end driving policies',
  'reinforcement learning and world models for embodied agents and robotics',
  'foundation models applied to planning, control, or spatial reasoning',
  'computer vision research relevant to self-driving and robotics',
];

const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Specific and concrete. Never clickbait, never a question.',
    },
    summary: {
      type: 'string',
      description: 'One or two sentences. What a reader learns, not what the article "explores".',
    },
    body: {
      type: 'string',
      description:
        'The article in Markdown, 600-900 words. Use ## subheadings. Explain what is genuinely ' +
        'new and why it matters to an engineer. No filler, no "in conclusion", no invented numbers.',
    },
    reading_minutes: { type: 'integer' },
    sources: {
      type: 'array',
      description: 'Only pages actually read during research. Never invent a URL.',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['title', 'url'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'summary', 'body', 'reading_minutes', 'sources'],
  additionalProperties: false,
} as const;

interface Article {
  title: string;
  summary: string;
  body: string;
  reading_minutes: number;
  sources: { title: string; url: string }[];
}

const SYSTEM =
  'You write for KnowGraph, a course platform teaching autonomous driving and applied AI. ' +
  'Your readers are working engineers: assume they know linear algebra and can read a paper, ' +
  'and do not condescend. Be concrete about what a result actually shows and honest about what ' +
  'it does not. Never fabricate a number, a citation, a benchmark, or a URL — if the research ' +
  'does not support a claim, leave the claim out.';

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const client = claude();

  // Rotate the topic by day so consecutive days don't all cover the same ground.
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const topic = TOPICS[dayIndex % TOPICS.length];

  // Don't re-cover what's already on the front page.
  const { data: recent } = await supabase
    .from('articles')
    .select('title')
    .order('published_at', { ascending: false })
    .limit(10);

  const alreadyCovered = (recent ?? []).map((a) => `- ${a.title}`).join('\n') || '(nothing yet)';

  try {
    // --- Pass 1: research (tools, no schema) ---------------------------------
    const research = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
      messages: [
        {
          role: 'user',
          content:
            `Search for genuinely recent developments in ${topic}.\n\n` +
            `Find one that is worth a working engineer's time — a new paper, result, ` +
            `benchmark, or release. Prefer primary sources (arXiv, lab blogs, official repos) ` +
            `over news coverage of them.\n\n` +
            `We have already covered these, so pick something different:\n${alreadyCovered}\n\n` +
            `Report what you found: what it is, what is actually new about it, what the ` +
            `evidence shows, what its limitations are, and the exact URLs you read.`,
        },
      ],
    });

    // A long search turn can pause; resume until the model is done.
    let researchMessage = research;
    const messages: Anthropic.MessageParam[] = [];
    let guard = 0;
    while (researchMessage.stop_reason === 'pause_turn' && guard++ < 5) {
      messages.push({ role: 'assistant', content: researchMessage.content });
      researchMessage = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        system: SYSTEM,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
        messages: [{ role: 'user', content: 'Continue.' }, ...messages],
      });
    }

    const findings = textOf(researchMessage);
    if (!findings.trim()) {
      throw new Error('Research pass returned no usable text.');
    }

    // --- Pass 2: shape into an article (schema, no tools) --------------------
    const article = await structured<Article>(client, {
      system: SYSTEM,
      prompt:
        `Write the article from this research. Use only what the research supports — ` +
        `do not add facts, numbers, or sources that do not appear here.\n\n` +
        `RESEARCH:\n${findings}`,
      schema: ARTICLE_SCHEMA,
    });

    // Slug collisions are possible across days; make it unique without a random.
    const baseSlug = slugify(article.title);
    const { data: clash } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', baseSlug)
      .maybeSingle();

    const slug = clash ? `${baseSlug}-${dayIndex}` : baseSlug;

    const { error } = await supabase.from('articles').insert({
      slug,
      title: article.title,
      summary: article.summary,
      body: article.body,
      topic,
      reading_minutes: article.reading_minutes,
      sources: article.sources,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, slug, title: article.title }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('generate-articles failed:', error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
