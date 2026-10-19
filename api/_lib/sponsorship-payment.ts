import type { SupabaseClient } from '@supabase/supabase-js';

interface PaymentSnapshot {
  userId: string;
  courseId: string;
  paymentReference: string;
  amount: number | null;
  currency: string;
  source: string;
}

export class SponsorshipPaymentReviewError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
    this.name = 'SponsorshipPaymentReviewError';
  }
}

/**
 * A checkout can finish after another payment or coupon already granted access.
 * Keep the existing enrollment/receipt intact and record new money separately.
 * Called again after a failed paid upsert to cover concurrent coupon redemption.
 */
export async function recordSponsorshipPaymentReview(db: SupabaseClient, payment: PaymentSnapshot): Promise<string | null> {
  const { data: enrollment, error: enrollmentError } = await db
    .from('enrollments')
    .select('access_source, payment_confirmed, payment_reference')
    .eq('user_id', payment.userId)
    .eq('course_id', payment.courseId)
    .maybeSingle();

  if (enrollmentError) {
    throw new SponsorshipPaymentReviewError(`Could not verify sponsored course access: ${enrollmentError.message}`);
  }
  const paidCollision = enrollment?.payment_confirmed === true && enrollment.payment_reference !== payment.paymentReference;
  if (enrollment?.access_source !== 'sponsorship' && !paidCollision) return null;

  const cents = payment.amount === null ? NaN : payment.amount * 100;
  if (!Number.isFinite(cents) || cents <= 0 || !Number.isSafeInteger(Math.round(cents)) || Math.abs(cents - Math.round(cents)) > 0.000001) {
    throw new SponsorshipPaymentReviewError(
      'This account already has course access. Supply the actual positive gateway amountCents to record this payment for review.',
      400,
    );
  }

  const { data: reviewId, error: reviewError } = await db.rpc('record_sponsorship_payment_review', {
    p_user_id: payment.userId,
    p_course_id: payment.courseId,
    p_payment_reference: payment.paymentReference,
    p_amount: payment.amount,
    p_currency: payment.currency,
    p_source: payment.source,
  });
  if (reviewError || typeof reviewId !== 'string' || !reviewId) {
    throw new SponsorshipPaymentReviewError(
      `Payment review could not be recorded: ${reviewError?.message || 'No review reference was returned.'}`,
    );
  }
  return reviewId;
}
