interface AccessEnrollment {
  status: string;
  payment_confirmed?: boolean;
  access_source?: string;
  sponsorship_redemption_id?: string | null;
}

/** Mirrors the database access rule. A receipt image never establishes payment. */
export function hasCourseAccess(enrollment: AccessEnrollment | null | undefined): boolean {
  return enrollment?.status === 'approved' && (
    enrollment.payment_confirmed === true
    || (enrollment.access_source === 'sponsorship' && !!enrollment.sponsorship_redemption_id)
  );
}
