import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, supabaseAsCaller } from './_lib/groq.js';

/**
 * Creates a Razorpay order for a signed-in LMS learner buying a course.
 *
 * The gateway path the receipt-OCR flow was always waiting for: the price
 * comes from the courses table server-side (never the client), the order
 * carries the buyer's user id in its notes, and razorpay-verify.ts turns a
 * signed payment into an approved, payment-confirmed enrollment.
 *
 * Vercel env vars required: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (the same
 * live pair as the marketing site; RAZORPAY_API_KEY / RAZORPAY_API_SECRET
 * accepted as aliases).
 */

const RZP = 'https://api.razorpay.com/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const keyId = process.env.RAZORPAY_KEY_ID ?? process.env.RAZORPAY_API_KEY;
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? process.env.RAZORPAY_API_SECRET;
  if (!keyId || !keySecret) return res.status(503).json({ error: 'not configured' });

  const authHeader = req.headers.authorization ?? '';
  if (!authHeader) return res.status(401).json({ error: 'sign in first' });
  const caller = supabaseAsCaller(authHeader);
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData.user) return res.status(401).json({ error: 'sign in first' });

  const { courseId, billingCountry, billingState, region } = (req.body ?? {}) as {
    courseId?: string; billingCountry?: string; billingState?: string; region?: string;
  };
  if (!courseId) return res.status(400).json({ error: 'courseId required' });

  const db = supabaseAdmin();
  const { data: course } = await db
    .from('courses')
    .select('id, title, price_india, price_international, is_published')
    .eq('id', courseId)
    .maybeSingle();
  if (!course || !course.is_published) {
    return res.status(404).json({ error: 'unknown course' });
  }

  const india = region !== 'international';
  const price = india ? course.price_india : course.price_international;
  if (!price || price <= 0) return res.status(400).json({ error: 'course not priced' });
  const amount = Math.round(Number(price) * 100); // paise / cents
  const currency = india ? 'INR' : 'EUR';

  const auth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const r = await fetch(`${RZP}/orders`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      currency,
      receipt: `lms_${Date.now()}`,
      notes: {
        lms_user_id: userData.user.id,
        course_id: course.id,
        billing_country: billingCountry ?? '',
        billing_state: billingState ?? '',
      },
    }),
  });
  const order = await r.json();
  if (r.status === 401) return res.status(401).json({ error: 'razorpay auth failed' });
  if (!r.ok || !order.id) return res.status(502).json({ error: order });

  return res.status(200).json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: keyId,
    course_title: course.title,
  });
}
