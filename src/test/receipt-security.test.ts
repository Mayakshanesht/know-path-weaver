// @vitest-environment node
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), admin: vi.fn(), caller: vi.fn(), getUser: vi.fn(), roles: vi.fn(),
  enrollment: vi.fn(), update: vi.fn(), save: vi.fn(), sendMail: vi.fn(), fetch: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('../../api/_lib/groq.js', () => ({ supabaseAdmin: mocks.admin, supabaseAsCaller: mocks.caller }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: mocks.sendMail }) } }));

import notifyEnrollment from '../../api/notify-enrollment';
import verifyReceipt, { checkReceipt } from '../../api/verify-receipt';

const enrollment = {
  id: 'enrollment-1', user_id: 'student-1', course_id: 'course-1', status: 'pending', access_source: 'payment',
  payment_receipt_url: 'https://example.supabase.co/storage/v1/object/public/payment-receipts/fake.png',
  payment_reference: '123456789012', payment_code: 'KG123', amount_paid: 19999, currency: 'INR', billing_region: 'india',
};
const matchingImage = {
  amount: 19999, currency: 'INR', transaction_id: '123456789012', paid_on: '2026-10-19',
  payee: 'KnowGraph', note: 'KG123', looks_like_a_payment_receipt: true, notes: null,
  // Model output and a screenshot never carry authority to grant access.
  grants_access: true,
};

function response() {
  return {
    statusCode: 200,
    payload: {} as Record<string, unknown>,
    status(code: number) { this.statusCode = code; return this; },
    json(body: Record<string, unknown>) { this.payload = body; return this; },
  };
}

async function notify(payload: Record<string, unknown> = {}, secret = 'signed-trigger-secret') {
  const res = response();
  await notifyEnrollment({ method: 'POST', headers: { 'x-webhook-secret': secret }, body: { record: { id: enrollment.id, ...payload } } } as unknown as VercelRequest, res as unknown as VercelResponse);
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('ENROLLMENT_WEBHOOK_SECRET', 'signed-trigger-secret');
  vi.stubEnv('SMTP_USER', 'notifier@example.com');
  vi.stubEnv('SMTP_PASS', 'test-mail-password');
  vi.stubEnv('GROQ_API_KEY', 'test-vision-key');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.enrollment.mockResolvedValue({ data: { ...enrollment }, error: null });
  mocks.roles.mockResolvedValue({ data: [{ role: 'admin' }], error: null });
  mocks.save.mockResolvedValue({ error: null });
  mocks.update.mockImplementation(() => ({ eq: mocks.save }));
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
  const db = {
    from(table: string) {
      if (table === 'user_roles') return { select: () => ({ eq: mocks.roles }) };
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: mocks.update,
        maybeSingle: table === 'enrollments' ? mocks.enrollment : vi.fn().mockResolvedValue({
          data: table === 'courses' ? { title: 'Vehicle dynamics', price_india: 19999, price_international: 199 } : { full_name: 'Student One' }, error: null,
        }),
      };
      return chain;
    },
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'student@example.com' } } }) } },
  };
  mocks.createClient.mockReturnValue(db);
  mocks.admin.mockReturnValue(db);
  mocks.caller.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.fetch.mockImplementation(async (url: string) => url === enrollment.payment_receipt_url
    ? new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } })
    : new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(matchingImage) } }] }), { headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.sendMail.mockResolvedValue({ messageId: 'mail-1' });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('receipt OCR cannot approve course access', () => {
  it('stores advisory diagnostics only, even for a forged image matching every expected field', async () => {
    const result = await checkReceipt(enrollment.id);
    expect(result.grants_access).toBe(false);
    expect(result.looks_consistent).toBe(true);
    expect(result.passed).toBe(4);
    expect(result.verdict).toBe('consistent');
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ receipt_check: result });
    expect(enrollment.status).toBe('pending');
  });

  it('ignores webhook grant signals and leaves a matching forged screenshot pending', async () => {
    const result = await notify({ status: 'approved', auto_approved: true, payment_confirmed: true, grants_access: true, receipt_check: { grants_access: true }, user_id: 'payload-attacker' });
    expect(result.statusCode).toBe(200);
    expect(result.payload.auto_granted).toBe(false);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    const updates = mocks.update.mock.calls.map(([values]) => values as Record<string, unknown>);
    expect(updates.every((values) => Object.keys(values).every((key) => key === 'receipt_check'))).toBe(true);
    expect(updates[0].receipt_check).toMatchObject({ grants_access: false });
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    const email = mocks.sendMail.mock.calls[0][0];
    expect(email.html).toContain('Check the actual payment gateway record or bank transaction');
    expect(email.html).toContain('This notification and receipt check do not grant course access.');
    expect(email.html).not.toContain('Access granted automatically');
    expect(email.html).toContain('student@example.com');
  });

  it('still requests bank review without granting access if the OCR service fails', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response('fake image', { headers: { 'content-type': 'image/png' } }))
      .mockResolvedValueOnce(new Response('Vision unavailable', { status: 503 }));
    const result = await notify();
    expect(result.statusCode).toBe(200);
    expect(result.payload.auto_granted).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
  });

  it('surfaces receipt diagnostic persistence failures rather than reporting a successful check', async () => {
    mocks.save.mockResolvedValue({ error: { message: 'Database write failed' } });
    await expect(checkReceipt(enrollment.id)).rejects.toThrow('Could not save receipt diagnostics: Database write failed');
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(Object.keys(mocks.update.mock.calls[0][0])).toEqual(['receipt_check']);
  });

  it('skips already approved or sponsored records based on the current database row', async () => {
    mocks.enrollment.mockResolvedValue({ data: { ...enrollment, status: 'approved', access_source: 'sponsorship' }, error: null });
    const result = await notify({ status: 'pending' });
    expect(result.statusCode).toBe(200);
    expect(result.payload.auto_granted).toBe(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});

describe('receipt route authorization', () => {
  it('rejects unsigned enrollment notifications before database or OCR activity', async () => {
    const result = await notify({ grants_access: true }, 'wrong-secret');
    expect(result.statusCode).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it('requires an authenticated administrator for receipt reading', async () => {
    const missingAuth = response();
    await verifyReceipt({ method: 'POST', headers: {}, body: { enrollment_id: enrollment.id } } as VercelRequest, missingAuth as unknown as VercelResponse);
    expect(missingAuth.statusCode).toBe(401);
    mocks.roles.mockResolvedValue({ data: [{ role: 'student' }], error: null });
    const student = response();
    await verifyReceipt({ method: 'POST', headers: { authorization: 'Bearer student' }, body: { enrollment_id: enrollment.id } } as VercelRequest, student as unknown as VercelResponse);
    expect(student.statusCode).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('returns advisory results for an authorized administrator without changing enrollment access', async () => {
    const result = response();
    await verifyReceipt({ method: 'POST', headers: { authorization: 'Bearer admin' }, body: { enrollment_id: enrollment.id } } as VercelRequest, result as unknown as VercelResponse);
    expect(result.statusCode).toBe(200);
    expect(result.payload.grants_access).toBe(false);
    expect(result.payload.looks_consistent).toBe(true);
    expect(Object.keys(mocks.update.mock.calls[0][0])).toEqual(['receipt_check']);
  });
});
