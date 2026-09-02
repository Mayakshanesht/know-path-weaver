import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin, supabaseAsCaller } from './_lib/groq.js';

/**
 * Verifies a Razorpay checkout signature and enrolls the buyer.
 *
 * A valid gateway signature IS the authoritative payment confirmation the
 * receipt flow's design note said to wait for — so this sets BOTH
 * status='approved' (access) and payment_confirmed=true (money, which
 * fires the invoice). The order's notes must name the caller: one learner
 * cannot redeem another learner's order.
 */

const RZP = 'https://api.razorpay.com/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const keyId = process.env.RAZORPAY_KEY_ID ?? process.env.RAZORPAY_API_KEY;
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? process.env.RAZORPAY_API_SECRET;
  if (!keyId || !keySecret) return res.status(503).json({ error: 'not configured' });

  const authHeader = req.headers.authorization ?? '';
  if (!authHeader) return res.status(401).json({ error: 'sign in first' });
  const { data: userData, error: userErr } =
    await supabaseAsCaller(authHeader).auth.getUser();
  if (userErr || !userData.user) return res.status(401).json({ error: 'sign in first' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    (req.body ?? {}) as Record<string, string>;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'missing fields' });
  }

  const expected = createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  let ok = false;
  try {
    ok = timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
  } catch {
    ok = false;
  }
  if (!ok) return res.status(400).json({ verified: false, error: 'signature mismatch' });

  const auth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const r = await fetch(`${RZP}/orders/${razorpay_order_id}`, {
    headers: { Authorization: auth },
  });
  const order = await r.json();
  if (!r.ok) return res.status(502).json({ error: 'could not load order' });
  if (order?.notes?.lms_user_id !== userData.user.id) {
    return res.status(403).json({ error: 'order belongs to a different account' });
  }
  const courseId = order?.notes?.course_id;
  if (!courseId) return res.status(400).json({ error: 'order has no course' });

  const now = new Date().toISOString();
  const base = {
    user_id: userData.user.id,
    course_id: courseId,
    status: 'approved' as const,
    payment_confirmed: true,
    payment_confirmed_at: now,
    approved_at: now,
    payment_reference: razorpay_payment_id,
    amount_paid: (order.amount ?? 0) / 100,
    currency: order.currency ?? 'INR',
    admin_notes: 'Razorpay gateway payment (auto-approved)',
  };
  const db = supabaseAdmin();
  let { error: upsertErr } = await db.from('enrollments').upsert(
    {
      ...base,
      billing_country: order.notes?.billing_country || null,
      billing_region: order.currency === 'INR' ? 'india' : 'international',
      billing_state: order.notes?.billing_state || null,
    },
    { onConflict: 'user_id,course_id' },
  );
  if (upsertErr?.code === 'PGRST204') {
    // invoicing migration not applied on this database — enroll anyway
    ({ error: upsertErr } = await db
      .from('enrollments')
      .upsert(base, { onConflict: 'user_id,course_id' }));
  }
  if (upsertErr) return res.status(500).json({ error: upsertErr.message });

  return res.status(200).json({ verified: true, enrolled: true });
}
