import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

/**
 * Hands back a short-lived signed URL for an invoice PDF.
 *
 * The bucket is private, so this is the only way in. Authorisation is decided from
 * the caller's JWT rather than from anything in the request body -- a client that
 * asks for someone else's invoice_id gets a 404, not their PDF.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not authenticated' }, 401);

  let invoiceId: string;
  try {
    ({ invoice_id: invoiceId } = await req.json());
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!invoiceId) return json({ error: 'invoice_id is required' }, 400);

  // Resolve who is actually calling, from the token -- never from the payload.
  const asCaller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: authError,
  } = await asCaller.auth.getUser();

  if (authError || !user) return json({ error: 'Not authenticated' }, 401);

  // This SELECT runs as the caller, so the "own invoices or admin" RLS policy is
  // what enforces access. Someone else's id simply returns no row.
  const { data: invoice } = await asCaller
    .from('invoices')
    .select('invoice_number, storage_path')
    .eq('id', invoiceId)
    .maybeSingle<{ invoice_number: string; storage_path: string | null }>();

  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (!invoice.storage_path) {
    return json({ error: 'This invoice is still being generated. Try again shortly.' }, 409);
  }

  // Signing needs service_role; by now the caller's right to this file is settled.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: signed, error: signError } = await admin.storage
    .from('invoices')
    .createSignedUrl(invoice.storage_path, 60, {
      download: `${invoice.invoice_number}.pdf`,
    });

  if (signError || !signed) {
    return json({ error: signError?.message ?? 'Could not sign URL' }, 500);
  }

  return json({ url: signed.signedUrl, invoice_number: invoice.invoice_number }, 200);
});
