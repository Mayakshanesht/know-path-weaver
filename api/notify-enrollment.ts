import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

/**
 * Emails the admin the moment a student applies for a course.
 *
 * A student who has paid and is waiting is the most time-critical thing that happens on this
 * platform: they cannot open anything until someone approves them. Until now nothing told
 * the admin it had happened at all — the database trigger fired into the void because no
 * webhook was configured, so the only signal was remembering to open the admin panel.
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

  const record = (req.body?.record ?? {}) as Record<string, unknown>;
  const enrollmentId = record.id as string | undefined;
  if (!enrollmentId) return res.status(400).json({ error: 'No enrollment in payload.' });

  // Only a fresh application needs the admin's attention. A migrated V1 learner arrives
  // already approved and requires nothing from anyone.
  if (record.status !== 'pending') {
    return res.status(200).json({ ok: true, skipped: `status is ${record.status}` });
  }

  const db = createClient(
    process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

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

  const rows: Array<[string, unknown]> = [
    ['Student', `${studentName} (${studentEmail})`],
    ['Course', course?.title ?? record.course_id],
    ['Price', price],
    ['Billing region', record.billing_region ?? '—'],
    ['Payment reference', record.payment_reference ?? '(none provided)'],
    ['Receipt', record.payment_receipt_url ? `<a href="${esc(record.payment_receipt_url)}">View receipt</a>` : '(none uploaded)'],
  ];

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">New enrolment — action needed</h2>
      <p style="margin:0 0 20px;color:#475569">
        They cannot open the course until you approve them.
      </p>
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
          Verify the payment and approve
        </a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin:0">
        Check the payment reference against your bank before approving. Approving issues the
        invoice and unlocks the course immediately.
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
      subject: `New enrolment: ${studentName} — ${course?.title ?? 'a course'} (${price})`,
      html,
    });

    return res.status(200).json({ ok: true, notified: adminEmail });
  } catch (error) {
    // The enrolment itself is already safely recorded; only the email failed. Say so loudly
    // in the logs, but never fail in a way that could make the trigger look like the problem.
    console.error('notify-enrollment: send failed', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
}
