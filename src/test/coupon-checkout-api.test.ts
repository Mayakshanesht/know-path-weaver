// @vitest-environment node
import { createHmac } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ enrollment: vi.fn(), checkout: vi.fn(), course: vi.fn(), upsert: vi.fn(), reserve: vi.fn(), bind: vi.fn(), complete: vi.fn(), review: vi.fn(), getUser: vi.fn(), fetch: vi.fn() }));
vi.mock('../../api/_lib/groq.js', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: table === 'enrollments' ? mocks.enrollment : table === 'coupon_checkouts' ? mocks.checkout : mocks.course, upsert: mocks.upsert };
      return chain;
    },
    rpc: (name: string, args: unknown) => name === 'record_coupon_gateway_order' ? mocks.bind(args) : name === 'complete_coupon_checkout' ? mocks.complete(args) : mocks.review(args),
  }),
  supabaseAsCaller: () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.reserve }),
}));

import orderHandler from '../../api/razorpay-order';
import verifyHandler from '../../api/razorpay-verify';

const checkoutId = '10000000-0000-0000-0000-000000000001';
let snapshot: Record<string, unknown>;
let order: Record<string, unknown>;
let createdOrder: Record<string, unknown>;
let payment: Record<string, unknown>;
let attempts: Array<Record<string, unknown>>;

function response() {
  return { statusCode: 200, payload: {} as Record<string, unknown>, status(code: number) { this.statusCode = code; return this; }, json(value: Record<string, unknown>) { this.payload = value; return this; }, end() { return this; } };
}
async function callOrder(overrides: Record<string, unknown> = {}) {
  const res = response();
  const body = { courseId: 'course-1', couponCode: 'TEAM-PRIVATE', fullName: 'Student One', college: 'Example College', expectedAmountCents: 112500, expectedCurrency: 'INR', billingCountry: 'IN', billingState: 'Maharashtra', ...overrides };
  await orderHandler({ method: 'POST', headers: { authorization: 'Bearer verified-user' }, body } as VercelRequest, res as unknown as VercelResponse);
  return res;
}
async function callVerify() {
  const res = response();
  const body = { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: createHmac('sha256', 'gateway-secret').update('order_1|pay_1').digest('hex') };
  await verifyHandler({ method: 'POST', headers: { authorization: 'Bearer verified-user' }, body } as VercelRequest, res as unknown as VercelResponse);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test');
  vi.stubEnv('RAZORPAY_KEY_SECRET', 'gateway-secret');
  vi.stubEnv('KG_PAYMENT_SECRET', '');
  vi.stubGlobal('fetch', mocks.fetch);
  snapshot = { id: checkoutId, checkout_id: checkoutId, user_id: 'user-1', course_id: 'course-1', title: 'ADAS course', course_title: 'ADAS course', list_price: 1500, discount_percent: 25, discount_amount: 375, total: 1125, currency: 'INR', gateway_order_id: null, campaign: 'Team discount', sponsorship_campaign: 'Team discount', team_name: 'Team One' };
  order = { id: 'order_1', amount: 112500, currency: 'INR', status: 'created', attempts: 0, notes: { lms_user_id: 'user-1', course_id: 'course-1', coupon_checkout_id: checkoutId } };
  createdOrder = { ...order };
  payment = { id: 'pay_1', order_id: 'order_1', amount: 112500, currency: 'INR', status: 'captured', captured: true, amount_refunded: 0 };
  attempts = [];
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'student@example.com' } }, error: null });
  mocks.enrollment.mockResolvedValue({ data: null, error: null });
  mocks.course.mockResolvedValue({ data: { id: 'course-1', title: 'ADAS course', is_published: true, price_india: 1500 }, error: null });
  mocks.checkout.mockImplementation(async () => ({ data: { ...snapshot }, error: null }));
  mocks.reserve.mockImplementation(async () => ({ data: { ...snapshot }, error: null }));
  mocks.bind.mockImplementation(async (args: { p_order_id: string }) => { snapshot.gateway_order_id = args.p_order_id; return { error: null }; });
  mocks.complete.mockResolvedValue({ data: { checkout_id: checkoutId, enrollment_id: 'enrollment-1', invoice_id: 'invoice-1', already_completed: false }, error: null });
  mocks.review.mockResolvedValue({ data: 'review-1', error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.fetch.mockImplementation(async (url: string, init?: { method?: string }) => ({
    ok: true, status: 200,
    json: async () => url.endsWith('/payments') ? { items: attempts } : url.includes('/payments/') ? { ...payment } : init?.method === 'POST' ? { ...createdOrder } : { ...order },
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('server-priced coupon orders', () => {
  it('charges only the reserved server amount and returns discount metadata', async () => {
    const res = await callOrder({ amount: 1, discountPercent: 99 });
    expect(res.statusCode).toBe(200);
    expect(mocks.reserve).toHaveBeenCalledWith('reserve_coupon_checkout', expect.objectContaining({ p_code: 'TEAM-PRIVATE', p_full_name: 'Student One', p_billing_country: 'IN', p_billing_state: 'Maharashtra' }));
    const gatewayCall = mocks.fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    const request = JSON.parse(gatewayCall?.[1].body);
    expect(request.amount).toBe(112500);
    expect(request.notes.coupon_checkout_id).toBe(checkoutId);
    expect(request.notes).not.toHaveProperty('coupon_code');
    expect(request.receipt.length).toBeLessThanOrEqual(40);
    expect(res.payload).toMatchObject({ amount: 112500, discount_percent: 25, discount_amount: 375, total: 1125 });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects a changed displayed amount without creating a charge', async () => {
    const res = await callOrder({ expectedAmountCents: 1 });
    expect(res.statusCode).toBe(409);
    expect(res.payload.error).toMatch(/price changed/);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('rejects a missing displayed price confirmation', async () => {
    const res = await callOrder({ expectedAmountCents: undefined });
    expect(res.statusCode).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('sends 100% coupons to explicit free enrollment without any gateway order', async () => {
    Object.assign(snapshot, { discount_percent: 100, discount_amount: 1500, total: 0 });
    const res = await callOrder({ expectedAmountCents: 0 });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/Complete free enrollment/);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('does not turn a below-minimum partial payment into free access', async () => {
    Object.assign(snapshot, { list_price: 10, discount_percent: 95, discount_amount: 9.5, total: 0.5 });
    const res = await callOrder({ expectedAmountCents: 50 });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/minimum of INR 1.00/);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('resumes the existing unused order instead of creating another', async () => {
    snapshot.gateway_order_id = 'order_1';
    const res = await callOrder();
    expect(res.statusCode).toBe(200);
    expect(res.payload.order_id).toBe('order_1');
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.fetch.mock.calls[0][1].method).toBeUndefined();
    expect(mocks.bind).not.toHaveBeenCalled();
  });

  it('can retry a bound attempted order when all previous payments failed', async () => {
    snapshot.gateway_order_id = 'order_1';
    Object.assign(order, { status: 'attempted', attempts: 1 });
    attempts = [{ status: 'failed' }];
    expect((await callOrder()).statusCode).toBe(200);
    expect(mocks.bind).not.toHaveBeenCalled();
  });

  it('does not create a duplicate charge while an attempted payment is authorized', async () => {
    snapshot.gateway_order_id = 'order_1';
    Object.assign(order, { status: 'attempted', attempts: 1 });
    attempts = [{ status: 'authorized' }];
    const res = await callOrder();
    expect(res.statusCode).toBe(409);
    expect(mocks.bind).not.toHaveBeenCalled();
    expect(mocks.fetch.mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });

  it('returns only the canonical bound order when another request wins binding', async () => {
    createdOrder.id = 'order_unbound';
    mocks.bind.mockImplementation(async () => { snapshot.gateway_order_id = 'order_1'; return { error: { message: 'Checkout is already bound to another gateway order' } }; });
    const res = await callOrder();
    expect(res.statusCode).toBe(200);
    expect(res.payload.order_id).toBe('order_1');
    expect(JSON.stringify(res.payload)).not.toContain('order_unbound');
  });

  it('recovers a captured paid order whose browser callback was lost without charging again', async () => {
    snapshot.gateway_order_id = 'order_1';
    order.status = 'paid';
    attempts = [payment];
    const res = await callOrder();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ verified: true, enrolled: true, already_paid: true });
    expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({ p_payment_reference: 'pay_1', p_amount: 1125 }));
    expect(mocks.fetch.mock.calls.every(([, init]) => !init?.method)).toBe(true);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('does not expose an unbound order when saving its binding fails', async () => {
    mocks.bind.mockResolvedValue({ error: { message: 'Database unavailable' } });
    const res = await callOrder();
    expect(res.statusCode).toBe(503);
    expect(res.payload.order_id).toBeUndefined();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});

describe('captured coupon payment completion', () => {
  beforeEach(() => { snapshot.gateway_order_id = 'order_1'; });

  it('finalizes the exact captured amount only through the service RPC', async () => {
    const res = await callVerify();
    expect(res.statusCode).toBe(200);
    expect(res.payload.enrolled).toBe(true);
    expect(mocks.complete).toHaveBeenCalledWith({ p_checkout_id: checkoutId, p_user_id: 'user-1', p_payment_reference: 'pay_1', p_order_id: 'order_1', p_amount: 1125, p_currency: 'INR' });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('preserves app-unlock forwarding with the actual discounted payment amount', async () => {
    vi.stubEnv('KG_PAYMENT_SECRET', 'app-webhook-secret');
    mocks.course.mockResolvedValue({ data: { title: 'Computer Vision & Generative AI' }, error: null });
    const res = await callVerify();
    expect(res.payload.appUnlocked).toBe(true);
    const forwarded = mocks.fetch.mock.calls.find(([url]) => String(url).includes('/v1/webhooks/payment'));
    expect(JSON.parse(forwarded?.[1].body)).toMatchObject({ amountCents: 112500, email: 'student@example.com', courseId: 'computer-vision-generative-ai' });
  });

  it.each([
    { amount: 112499 }, { currency: 'EUR' }, { order_id: 'order_other' },
    { status: 'authorized', captured: false }, { amount_refunded: 10 },
  ])('rejects mismatched or unsettled actual payment: %s', async override => {
    Object.assign(payment, override);
    const res = await callVerify();
    expect(res.statusCode).toBe(409);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects a replay against a checkout owned by another account', async () => {
    snapshot.user_id = 'different-user';
    const res = await callVerify();
    expect(res.statusCode).toBe(403);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('returns an idempotent completed checkout without a paid-upsert fallback', async () => {
    mocks.complete.mockResolvedValue({ data: { enrollment_id: 'enrollment-1', already_completed: true }, error: null });
    expect((await callVerify()).statusCode).toBe(200);
    expect((await callVerify()).statusCode).toBe(200);
    expect(mocks.complete).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('records a late payment for existing sponsored access instead of changing its receipt', async () => {
    mocks.enrollment.mockResolvedValue({ data: { access_source: 'sponsorship' }, error: null });
    const res = await callVerify();
    expect(res.payload).toMatchObject({ enrolled: true, paymentReviewRequired: true, reviewId: 'review-1' });
    expect(mocks.complete).toHaveBeenCalledOnce();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rechecks sponsorship after a concurrent free redemption rejects paid completion', async () => {
    mocks.enrollment.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: { access_source: 'sponsorship' }, error: null });
    mocks.complete.mockResolvedValue({ data: null, error: { message: 'Sponsored receipt is immutable' } });
    const res = await callVerify();
    expect(res.payload.paymentReviewRequired).toBe(true);
    expect(mocks.review).toHaveBeenCalledOnce();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('surfaces a service-recorded duplicate paid purchase as requiring review', async () => {
    mocks.complete.mockResolvedValue({ data: { enrollment_id: 'old-enrollment', payment_review_required: true, review_id: 'duplicate-review' }, error: null });
    const res = await callVerify();
    expect(res.payload).toMatchObject({ enrolled: true, paymentReviewRequired: true, reviewId: 'duplicate-review' });
  });

  it('does not fall back to a paid upsert when coupon completion fails', async () => {
    mocks.complete.mockResolvedValue({ data: null, error: { message: 'Checkout was already completed with another payment' } });
    const res = await callVerify();
    expect(res.statusCode).toBe(500);
    expect(res.payload.enrolled).toBeUndefined();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
