import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.68.0';

/**
 * Shared Claude client for the edge functions.
 *
 * Model choice: claude-opus-4-8, with adaptive thinking. These are research and
 * copywriting tasks where quality is the whole point and volume is a handful of
 * calls a day, so there is nothing to gain from a cheaper tier.
 */
export const MODEL = 'claude-opus-4-8';

export function claude(): Anthropic {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Missing required secret: ANTHROPIC_API_KEY');
  return new Anthropic({ apiKey });
}

/** Concatenates the text blocks of a response, ignoring thinking and tool blocks. */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

/**
 * Runs a prompt and returns a value validated against `schema`.
 *
 * Deliberately takes no tools: structured outputs are rejected by the API when
 * citations are present, and the web-search tool attaches citations to whatever
 * it produces. So research and extraction have to be two separate calls — search
 * first with tools and no schema, then shape the result here with a schema and
 * no tools.
 */
export async function structured<T>(
  client: Anthropic,
  opts: {
    system: string;
    prompt: string;
    schema: Record<string, unknown>;
    maxTokens?: number;
  }
): Promise<T> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: 'adaptive' },
    system: opts.system,
    messages: [{ role: 'user', content: opts.prompt }],
    output_config: {
      format: { type: 'json_schema', schema: opts.schema },
    },
  });

  if (message.stop_reason === 'max_tokens') {
    throw new Error('Model hit max_tokens; the JSON is truncated.');
  }

  return JSON.parse(textOf(message)) as T;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}
