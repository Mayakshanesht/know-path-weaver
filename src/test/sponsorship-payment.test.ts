import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordSponsorshipPaymentReview } from '../../api/_lib/sponsorship-payment';

const maybeSingle = vi.fn();
const rpc = vi.fn();
const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle };
const db = { from: vi.fn(() => query), rpc } as unknown as SupabaseClient;
const payment = { userId: 'user-1', courseId: 'course-1', paymentReference: 'pay_1', amount: 1500, currency: 'INR', source: 'razorpay-verify' };

describe('late payment reconciliation for sponsored access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    rpc.mockResolvedValue({ data: 'review-1', error: null });
  });

  it('leaves regular payments on their existing path without calling the review RPC', async () => {
    expect(await recordSponsorshipPaymentReview(db, payment)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('records the genuine payment separately for a sponsored enrollment', async () => {
    maybeSingle.mockResolvedValue({ data: { access_source: 'sponsorship' }, error: null });
    expect(await recordSponsorshipPaymentReview(db, payment)).toBe('review-1');
    expect(rpc).toHaveBeenCalledWith('record_sponsorship_payment_review', {
      p_user_id: 'user-1', p_course_id: 'course-1', p_payment_reference: 'pay_1',
      p_amount: 1500, p_currency: 'INR', p_source: 'razorpay-verify',
    });
  });

  it('records different money arriving after an already-confirmed paid purchase', async () => {
    maybeSingle.mockResolvedValue({ data: { access_source: 'payment', payment_confirmed: true, payment_reference: 'pay_original' }, error: null });
    expect(await recordSponsorshipPaymentReview(db, payment)).toBe('review-1');
    expect(rpc).toHaveBeenCalledOnce();
  });

  it('does not classify the same confirmed payment callback as a duplicate purchase', async () => {
    maybeSingle.mockResolvedValue({ data: { access_source: 'payment', payment_confirmed: true, payment_reference: 'pay_1' }, error: null });
    expect(await recordSponsorshipPaymentReview(db, payment)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed when access cannot be checked', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'Database unavailable' } });
    await expect(recordSponsorshipPaymentReview(db, payment)).rejects.toThrow('Could not verify sponsored course access');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not report a review as recorded when the RPC fails', async () => {
    maybeSingle.mockResolvedValue({ data: { access_source: 'sponsorship' }, error: null });
    rpc.mockResolvedValue({ data: null, error: { message: 'Insert denied' } });
    await expect(recordSponsorshipPaymentReview(db, payment)).rejects.toThrow('Payment review could not be recorded: Insert denied');
  });

  it.each([null, 0, -10, NaN, Infinity, 1.001])('requires a positive actual payment amount for sponsored review: %s', async amount => {
    maybeSingle.mockResolvedValue({ data: { access_source: 'sponsorship' }, error: null });
    await expect(recordSponsorshipPaymentReview(db, { ...payment, amount })).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('preserves legacy behavior for regular payments without an amount snapshot', async () => {
    expect(await recordSponsorshipPaymentReview(db, { ...payment, amount: null })).toBeNull();
  });
});
