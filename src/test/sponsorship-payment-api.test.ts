// @vitest-environment node
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ enrollment: vi.fn(), course: vi.fn(), upsert: vi.fn(), rpc: vi.fn(), getUser: vi.fn(), createUser: vi.fn(), fetch: vi.fn() }));

vi.mock('../../api/_lib/groq.js', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        ilike: () => chain,
        maybeSingle: table === 'enrollments' ? mocks.enrollment : mocks.course,
        upsert: mocks.upsert,
      };
      return chain;
    },
    rpc: mocks.rpc,
    auth: { admin: { createUser: mocks.createUser } },
  }),
  supabaseAsCaller: () => ({ auth: { getUser: mocks.getUser } }),
}));

import orderHandler from '../../api/razorpay-order';
import verifyHandler from '../../api/razorpay-verify';
import grantHandler from '../../api/payment-grant';

function response() {
  return {
    statusCode: 200,
    payload: {} as Record<string, unknown>,
    status(code: number) { this.statusCode = code; return this; },
    json(body: Record<string, unknown>) { this.payload = body; return this; },
    end() { return this; },
  };
}

async function callOrder() {
  const res = response();
  await orderHandler({ method: 'POST', headers: { authorization: 'Bearer session' }, body: { courseId: 'course-1' } } as VercelRequest, res as unknown as VercelResponse);
  return res;
}

async function callVerify(signature?: string) {
  const res = response();
  const body = {
    razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1',
    razorpay_signature: signature ?? createHmac('sha256', 'razorpay-secret').update('order_1|pay_1').digest('hex'),
  };
  await verifyHandler({ method: 'POST', headers: { authorization: 'Bearer session' }, body } as VercelRequest, res as unknown as VercelResponse);
  return res;
}

async function callGrant(overrides: Record<string, unknown> = {}, signature?: string) {
  const payload = JSON.stringify({ email: 'student@example.com', courseSlug: 'ai', amountCents: 150000, paymentId: 'pay_1', ...overrides });
  const req = Object.assign(Readable.from([payload]), {
    method: 'POST', headers: { 'x-signature': signature ?? createHmac('sha256', 'marketing-secret').update(payload).digest('hex') },
  });
  const res = response();
  await grantHandler(req as unknown as VercelRequest, res as unknown as VercelResponse);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test');
  vi.stubEnv('RAZORPAY_KEY_SECRET', 'razorpay-secret');
  vi.stubEnv('KG_PAYMENT_SECRET', 'marketing-secret');
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.enrollment.mockResolvedValue({ data: null, error: null });
  mocks.course.mockResolvedValue({ data: { id: 'course-1', title: 'AI Bootcamp for Autonomous Driving', price_india: 1500, is_published: true }, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: 'review-1', error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'student@example.com' } }, error: null });
  mocks.createUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mocks.fetch.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => url.includes('/payments/')
    ? { id: 'pay_1', order_id: 'order_1', amount: 150000, currency: 'INR', status: 'captured', captured: true, amount_refunded: 0 }
    : { id: 'order_1', amount: 150000, currency: 'INR', notes: { lms_user_id: 'user-1', course_id: 'course-1' } } }));
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('checkout order protection', () => {
  it.each([
    { status: 'approved', access_source: 'paid' },
    { status: 'approved', access_source: 'sponsorship' },
    { status: 'pending', access_source: 'sponsorship' },
  ])('does not create a charge for an enrolled learner: %s', async enrollment => {
    mocks.enrollment.mockResolvedValue({ data: enrollment, error: null });
    const res = await callOrder();
    expect(res.statusCode).toBe(409);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('fails closed when existing access cannot be determined', async () => {
    mocks.enrollment.mockResolvedValue({ data: null, error: { message: 'Database unavailable' } });
    const res = await callOrder();
    expect(res.statusCode).toBe(503);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('allows normal checkout after confirming no existing access', async () => {
    const res = await callOrder();
    expect(res.statusCode).toBe(200);
    expect(res.payload.order_id).toBe('order_1');
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });
});

describe('signed Razorpay payment verification', () => {
  it('records a late sponsored payment and preserves the free enrollment', async () => {
    mocks.enrollment.mockResolvedValue({ data: { access_source: 'sponsorship' }, error: null });
    const res = await callVerify();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ verified: true, enrolled: true, paymentReviewRequired: true, reviewId: 'review-1' });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('record_sponsorship_payment_review', expect.objectContaining({ p_amount: 1500, p_currency: 'INR', p_payment_reference: 'pay_1', p_source: 'razorpay-verify' }));
  });

  it('handles a coupon redeemed concurrently with the paid upsert', async () => {
    mocks.enrollment.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: { access_source: 'sponsorship' }, error: null });
    mocks.upsert.mockResolvedValue({ error: { code: 'P0001', message: 'Sponsored payment snapshot is immutable' } });
    const res = await callVerify();
    expect(res.statusCode).toBe(200);
    expect(res.payload.paymentReviewRequired).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it('records new money arriving after a different confirmed paid enrollment', async () => {
    mocks.enrollment.mockResolvedValue({ data: { access_source: 'payment', payment_confirmed: true, payment_reference: 'pay_original' }, error: null });
    const res = await callVerify();
    expect(res.statusCode).toBe(200);
    expect(res.payload.paymentReviewRequired).toBe(true);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('does not claim success if the review could not be recorded', async () => {
    mocks.enrollment.mockResolvedValue({ data: { access_source: 'sponsorship' }, error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Review insert failed' } });
    const res = await callVerify();
    expect(res.statusCode).toBe(500);
    expect(res.payload.verified).toBeUndefined();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('retains signature verification before any entitlement lookup or review', async () => {
    const res = await callVerify('invalid');
    expect(res.statusCode).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.enrollment).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('keeps the regular paid enrollment path and actual amount snapshot', async () => {
    const res = await callVerify();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ verified: true, enrolled: true, appUnlocked: false });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ amount_paid: 1500, currency: 'INR', payment_confirmed: true }), { onConflict: 'user_id,course_id' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('does not grant regular paid access for an authorized but uncaptured payment', async () => {
    mocks.fetch.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => url.includes('/payments/')
      ? { id: 'pay_1', order_id: 'order_1', amount: 150000, currency: 'INR', status: 'authorized', captured: false }
      : { id: 'order_1', amount: 150000, currency: 'INR', notes: { lms_user_id: 'user-1', course_id: 'course-1' } } }));
    const res = await callVerify();
    expect(res.statusCode).toBe(409);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe('signed marketing payment grants', () => {
  it('records a late sponsored payment without changing its zero-value enrollment', async () => {
    mocks.enrollment.mockResolvedValue({ data: { access_source: 'sponsorship' }, error: null });
    const res = await callGrant();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ ok: true, userId: 'user-1', courseId: 'course-1', paymentReviewRequired: true, reviewId: 'review-1' });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('record_sponsorship_payment_review', expect.objectContaining({ p_amount: 1500, p_currency: 'INR', p_source: 'payment-grant' }));
  });

  it('rechecks sponsored access after a concurrent redemption rejects the paid upsert', async () => {
    mocks.enrollment.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: { access_source: 'sponsorship' }, error: null });
    mocks.upsert.mockResolvedValue({ error: { message: 'Sponsored payment snapshot is immutable' } });
    const res = await callGrant();
    expect(res.statusCode).toBe(200);
    expect(res.payload.paymentReviewRequired).toBe(true);
  });

  it('requires an actual amount for a sponsored payment review', async () => {
    mocks.enrollment.mockResolvedValue({ data: { access_source: 'sponsorship' }, error: null });
    const res = await callGrant({ amountCents: undefined });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/actual positive gateway amountCents/);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('does not claim a grant when recording a sponsored payment fails', async () => {
    mocks.enrollment.mockResolvedValue({ data: { access_source: 'sponsorship' }, error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Review insert failed' } });
    const res = await callGrant();
    expect(res.statusCode).toBe(500);
    expect(res.payload.ok).toBeUndefined();
  });

  it('retains HMAC signature validation before processing grants', async () => {
    const res = await callGrant({}, 'invalid');
    expect(res.statusCode).toBe(401);
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('records actual INR money on the normal paid path', async () => {
    const res = await callGrant();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ ok: true, userId: 'user-1', courseId: 'course-1' });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ amount_paid: 1500, currency: 'INR', payment_confirmed: true }), { onConflict: 'user_id,course_id' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
