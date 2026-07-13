import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, supabaseAsCaller } from './_lib/groq.js';

/**
 * Reads a payment receipt image, cross-checks it, and may grant ACCESS on the strength of it.
 *
 * It may NEVER confirm the payment. That distinction is the whole design.
 *
 * A screenshot is not proof of payment — it takes minutes to fake one, and a ₹19,999 course
 * is worth faking. So the two consequences are split:
 *
 *   ACCESS  (status = 'approved')      the OCR may grant this. Being wrong costs a course,
 *                                      and it can be revoked.
 *   MONEY   (payment_confirmed = true) only a human, having seen the bank statement, may set
 *                                      this. It is what issues the GST invoice — and a tax
 *                                      document for a sale that never happened is not
 *                                      something you can quietly take back.
 *
 * So a genuine buyer starts learning immediately instead of waiting, and the admin still
 * reconciles every payment against the bank at their own pace, with a list of exactly which
 * ones are outstanding. If one never lands, revoke it.
 *
 * Access is granted only when the image looks like a receipt AND the amount matches what
 * they were charged. The amount is the check that actually costs money when it is wrong.
 *
 * If you ever want true auto-approval of the MONEY, the answer is not a better OCR model —
 * it is a payment gateway (Razorpay/Stripe) whose webhook is authenticated and authoritative.
 */

export const config = { maxDuration: 60 };

// Groq's vision-capable model. Overridable, because model names move.
const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct';

interface Extracted {
  amount: number | null;
  currency: string | null;
  transaction_id: string | null;
  paid_on: string | null;
  payee: string | null;
  note: string | null;
  looks_like_a_payment_receipt: boolean;
  notes: string | null;
}

const PROMPT = `You are reading a payment receipt or bank/UPI transaction screenshot.

Extract ONLY what is actually visible in the image. Do not guess, infer, or complete a value
you cannot read — for anything you cannot see clearly, return null. A confidently wrong number
here is far worse than a null, because a human is going to trust it.

Return:
- amount: the transaction amount as a number, digits only (e.g. 14999.00). null if unreadable.
- currency: "INR", "EUR", etc., if shown.
- transaction_id: the UTR / UPI transaction ID / reference number.
- paid_on: the date shown, as YYYY-MM-DD if you can.
- payee: who the money went TO.
- note: any remark, message, description or note field on the transaction.
- looks_like_a_payment_receipt: false if this is not a payment receipt at all (a random photo,
  a screenshot of something else, a blank image).
- notes: anything an approver should know — the image is cropped, the amount is ambiguous, the
  transaction says "failed" or "pending" rather than successful, etc.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'amount', 'currency', 'transaction_id', 'paid_on', 'payee', 'note',
    'looks_like_a_payment_receipt', 'notes',
  ],
  properties: {
    amount: { type: ['number', 'null'] },
    currency: { type: ['string', 'null'] },
    transaction_id: { type: ['string', 'null'] },
    paid_on: { type: ['string', 'null'] },
    payee: { type: ['string', 'null'] },
    note: { type: ['string', 'null'] },
    looks_like_a_payment_receipt: { type: 'boolean' },
    notes: { type: ['string', 'null'] },
  },
} as const;

/** Loose match: UPI apps mangle references with spaces, dashes and case. */
const normalise = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Reads the receipt and cross-checks it. Exported so the enrolment notifier can run it
 * automatically the moment someone applies, rather than waiting for an admin to click.
 */
export async function checkReceipt(enrollmentId: string) {
  const admin = supabaseAdmin();

  const { data: enrolment } = await admin
    .from('enrollments')
    .select('id, payment_receipt_url, payment_reference, payment_code, amount_paid, currency, status')
    .eq('id', enrollmentId)
    .maybeSingle();

  if (!enrolment) throw new Error('Enrollment not found');
  if (!enrolment.payment_receipt_url) throw new Error('This enrolment has no receipt image to read.');

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured.');

  const imageRes = await fetch(enrolment.payment_receipt_url);
  if (!imageRes.ok) throw new Error(`Could not fetch the receipt image (${imageRes.status})`);

  const bytes = Buffer.from(await imageRes.arrayBuffer());
  if (bytes.length > 4 * 1024 * 1024) throw new Error('The receipt image is too large to read (over 4MB).');

  const mime = imageRes.headers.get('content-type') ?? 'image/jpeg';
  const dataUri = `data:${mime};base64,${bytes.toString('base64')}`;

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      max_completion_tokens: 700,
      messages: [
        { role: 'user', content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: dataUri } },
        ] },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'receipt', schema: SCHEMA } },
    }),
  });

  if (!groqRes.ok) {
    throw new Error(`Vision model failed (${groqRes.status}): ${(await groqRes.text()).slice(0, 200)}`);
  }

  const body = await groqRes.json();
  const extracted = JSON.parse(body.choices?.[0]?.message?.content ?? '{}') as Extracted;

  const expectedAmount = enrolment.amount_paid != null ? Number(enrolment.amount_paid) : null;
  const readAmount = extracted.amount != null ? Number(extracted.amount) : null;
  const amountOk = expectedAmount != null && readAmount != null && Math.abs(readAmount - expectedAmount) < 1;

  const checks = {
    is_a_receipt: {
      ok: extracted.looks_like_a_payment_receipt === true,
      detail: extracted.looks_like_a_payment_receipt
        ? 'The image looks like a payment receipt.'
        : 'This does not look like a payment receipt.',
    },
    amount_matches: {
      ok: amountOk,
      detail:
        readAmount == null
          ? 'Could not read an amount from the image.'
          : expectedAmount == null
            ? `Receipt shows ${readAmount}; no expected amount was recorded.`
            : amountOk
              ? `Receipt shows ${readAmount}, which matches the ${expectedAmount} expected.`
              : `MISMATCH: receipt shows ${readAmount}, but ${expectedAmount} was expected.`,
    },
    utr_matches: {
      ok:
        !!enrolment.payment_reference &&
        !!extracted.transaction_id &&
        normalise(extracted.transaction_id) === normalise(enrolment.payment_reference),
      detail: !enrolment.payment_reference
        ? 'The buyer did not give a UTR to compare against.'
        : !extracted.transaction_id
          ? 'Could not read a transaction id from the image.'
          : normalise(extracted.transaction_id) === normalise(enrolment.payment_reference)
            ? 'The transaction id on the receipt matches the UTR they entered.'
            : `MISMATCH: receipt says ${extracted.transaction_id}, they entered ${enrolment.payment_reference}.`,
    },
    code_present: {
      ok: !!enrolment.payment_code && normalise(extracted.note).includes(normalise(enrolment.payment_code)),
      detail: !enrolment.payment_code
        ? 'No payment code was issued for this enrolment.'
        : normalise(extracted.note).includes(normalise(enrolment.payment_code))
          ? `Their payment code ${enrolment.payment_code} appears in the transaction note.`
          : `Their payment code ${enrolment.payment_code} is not in the note. Many UPI apps drop it, so do not reject on this alone.`,
    },
  };

  const passed = Object.values(checks).filter((c) => c.ok).length;

  // The image must look like a receipt AND the amount must be right. The amount is the check
  // that actually costs money when it is wrong, so nothing is granted without it.
  const grantsAccess = checks.is_a_receipt.ok && checks.amount_matches.ok;

  const result = {
    checked_at: new Date().toISOString(),
    model: VISION_MODEL,
    extracted,
    checks,
    passed,
    total: Object.keys(checks).length,
    grants_access: grantsAccess,
    verdict: !grantsAccess ? 'needs_attention' : passed >= 3 ? 'consistent' : 'check_manually',
  };

  await admin.from('enrollments').update({ receipt_check: result }).eq('id', enrolment.id);
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated' });

  const { enrollment_id: enrollmentId } = (req.body ?? {}) as { enrollment_id?: string };
  if (!enrollmentId) return res.status(400).json({ error: 'enrollment_id is required' });

  // Admins only. This reads someone else's receipt.
  const asCaller = supabaseAsCaller(authHeader);
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const admin = supabaseAdmin();
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id);
  if (!roles?.some((r) => r.role === 'admin')) return res.status(403).json({ error: 'Admins only' });

  try {
    const result = await checkReceipt(enrollmentId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('verify-receipt failed:', error);
    return res.status(500).json({ error: String(error) });
  }
}
