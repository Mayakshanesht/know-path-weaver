/** V1 data is read under the verified legacy session, never supplied by the browser. */
export function migrateLegacyEnrollment(legacy: Record<string, unknown>, userId: string, now: string) {
  const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
  const date = (value: unknown): string | null => {
    const valueText = text(value);
    return valueText && Number.isFinite(Date.parse(valueText)) ? new Date(valueText).toISOString() : null;
  };
  const confirmed = legacy.status === 'approved' && legacy.payment_confirmed === true && legacy.auto_approved !== true;
  const status = confirmed ? 'approved' : legacy.status === 'rejected' ? 'rejected' : 'pending';
  const enrolledAt = date(legacy.enrolled_at) || now;
  const audit = JSON.stringify({
    legacy_status: legacy.status ?? null,
    legacy_payment_confirmed: legacy.payment_confirmed === true,
    legacy_auto_approved: legacy.auto_approved === true,
    requires_payment_review: legacy.status === 'approved' && !confirmed,
  });

  // A receipt, OCR result, or legacy approval alone is not settlement evidence.
  // Keep a small audit snapshot while copying only known enrollment columns.
  return {
    user_id: userId,
    course_id: text(legacy.course_id),
    status,
    enrolled_at: enrolledAt,
    approved_at: confirmed ? date(legacy.approved_at) || enrolledAt : null,
    payment_confirmed: confirmed,
    payment_confirmed_at: confirmed ? date(legacy.payment_confirmed_at) || date(legacy.approved_at) || enrolledAt : null,
    auto_approved: false,
    access_source: 'payment',
    payment_reference: text(legacy.payment_reference),
    payment_receipt_url: text(legacy.payment_receipt_url),
    payment_code: text(legacy.payment_code),
    amount_paid: typeof legacy.amount_paid === 'number' && Number.isFinite(legacy.amount_paid) && legacy.amount_paid >= 0 ? legacy.amount_paid : null,
    currency: text(legacy.currency),
    billing_country: text(legacy.billing_country),
    billing_region: legacy.billing_region === 'india' || legacy.billing_region === 'international' ? legacy.billing_region : null,
    billing_state: text(legacy.billing_state),
    admin_notes: [text(legacy.admin_notes), `V1 migration audit: ${audit}`].filter(Boolean).join('\n'),
  };
}
