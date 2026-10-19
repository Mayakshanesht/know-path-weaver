import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin, supabaseAsCaller } from './_lib/groq.js';
import { recordSponsorshipPaymentReview, SponsorshipPaymentReviewError } from './_lib/sponsorship-payment.js';
import { assertCapturedCouponPayment, assertCapturedGatewayPayment, assertCouponOrder, completeCouponPayment, CouponCheckoutError, loadCouponCheckout, type CouponCheckout, type GatewayPayment } from './_lib/coupon-checkout.js';

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
  if (order.id !== razorpay_order_id) return res.status(400).json({ error: 'gateway order mismatch' });
  if (order?.notes?.lms_user_id !== userData.user.id) {
    return res.status(403).json({ error: 'order belongs to a different account' });
  }
  const courseId = order?.notes?.course_id;
  if (!courseId) return res.status(400).json({ error: 'order has no course' });

  const db = supabaseAdmin();
  let actualAmount = typeof order.amount === 'number' && Number.isSafeInteger(order.amount) && order.amount > 0 ? order.amount / 100 : null;
  let couponCheckout: CouponCheckout | null = null;
  let couponPayment: GatewayPayment | null = null;
  try {
    // Every enrollment, including a regular full-price checkout, requires an
    // actual captured gateway payment. A signature alone is not settlement.
    const paymentResponse = await fetch(`${RZP}/payments/${encodeURIComponent(razorpay_payment_id)}`, { headers: { Authorization: auth } });
    if (!paymentResponse.ok) throw new CouponCheckoutError('Could not load the actual gateway payment. Please retry verification.', 502);
    const payment = await paymentResponse.json() as GatewayPayment;
    assertCapturedGatewayPayment(payment, order, razorpay_payment_id);
    actualAmount = payment.amount / 100;
    if (order.notes?.coupon_checkout_id) {
      couponCheckout = await loadCouponCheckout(db, order.notes.coupon_checkout_id, userData.user.id, courseId);
      if (!couponCheckout.gatewayOrderId) throw new CouponCheckoutError('The coupon checkout has no bound gateway order.', 409);
      assertCouponOrder(order, couponCheckout, userData.user.id);
      assertCapturedCouponPayment(payment, order, couponCheckout, razorpay_payment_id);
      couponPayment = payment;
    }
  } catch (error) {
    return res.status(error instanceof CouponCheckoutError ? error.status : 502)
      .json({ error: error instanceof Error ? error.message : 'Could not verify the coupon payment.' });
  }
  const recordReview = () => recordSponsorshipPaymentReview(db, {
    userId: userData.user.id,
    courseId,
    paymentReference: razorpay_payment_id,
    amount: actualAmount,
    currency: order.currency ?? 'INR',
    source: 'razorpay-verify',
  });
  const respondWithReview = (reviewId: string) => res.status(200).json({
    verified: true, enrolled: true, paymentReviewRequired: true, reviewId,
  });

  const now = new Date().toISOString();
  const base = {
    user_id: userData.user.id,
    course_id: courseId,
    status: 'approved' as const,
    payment_confirmed: true,
    auto_approved: false,
    payment_confirmed_at: now,
    approved_at: now,
    payment_reference: razorpay_payment_id,
    amount_paid: actualAmount ?? 0,
    currency: order.currency ?? 'INR',
    admin_notes: 'Razorpay gateway payment (auto-approved)',
  };
  try {
    if (couponCheckout) {
      // Only this service RPC may complete a discounted purchase: it rechecks
      // the bound order and payment and creates the immutable discount invoice.
      const completion = await completeCouponPayment(db, couponCheckout, userData.user.id, couponPayment!);
      if (completion.reviewId) return respondWithReview(completion.reviewId);
    } else {
      let reviewId = await recordReview();
      if (reviewId) return respondWithReview(reviewId);
      let { error: upsertErr } = await db.from('enrollments').upsert(
        {
          ...base,
          billing_country: order.notes?.billing_country || null,
          billing_region: order.currency === 'INR' ? 'india' : 'international',
          billing_state: order.notes?.billing_state || null,
        },
        { onConflict: 'user_id,course_id' },
      );
      if (upsertErr) {
        reviewId = await recordReview();
        if (reviewId) return respondWithReview(reviewId);
      }
      if (upsertErr?.code === 'PGRST204') {
        // Retain support for the earlier invoicing schema on regular paid accounts.
        ({ error: upsertErr } = await db
          .from('enrollments')
          .upsert(base, { onConflict: 'user_id,course_id' }));
        if (upsertErr) {
          reviewId = await recordReview();
          if (reviewId) return respondWithReview(reviewId);
        }
      }
      if (upsertErr) return res.status(500).json({ error: upsertErr.message });
    }
  } catch (error) {
    return res.status(error instanceof SponsorshipPaymentReviewError ? error.status : 500)
      .json({ error: error instanceof Error ? error.message : 'Could not reconcile this payment. Please contact KnowGraph.' });
  }

  // Courses that also live in the Knowgraph app unlock there too — keyed by
  // the buyer's email, applied instantly or parked until they sign in.
  let appUnlocked = false;
  const kgSecret = process.env.KG_PAYMENT_SECRET?.trim();
  const email = userData.user.email;
  if (kgSecret && email) {
    try {
      const { data: c } = await db
        .from('courses').select('title').eq('id', courseId).maybeSingle();
      const APP_COURSE: Record<string, string> = {
        'Computer Vision & Generative AI': 'computer-vision-generative-ai',
        'Physical AI & Robotics': 'physical-ai-robotics',
        'CI/CD Foundations: From Git Commit to Kubernetes Cluster':
          'cicd-foundations',
      };
      const appCourseId = c?.title ? APP_COURSE[c.title] : undefined;
      if (appCourseId) {
        const kgApi =
          process.env.KG_API_URL ?? 'https://knowgraph-api.greenlifeai.workers.dev';
        const fwd = JSON.stringify({
          type: 'course',
          userId: `lms:${userData.user.id}`,
          courseId: appCourseId,
          amountCents: order.amount ?? 0,
          email,
        });
        const mac = createHmac('sha256', kgSecret).update(fwd).digest('hex');
        const r2 = await fetch(`${kgApi}/v1/webhooks/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Signature': mac },
          body: fwd,
        });
        appUnlocked = r2.ok;
      }
    } catch {
      // LMS enrollment stands; app unlock arrives when they sign in
    }
  }

  return res.status(200).json({ verified: true, enrolled: true, appUnlocked });
}
