import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { checkReceipt } from './verify-receipt.js';

/**
 * Emails the admin the moment a student applies for a course.
 *
 * An application and its uploaded screenshot are claims to review, never proof
 * of payment. This route sends a notification and optional OCR diagnostics; it
 * never approves an enrollment or records a payment.
 *
 * This lives on Vercel rather than in a Supabase edge function because Vercel is what
 * actually deploys here; the edge function in supabase/functions has never been deployable
 * in this project, which is why invoice rendering moved out too.
 *
 * Called by the notify_admin_new_enrollment trigger via pg_net, which fires on INSERT and
 * passes the whole enrollment row. It queues the request and returns immediately, so a slow
 * mail server can never hold a student's enrolment open.
 */

const SMTP_HOST = process.env.SMTP_HOST ?? 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? '465');

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.ENROLLMENT_WEBHOOK_SECRET;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const adminEmail = process.env.ADMIN_EMAIL ?? smtpUser;

  if (!secret || !smtpUser || !smtpPass) {
    // Loud, because a silently-unconfigured notifier is exactly the failure we are fixing.
    console.error('notify-enrollment: missing ENROLLMENT_WEBHOOK_SECRET / SMTP_USER / SMTP_PASS');
    return res.status(500).json({ error: 'Notifications are not configured on the server.' });
  }

  // The trigger is the only thing allowed to call this. Without the check, anyone who found
  // the URL could spam the admin's inbox.
  if (req.headers['x-webhook-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = (req.body?.record ?? {}) as Record<string, unknown>;
  const enrollmentId = typeof payload.id === 'string' ? payload.id : undefined;
  if (!enrollmentId) return res.status(400).json({ error: 'No enrollment in payload.' });

  const db = createClient(
    process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Fetch authoritative current values. Ignore status, OCR results, and grant
  // signals included in a webhook payload, which may also be stale on retry.
  const { data: record, error: recordError } = await db.from('enrollments')
    .select('id, user_id, course_id, status, access_source, billing_region, payment_code, payment_reference, payment_receipt_url')
    .eq('id', enrollmentId).maybeSingle();
  if (recordError) return res.status(500).json({ error: 'Could not load the enrollment for notification.' });
  if (!record) return res.status(404).json({ error: 'Enrollment not found.' });
  if (record.status !== 'pending' || record.access_source === 'sponsorship') {
    return res.status(200).json({ ok: true, skipped: 'Enrollment does not need a payment review.', auto_granted: false });
  }

  const [{ data: course }, { data: profile }] = await Promise.all([
    db.from('courses').select('title, price_india, price_international')
      .eq('id', record.course_id as string).maybeSingle(),
    db.from('profiles').select('full_name').eq('user_id', record.user_id as string).maybeSingle(),
  ]);

  const { data: userRes } = await db.auth.admin.getUserById(record.user_id as string);
  const studentEmail = userRes?.user?.email ?? 'unknown';
  const studentName = profile?.full_name ?? 'A student';

  const india = String(record.billing_region ?? '') === 'india';
  const price = india
    ? `INR ${course?.price_india ?? '?'}`
    : `EUR ${course?.price_international ?? '?'}`;

  const site = process.env.VITE_PUBLIC_SITE_URL ?? 'https://know-path-weaver.vercel.app';

  // OCR only helps the admin locate the claimed transaction. It cannot change
  // access, regardless of image consistency or any grant flag in its output.
  let check: Awaited<ReturnType<typeof checkReceipt>> | null = null;

  if (record.payment_receipt_url) {
    try {
      check = await checkReceipt(enrollmentId);
    } catch (error) {
      // A failed read must never block the enrolment or the email. It just means the admin
      // does what they did before: looks at the receipt themselves.
      console.error('notify-enrollment: receipt check failed', error);
    }
  }

  const rows: Array<[string, unknown]> = [
    ['Student', `${studentName} (${studentEmail})`],
    ['Course', course?.title ?? record.course_id],
    ['Listed course amount', price],
    ['Their payment code', record.payment_code ?? '(none)'],
    ['UTR they entered', record.payment_reference ?? '(none provided)'],
    ['Receipt', record.payment_receipt_url ? `<a href="${esc(record.payment_receipt_url)}">View receipt</a>` : '(none uploaded)'],
  ];

  if (check) {
    rows.push(['Amount on the receipt', check.extracted.amount ?? 'could not read']);
    rows.push(['Transaction on the receipt', check.extracted.transaction_id ?? 'could not read']);
    rows.push(['Receipt checks passed', `${check.passed} of ${check.total}`]);
  }

  const headline = 'New enrolment — verify the actual payment';
  const subhead = 'This application is pending. A screenshot and matching OCR fields do not prove payment. ' +
    'Check the actual payment gateway record or bank transaction before approving access and confirming payment. ' +
    'This notification and receipt check do not grant course access.';

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">${esc(headline)}</h2>
      <p style="margin:0 0 20px;color:#475569">${esc(subhead)}</p>
      <table cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr>
                 <td style="border-bottom:1px solid #e2e8f0;color:#64748b;white-space:nowrap">${esc(k)}</td>
                 <td style="border-bottom:1px solid #e2e8f0"><strong>${k === 'Receipt' ? v : esc(v)}</strong></td>
               </tr>`
          )
          .join('')}
      </table>
      <p style="margin:24px 0">
        <a href="${site}/admin"
           style="background:#0f172a;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;display:inline-block">
          Review the application and actual payment
        </a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin:0">
        A screenshot can be faked. The invoice is only issued once you confirm the payment
        against your bank statement — never on the strength of the receipt alone.
      </p>
    </div>`;

  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transport.sendMail({
      from: `KnowGraph <${smtpUser}>`,
      to: adminEmail,
      replyTo: studentEmail !== 'unknown' ? studentEmail : undefined,
      subject: `Payment review needed: ${studentName} — ${course?.title ?? 'a course'} (${price})`,
      html,
    });

    return res.status(200).json({
      ok: true,
      notified: adminEmail,
      auto_granted: false,
      checks_passed: check ? `${check.passed}/${check.total}` : null,
    });
  } catch (error) {
    // The enrolment itself is already safely recorded; only the email failed. Say so loudly
    // in the logs, but never fail in a way that could make the trigger look like the problem.
    console.error('notify-enrollment: send failed', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
}
