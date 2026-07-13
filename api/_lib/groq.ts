import Groq from 'groq-sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared Groq + Supabase setup for the Vercel API routes.
 *
 * Model choice is forced, not preferred:
 *
 *  - RESEARCH_MODEL is `groq/compound`, the only Groq system with built-in web
 *    search. Without it there is nothing to research from.
 *  - SCHEMA_MODEL is `openai/gpt-oss-120b`, because strict structured outputs
 *    (constrained decoding, guaranteed schema match) are only available on the
 *    gpt-oss models. Every other Groq model gives "valid JSON that may not match
 *    your schema", which would mean articles inserting with missing fields.
 *
 * The two cannot be one call: Groq does not support tool use together with
 * structured outputs. So research runs with tools and no schema, then a second
 * call shapes the result with a schema and no tools.
 */
export const RESEARCH_MODEL = 'groq/compound';
export const SCHEMA_MODEL = 'openai/gpt-oss-120b';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function groq(): Groq {
  return new Groq({ apiKey: required('GROQ_API_KEY') });
}

const supabaseUrl = () => process.env.SUPABASE_URL ?? required('VITE_SUPABASE_URL');

/** Bypasses RLS. Only for writes the caller is already authorised to make. */
export function supabaseAdmin(): SupabaseClient {
  return createClient(supabaseUrl(), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

/** Acts as the signed-in caller, so their RLS policies still apply. */
export function supabaseAsCaller(authHeader: string): SupabaseClient {
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? required('VITE_SUPABASE_PUBLISHABLE_KEY');

  return createClient(supabaseUrl(), anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
}

/**
 * Runs a prompt and returns a value the model was *constrained* to fit `schema`.
 *
 * `strict: true` is the whole point of using SCHEMA_MODEL — it makes malformed
 * output impossible rather than merely unlikely, so callers don't need to defend
 * against a missing field.
 */
export async function structured<T>(
  client: Groq,
  opts: {
    system: string;
    prompt: string;
    schemaName: string;
    schema: Record<string, unknown>;
    maxTokens?: number;
  }
): Promise<T> {
  const completion = await client.chat.completions.create({
    model: SCHEMA_MODEL,
    max_completion_tokens: opts.maxTokens ?? 8000,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: opts.schemaName,
        strict: true,
        schema: opts.schema,
      },
    },
  });

  const choice = completion.choices[0];
  if (choice?.finish_reason === 'length') {
    throw new Error('Model hit the token limit; the JSON is truncated.');
  }

  const content = choice?.message?.content;
  if (!content) throw new Error('Model returned no content.');

  return JSON.parse(content) as T;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}
