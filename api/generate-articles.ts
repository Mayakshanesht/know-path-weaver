import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  RESEARCH_MODEL,
  groq,
  slugify,
  structured,
  supabaseAdmin,
} from './_lib/groq.js';

/**
 * Writes the day's research article for the home page.
 *
 * Invoked by the Vercel Cron entry in vercel.json (06:00 UTC daily). Vercel signs
 * cron invocations with the CRON_SECRET env var, which is what stops this public
 * URL from being a free "spend my Groq credits" button for anyone who finds it.
 *
 * Two passes, because Groq cannot combine tool use with structured outputs:
 *   1. groq/compound researches with its built-in web search — tools, no schema.
 *   2. gpt-oss-120b shapes the findings — schema (strict), no tools.
 */

export const config = {
  // Research + writing is two model calls with web search in between.
  maxDuration: 300,
};

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
      description: 'One or two sentences: what a reader learns, not what the article "explores".',
    },
    body: {
      type: 'string',
      description:
        'The article in Markdown, 600-900 words. Use ## subheadings. Explain what is genuinely ' +
        'new and why it matters to a working engineer. No filler, no "in conclusion".',
    },
    reading_minutes: { type: 'integer' },
    sources: {
      type: 'array',
      description: 'Only pages that appear in the research. Never invent a URL.',
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
};

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without this check the
  // route is a public endpoint that spends money on every hit.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET is not configured' });
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const client = groq();
    const supabase = supabaseAdmin();

    // Rotate the topic by day so consecutive days don't cover the same ground.
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const topic = TOPICS[dayIndex % TOPICS.length];

    const { data: recent } = await supabase
      .from('articles')
      .select('title')
      .order('published_at', { ascending: false })
      .limit(10);

    const alreadyCovered =
      (recent ?? []).map((a: { title: string }) => `- ${a.title}`).join('\n') || '(nothing yet)';

    // --- Pass 1: research (built-in web search, no schema) -------------------
    const research = await client.chat.completions.create({
      model: RESEARCH_MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content:
            `Search the web for genuinely recent developments in ${topic}.\n\n` +
            `Find one that is worth a working engineer's time — a new paper, result, ` +
            `benchmark, or release. Prefer primary sources (arXiv, lab blogs, official ` +
            `repos) over news coverage of them.\n\n` +
            `We have already covered these, so pick something different:\n${alreadyCovered}\n\n` +
            `Report what you found: what it is, what is actually new about it, what the ` +
            `evidence shows, what its limitations are, and the exact URLs you read.`,
        },
      ],
    });

    const findings = research.choices[0]?.message?.content ?? '';
    if (!findings.trim()) {
      throw new Error('Research pass returned no usable text.');
    }

    // --- Pass 2: shape into an article (strict schema, no tools) -------------
    const article = await structured<Article>(client, {
      system: SYSTEM,
      schemaName: 'article',
      schema: ARTICLE_SCHEMA,
      prompt:
        `Write the article from this research. Use only what the research supports — ` +
        `do not add facts, numbers, or sources that do not appear here.\n\n` +
        `RESEARCH:\n${findings}`,
    });

    // Slugs can collide across days; disambiguate without a random.
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

    return res.status(200).json({ ok: true, slug, title: article.title });
  } catch (error) {
    console.error('generate-articles failed:', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
}
