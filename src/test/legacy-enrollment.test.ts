import { describe, expect, it } from 'vitest';
import { migrateLegacyEnrollment } from '../../api/_lib/legacy-enrollment';

const now = '2026-10-19T12:00:00.000Z';
const fixture = { course_id: 'course-1', enrolled_at: '2026-01-10T12:00:00Z', payment_reference: 'bank-transfer-1', amount_paid: 1500, currency: 'INR', billing_region: 'india' };

describe('legacy enrollment migration', () => {
  it('keeps a pending enrollment pending even when it includes a plausible receipt', () => {
    const enrollment = migrateLegacyEnrollment({ ...fixture, status: 'pending', payment_receipt_url: 'https://example.com/receipt.png', receipt_check: { confidence: 100, looks_legitimate: true }, approved_at: now }, 'new-user', now);
    expect(enrollment).toMatchObject({ user_id: 'new-user', status: 'pending', payment_confirmed: false, approved_at: null });
  });

  it('does not treat OCR approval or a paid-looking note as settled payment', () => {
    const enrollment = migrateLegacyEnrollment({ ...fixture, status: 'approved', auto_approved: true, payment_confirmed: false, admin_notes: 'Payment verified by receipt OCR' }, 'new-user', now);
    expect(enrollment).toMatchObject({ status: 'pending', payment_confirmed: false, approved_at: null });
    expect(enrollment.admin_notes).toContain('"requires_payment_review":true');
    expect(enrollment.admin_notes).toContain('"legacy_auto_approved":true');
  });

  it('holds historical approvals without explicit payment confirmation for review', () => {
    expect(migrateLegacyEnrollment({ ...fixture, status: 'approved', auto_approved: false }, 'new-user', now)).toMatchObject({ status: 'pending', payment_confirmed: false });
  });

  it('preserves an actual confirmed, manually approved legacy enrollment', () => {
    const enrollment = migrateLegacyEnrollment({ ...fixture, status: 'approved', payment_confirmed: true, auto_approved: false, approved_at: '2026-01-11T14:00:00Z' }, 'new-user', now);
    expect(enrollment).toMatchObject({ status: 'approved', payment_confirmed: true, auto_approved: false, amount_paid: 1500, currency: 'INR', approved_at: '2026-01-11T14:00:00.000Z', payment_confirmed_at: '2026-01-11T14:00:00.000Z' });
  });

  it('keeps rejected enrollments rejected and does not revive access', () => {
    expect(migrateLegacyEnrollment({ ...fixture, status: 'rejected', payment_confirmed: true }, 'new-user', now)).toMatchObject({ status: 'rejected', payment_confirmed: false, approved_at: null });
  });

  it('does not carry unknown privileges or sponsorship fields into a service-role write', () => {
    const enrollment = migrateLegacyEnrollment({ ...fixture, status: 'pending', id: 'old-id', user_id: 'old-user', access_source: 'sponsorship', sponsorship_redemption_id: 'forged-redemption', unknown_privilege: true, receipt_check: { auto_approved: true } }, 'new-user', now);
    expect(enrollment).toMatchObject({ access_source: 'payment', user_id: 'new-user' });
    expect(enrollment).not.toHaveProperty('id');
    expect(enrollment).not.toHaveProperty('sponsorship_redemption_id');
    expect(enrollment).not.toHaveProperty('unknown_privilege');
    expect(enrollment).not.toHaveProperty('receipt_check');
  });
});
