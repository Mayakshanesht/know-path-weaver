import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, supabaseAsCaller } from './_lib/groq.js';
import { assertCouponOrder, assertReusableCouponOrder, CouponCheckoutError, loadCouponCheckout, parseCouponCheckout, recoverPaidCouponOrder, type CouponCheckout, type GatewayOrder } from './_lib/coupon-checkout.js';

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

  const { courseId, billingCountry, billingState, region, couponCode, fullName, college, expectedAmountCents, expectedCurrency } = (req.body ?? {}) as {
    courseId?: string; billingCountry?: string; billingState?: string; region?: string;
    couponCode?: string; fullName?: string; college?: string;
    expectedAmountCents?: number; expectedCurrency?: string;
  };
  if (!courseId) return res.status(400).json({ error: 'courseId required' });
  if (couponCode !== undefined && (typeof couponCode !== 'string' || !couponCode.trim())) {
    return res.status(400).json({ error: 'Apply a valid coupon before continuing.' });
  }

  const db = supabaseAdmin();
  const { data: enrollment, error: enrollmentError } = await db
    .from('enrollments')
    .select('status, access_source')
    .eq('user_id', userData.user.id)
    .eq('course_id', courseId)
    .maybeSingle();
  if (enrollmentError) {
    return res.status(503).json({ error: 'Could not confirm course access. Please try again before paying.' });
  }
  if (enrollment?.status === 'approved' || enrollment?.access_source === 'sponsorship') {
    return res.status(409).json({ error: 'You already have access to this course.', code: 'COURSE_ACCESS_ALREADY_GRANTED' });
  }
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
  const auth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  try {
    let checkout: CouponCheckout | null = null;
    if (couponCode) {
      if (!Number.isSafeInteger(expectedAmountCents) || expectedAmountCents < 0 || typeof expectedCurrency !== 'string') {
        return res.status(400).json({ error: 'Apply your coupon again to confirm the price before paying.' });
      }
      // Caller-scoped RPC validates the verified account, eligibility and seat
      // claim. Its immutable snapshot, never the browser price, sets the charge.
      const { data, error } = await caller.rpc('reserve_coupon_checkout', {
        p_code: couponCode.trim(), p_course_id: courseId,
        p_region: india ? 'india' : 'international',
        p_full_name: fullName?.trim() || '', p_college: college?.trim() || '',
        p_billing_country: billingCountry || null, p_billing_state: billingState || null,
      });
      if (error) return res.status(400).json({ error: /100.*free enrollment/i.test(error.message) ? 'Use Complete free enrollment for a 100% coupon. No payment is required.' : error.message });
      checkout = parseCouponCheckout(data);
      if (checkout.courseId !== courseId || (checkout.userId && checkout.userId !== userData.user.id)) {
        throw new CouponCheckoutError('The saved coupon checkout does not match this course or account.', 409);
      }
      if (checkout.amountMinor !== expectedAmountCents || checkout.currency !== expectedCurrency) {
        throw new CouponCheckoutError('The coupon price changed. Apply your coupon again and confirm the updated amount before paying.', 409);
      }
      if (checkout.currency === 'INR' && checkout.amountMinor < 100) {
        throw new CouponCheckoutError('The discounted amount is below the gateway minimum of INR 1.00. Contact KnowGraph for an adjusted coupon before paying.', 400);
      }
    } else if (!price || price <= 0) {
      return res.status(400).json({ error: 'course not priced' });
    }

    const fetchOrder = async (id: string): Promise<GatewayOrder> => {
      const response = await fetch(`${RZP}/orders/${encodeURIComponent(id)}`, { headers: { Authorization: auth } });
      if (!response.ok) throw new CouponCheckoutError('Could not load the previous gateway order. Please retry shortly.', 502);
      return response.json();
    };
    const recoverPaid = async (order: GatewayOrder, snapshot: CouponCheckout) => {
      const completion = await recoverPaidCouponOrder(db, order, snapshot, userData.user.id, auth);
      return res.status(200).json({
        verified: true, enrolled: true, already_paid: true,
        ...(completion.reviewId ? { paymentReviewRequired: true, reviewId: completion.reviewId } : {}),
      });
    };
    let order: GatewayOrder;
    if (checkout?.gatewayOrderId) {
      order = await fetchOrder(checkout.gatewayOrderId);
      assertCouponOrder(order, checkout, userData.user.id);
      if (order.status === 'paid') return await recoverPaid(order, checkout);
      await assertReusableCouponOrder(order, auth);
    } else {
      const response = await fetch(`${RZP}/orders`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: checkout?.amountMinor ?? Math.round(Number(price) * 100),
          currency: checkout?.currency ?? (india ? 'INR' : 'EUR'),
          receipt: checkout ? `coupon_${checkout.checkoutId.replace(/-/g, '')}` : `lms_${Date.now()}`,
          notes: {
            lms_user_id: userData.user.id, course_id: course.id,
            billing_country: billingCountry ?? '', billing_state: billingState ?? '',
            ...(checkout ? { coupon_checkout_id: checkout.checkoutId } : {}),
          },
        }),
      });
      order = await response.json();
      if (response.status === 401) return res.status(502).json({ error: 'razorpay auth failed' });
      if (!response.ok || !order.id) return res.status(502).json({ error: 'Could not create the gateway order. Please try again.' });
      if (checkout) {
        assertCouponOrder(order, checkout, userData.user.id);
        const { error: bindError } = await db.rpc('record_coupon_gateway_order', {
          p_checkout_id: checkout.checkoutId, p_order_id: order.id,
        });
        const persisted = await loadCouponCheckout(db, checkout.checkoutId, userData.user.id, courseId);
        if (!persisted.gatewayOrderId) {
          throw new CouponCheckoutError(`The gateway order could not be linked. Please retry before paying.${bindError ? ` ${bindError.message}` : ''}`, 503);
        }
        // A concurrent request may win the one-time binding. Return only that
        // canonical order; the unbound order from this request is never exposed.
        if (persisted.gatewayOrderId !== order.id) {
          order = await fetchOrder(persisted.gatewayOrderId);
          assertCouponOrder(order, persisted, userData.user.id);
          if (order.status === 'paid') return await recoverPaid(order, persisted);
          await assertReusableCouponOrder(order, auth);
        }
        checkout = persisted;
        assertCouponOrder(order, checkout, userData.user.id);
      }
    }
    return res.status(200).json({
      order_id: order.id, amount: order.amount, currency: order.currency,
      key_id: keyId, course_title: course.title,
      ...(checkout ? {
        coupon_checkout_id: checkout.checkoutId, list_price: checkout.listPrice,
        discount_percent: checkout.discountPercent, discount_amount: checkout.discountAmount,
        total: checkout.total, campaign: checkout.campaign, team_name: checkout.teamName,
      } : {}),
    });
  } catch (error) {
    return res.status(error instanceof CouponCheckoutError ? error.status : 502)
      .json({ error: error instanceof Error ? error.message : 'Could not prepare checkout. Please try again.' });
  }
}
