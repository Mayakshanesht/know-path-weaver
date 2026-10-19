import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: mocks } }));
import { payWithRazorpay } from '@/lib/razorpay';

let checkout: Record<string, any>;
let failure: (value: unknown) => void;
class CheckoutMock {
  constructor(options: Record<string, unknown>) { checkout = options; }
  open() {}
  on(_event: string, callback: (value: unknown) => void) { failure = callback; }
}

describe('secure checkout retries', () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } });
    window.Razorpay = CheckoutMock;
    checkout = undefined; failure = undefined;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true,
      json: async () => ({ order_id: 'order-1', amount: 7500, currency: 'INR', key_id: 'public-key' })
    }).mockResolvedValueOnce({ ok: true, json: async () => ({ enrolled: true }) }));
  });
  const start = () => payWithRazorpay({ courseId: 'course', region: 'india', couponCode: 'PRIVATE',
    fullName: 'Example Student', college: 'Example College', expectedAmountCents: 7500, expectedCurrency: 'INR' });

  it('waits for a successful retry rather than settling on the first failed attempt', async () => {
    const promise = start();
    await vi.waitFor(() => expect(checkout).toBeDefined());
    let settled = false; void promise.then(() => { settled = true; });
    failure({ error: { description: 'Card declined. Try another method.' } });
    await Promise.resolve();
    expect(settled).toBe(false);
    await checkout.handler({ razorpay_payment_id: 'pay-1', razorpay_order_id: 'order-1', razorpay_signature: 'server-validated' });
    expect(await promise).toEqual({ status: 'paid', paymentReviewRequired: false });
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body as string);
    expect(body).toMatchObject({ couponCode: 'PRIVATE', expectedAmountCents: 7500, expectedCurrency: 'INR' });
  });

  it('reports failure only after a failed checkout is actually dismissed', async () => {
    const promise = start();
    await vi.waitFor(() => expect(checkout).toBeDefined());
    failure({ error: { description: 'Card declined' } });
    checkout.modal.ondismiss();
    expect(await promise).toEqual({ status: 'failed', error: 'Card declined' });
  });
});
