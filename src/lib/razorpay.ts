/**
 * Razorpay Standard Web Checkout for the LMS.
 *
 * payWithRazorpay() asks the server for an order (the server owns the
 * price), opens the modal, and has the server verify the signature before
 * reporting success — at which point the enrollment is already approved
 * and payment-confirmed. The key secret never reaches the browser.
 */
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (resp: unknown) => void) => void;
    };
  }
}

const CHECKOUT_JS = 'https://checkout.razorpay.com/v1/checkout.js';

function loadCheckoutScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector(`script[src="${CHECKOUT_JS}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('checkout.js failed to load')),
      );
      return;
    }
    const s = document.createElement('script');
    s.src = CHECKOUT_JS;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('checkout.js failed to load'));
    document.body.appendChild(s);
  });
}

export interface PayResult {
  status: 'paid' | 'cancelled' | 'failed';
  error?: string;
  paymentReviewRequired?: boolean;
}

export async function payWithRazorpay(opts: {
  courseId: string;
  region: 'india' | 'international';
  billingCountry?: string;
  billingState?: string;
  couponCode?: string;
  fullName?: string;
  college?: string;
  expectedAmountCents?: number;
  expectedCurrency?: string;
}): Promise<PayResult> {
  await loadCheckoutScript();

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return { status: 'failed', error: 'Please sign in first.' };
  const authHeader = { Authorization: `Bearer ${token}` };

  const orderRes = await fetch('/api/razorpay-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({
      courseId: opts.courseId,
      region: opts.region,
      billingCountry: opts.billingCountry,
      billingState: opts.billingState,
      couponCode: opts.couponCode,
      fullName: opts.fullName,
      college: opts.college,
      expectedAmountCents: opts.expectedAmountCents,
      expectedCurrency: opts.expectedCurrency,
    }),
  });
  const order = await orderRes.json();
  // A previous captured payment may be recovered server-side after its browser
  // callback was interrupted. Do not open another charge for an enrolled order.
  if (orderRes.ok && order.enrolled === true) {
    return { status: 'paid', paymentReviewRequired: Boolean(order.paymentReviewRequired) };
  }
  if (!orderRes.ok || !order.order_id) {
    return {
      status: 'failed',
      error:
        typeof order?.error === 'string'
          ? order.error
          : 'Could not start checkout — please try again.',
    };
  }

  return new Promise((resolve) => {
    let lastFailure: string | undefined;
    const rzp = new window.Razorpay!({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: 'KnowGraph Courses',
      description: order.course_title ?? 'Course enrollment',
      theme: { color: '#6d28d9' },
      modal: { ondismiss: () => resolve(lastFailure ? { status: 'failed', error: lastFailure } : { status: 'cancelled' }) },
      handler: async (resp: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        try {
          const v = await fetch('/api/razorpay-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify(resp),
          });
          const out = await v.json();
          resolve(
            v.ok && out.enrolled
              ? { status: 'paid', paymentReviewRequired: Boolean(out.paymentReviewRequired) }
              : {
                  status: 'failed',
                  error: 'Payment could not be verified — contact support.',
                },
          );
        } catch {
          resolve({ status: 'failed', error: 'Verification request failed.' });
        }
      },
    });
    rzp.on('payment.failed', (resp: unknown) => {
      const desc = (resp as { error?: { description?: string } })?.error?.description;
      // Checkout keeps the modal open to offer another method after a failure.
      // Wait for final success or dismissal instead of settling before a retry.
      lastFailure = desc ?? 'Payment failed.';
    });
    rzp.open();
  });
}
