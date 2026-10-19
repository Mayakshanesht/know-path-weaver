import type { SupabaseClient } from '@supabase/supabase-js';
import { recordSponsorshipPaymentReview } from './sponsorship-payment.js';

export class CouponCheckoutError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
    this.name = 'CouponCheckoutError';
  }
}

export interface CouponCheckout {
  checkoutId: string;
  courseId: string;
  userId?: string;
  title: string;
  listPrice: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  amountMinor: number;
  currency: 'INR' | 'EUR';
  gatewayOrderId: string | null;
  campaign: string;
  teamName: string | null;
}

export interface GatewayOrder {
  id: string;
  amount: number;
  currency: string;
  status?: string;
  attempts?: number;
  notes?: Record<string, string>;
}

export interface GatewayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
  amount_refunded?: number;
}

function moneyMinor(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new CouponCheckoutError('The saved coupon checkout has an invalid price.');
  }
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result) || Math.abs(value * 100 - result) > 0.00001) {
    throw new CouponCheckoutError('The saved coupon checkout has an invalid currency amount.');
  }
  return result;
}

/** The database's immutable price is authoritative; the browser supplies no amounts. */
export function parseCouponCheckout(value: unknown): CouponCheckout {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CouponCheckoutError('Could not load the saved coupon checkout.');
  const row = value as Record<string, unknown>;
  if (row.discount_percent === 100) throw new CouponCheckoutError('Use Complete free enrollment for a 100% coupon. No payment is required.', 400);
  const listPriceMinor = moneyMinor(row.list_price);
  const discountMinor = moneyMinor(row.discount_amount);
  const totalMinor = moneyMinor(row.total);
  const percent = row.discount_percent;
  const id = row.checkout_id ?? row.id;
  if (typeof id !== 'string' || !id || typeof row.course_id !== 'string' ||
      typeof percent !== 'number' || !Number.isFinite(percent) || percent <= 0 || percent >= 100 ||
      Math.abs(percent * 100 - Math.round(percent * 100)) > 0.00001 ||
      totalMinor <= 0 || listPriceMinor - discountMinor !== totalMinor ||
      (row.currency !== 'INR' && row.currency !== 'EUR')) {
    throw new CouponCheckoutError('The saved coupon checkout is inconsistent. Please contact KnowGraph.');
  }
  return {
    checkoutId: id,
    courseId: row.course_id,
    userId: typeof row.user_id === 'string' ? row.user_id : undefined,
    title: typeof row.title === 'string' ? row.title : String(row.course_title ?? ''),
    listPrice: listPriceMinor / 100,
    discountPercent: percent,
    discountAmount: discountMinor / 100,
    total: totalMinor / 100,
    amountMinor: totalMinor,
    currency: row.currency,
    gatewayOrderId: typeof row.gateway_order_id === 'string' ? row.gateway_order_id : null,
    campaign: String(row.campaign ?? row.sponsorship_campaign ?? ''),
    teamName: typeof row.team_name === 'string' ? row.team_name : null,
  };
}

export async function loadCouponCheckout(db: SupabaseClient, checkoutId: string, userId: string, courseId: string): Promise<CouponCheckout> {
  const { data, error } = await db.from('coupon_checkouts')
    .select('id, user_id, course_id, course_title, list_price, discount_percent, discount_amount, total, currency, gateway_order_id, sponsorship_campaign, team_name')
    .eq('id', checkoutId).maybeSingle();
  if (error) throw new CouponCheckoutError(`Could not load coupon checkout: ${error.message}`, 503);
  if (!data) throw new CouponCheckoutError('The coupon checkout was not found.', 404);
  const checkout = parseCouponCheckout(data);
  if (checkout.userId !== userId) throw new CouponCheckoutError('The coupon checkout belongs to a different account.', 403);
  if (checkout.courseId !== courseId) throw new CouponCheckoutError('The coupon checkout does not match this course.', 400);
  return checkout;
}

export function assertCouponOrder(order: GatewayOrder, checkout: CouponCheckout, userId: string) {
  if (!order?.id || (checkout.gatewayOrderId && order.id !== checkout.gatewayOrderId) || order.amount !== checkout.amountMinor || order.currency !== checkout.currency ||
      order.notes?.lms_user_id !== userId || order.notes?.course_id !== checkout.courseId ||
      order.notes?.coupon_checkout_id !== checkout.checkoutId) {
    throw new CouponCheckoutError('The gateway order does not match the saved coupon checkout.', 409);
  }
}

export function assertCapturedGatewayPayment(payment: GatewayPayment, order: GatewayOrder, paymentId = payment?.id) {
  if (!payment?.id || payment.id !== paymentId || payment.order_id !== order.id ||
      !Number.isSafeInteger(payment.amount) || payment.amount <= 0 ||
      payment.amount !== order.amount || payment.currency !== order.currency) {
    throw new CouponCheckoutError('The actual payment does not match the gateway order amount, currency or order.', 409);
  }
  if (payment.status !== 'captured' || payment.captured !== true || (payment.amount_refunded ?? 0) > 0) {
    throw new CouponCheckoutError('The gateway payment is not captured or has a refund. Check its status before retrying verification.', 409);
  }
}

export function assertCapturedCouponPayment(payment: GatewayPayment, order: GatewayOrder, checkout: CouponCheckout, paymentId = payment?.id) {
  assertCapturedGatewayPayment(payment, order, paymentId);
  if (payment.amount !== checkout.amountMinor || payment.currency !== checkout.currency) {
    throw new CouponCheckoutError('The actual payment does not match the saved coupon checkout amount or currency.', 409);
  }
}

export async function completeCouponPayment(db: SupabaseClient, checkout: CouponCheckout, userId: string, payment: GatewayPayment) {
  const review = () => recordSponsorshipPaymentReview(db, {
    userId, courseId: checkout.courseId, paymentReference: payment.id,
    amount: payment.amount / 100, currency: payment.currency, source: 'razorpay-verify',
  });
  let reviewId = await review();
  // Even a pre-recorded collision goes through completion so the checkout is
  // marked needs_review atomically by the service RPC, preserving its audit trail.
  const { data, error } = await db.rpc('complete_coupon_checkout', {
    p_checkout_id: checkout.checkoutId, p_user_id: userId,
    p_payment_reference: payment.id, p_order_id: payment.order_id,
    p_amount: payment.amount / 100, p_currency: payment.currency,
  });
  if (error) {
    if (reviewId) return { reviewId, enrollmentId: null };
    reviewId = await review();
    if (reviewId) return { reviewId, enrollmentId: null };
    throw new CouponCheckoutError(error.message);
  }
  if (data?.payment_review_required === true) {
    if (typeof data.review_id !== 'string' || !data.review_id) throw new CouponCheckoutError('The payment review reference could not be confirmed.');
    return { reviewId: data.review_id as string, enrollmentId: null };
  }
  if (reviewId) return { reviewId, enrollmentId: null };
  if (typeof data?.enrollment_id !== 'string' || !data.enrollment_id) throw new CouponCheckoutError('The discounted enrollment could not be confirmed.');
  return { reviewId: null, enrollmentId: data.enrollment_id as string };
}

/** Recover a captured purchase when the browser lost the checkout callback. */
export async function recoverPaidCouponOrder(db: SupabaseClient, order: GatewayOrder, checkout: CouponCheckout, userId: string, authorization: string) {
  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(order.id)}/payments`, { headers: { Authorization: authorization } });
  if (!response.ok) throw new CouponCheckoutError('Could not verify the previous payment. Please retry shortly.', 502);
  const body = await response.json() as { items?: GatewayPayment[] };
  const captured = Array.isArray(body.items) ? body.items.filter(payment => payment.status === 'captured') : [];
  if (captured.length !== 1) throw new CouponCheckoutError('Could not confirm a single captured payment for this order. Contact KnowGraph before paying again.', 409);
  assertCapturedCouponPayment(captured[0], order, checkout);
  return completeCouponPayment(db, checkout, userId, captured[0]);
}

/** A bound order can resume only while no payment is captured or in progress. */
export async function assertReusableCouponOrder(order: GatewayOrder, authorization: string) {
  if (order.status === 'created' && (order.attempts ?? 0) === 0) return;
  if (order.status === 'attempted' || (order.status === 'created' && (order.attempts ?? 0) > 0)) {
    const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(order.id)}/payments`, { headers: { Authorization: authorization } });
    if (!response.ok) throw new CouponCheckoutError('Could not check the previous payment attempt. Please retry shortly.', 502);
    const body = await response.json() as { items?: Array<{ status?: string }> };
    if (Array.isArray(body.items) && body.items.length > 0 && body.items.every(payment => payment.status === 'failed')) return;
  }
  throw new CouponCheckoutError('This checkout has a completed or pending payment. Check your course access or contact KnowGraph before paying again.', 409);
}
