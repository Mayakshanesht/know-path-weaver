import { describe, expect, it } from 'vitest';
import { hasCourseAccess } from '@/lib/course-access';

describe('verified course access', () => {
  it('denies a screenshot-approved enrollment without a confirmed payment', () => {
    expect(hasCourseAccess({ status: 'approved', payment_confirmed: false, access_source: 'payment' })).toBe(false);
  });
  it('allows an approved confirmed payment', () => {
    expect(hasCourseAccess({ status: 'approved', payment_confirmed: true, access_source: 'payment' })).toBe(true);
  });
  it('requires the actual redemption for sponsored access', () => {
    expect(hasCourseAccess({ status: 'approved', payment_confirmed: false, access_source: 'sponsorship' })).toBe(false);
    expect(hasCourseAccess({ status: 'approved', payment_confirmed: false, access_source: 'sponsorship', sponsorship_redemption_id: 'redemption' })).toBe(true);
  });
  it('keeps pending and rejected enrollments locked even when payment flags are present', () => {
    for (const status of ['pending', 'rejected']) expect(hasCourseAccess({ status, payment_confirmed: true })).toBe(false);
    expect(hasCourseAccess(null)).toBe(false);
  });
});
