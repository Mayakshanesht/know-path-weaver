import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { escapeHtml, renderEmail, sendEmail } from '../_shared/email.ts';

/**
 * Emails the admin whenever someone applies for a course.
 *
 * Invoked by the `on_enrollment_created` database trigger, not by the browser, so
 * a client cannot skip it (by never calling it) or forge it (by posting made-up
 * enrollments). The shared secret below is what makes that guarantee hold: without
 * it, the function URL is public and anyone could spam it.
 */

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: {
    id: string;
    user_id: string;
    course_id: string;
    status: string;
    payment_reference: string | null;
    payment_receipt_url: string | null;
    enrolled_at: string;
  } | null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const expectedSecret = Deno.env.get('WEBHOOK_SECRET');
  if (!expectedSecret) {
    console.error('WEBHOOK_SECRET is not set; refusing to run unauthenticated.');
    return new Response('Not configured', { status: 500 });
  }
  if (req.headers.get('x-webhook-secret') !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const enrollment = payload.record;
  if (payload.type !== 'INSERT' || !enrollment) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? 'mayurwaghchoure1995@gmail.com';
  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://know-path-weaver.vercel.app';

  // service_role: the trigger runs with no end-user session, and we need to read
  // the applicant's profile and the course, which RLS would otherwise hide.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // The applicant's email lives in auth.users, not profiles, so it needs the admin API.
  const [{ data: profile }, { data: course }, { data: authUser }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', enrollment.user_id)
      .maybeSingle(),
    supabase.from('courses').select('title, price').eq('id', enrollment.course_id).maybeSingle(),
    supabase.auth.admin.getUserById(enrollment.user_id),
  ]);

  const applicantEmail = authUser?.user?.email ?? 'unknown';
  const applicantName =
    profile?.full_name ??
    (authUser?.user?.user_metadata?.full_name as string | undefined) ??
    'Unknown';
  const courseTitle = course?.title ?? enrollment.course_id;

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 0;color:#64748b;font-size:14px;width:150px;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:500;">${value}</td>
    </tr>`;

  const receiptRow = enrollment.payment_receipt_url
    ? row(
        'Payment receipt',
        `<a href="${escapeHtml(enrollment.payment_receipt_url)}" style="color:#0ea5e9;">View receipt</a>`
      )
    : row('Payment receipt', '<span style="color:#94a3b8;">none uploaded</span>');

  const html = renderEmail(
    'New course application',
    `
    <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
      <strong>${escapeHtml(applicantName)}</strong> has applied for
      <strong>${escapeHtml(courseTitle)}</strong> and is awaiting your approval.
    </p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;">
      ${row('Applicant', escapeHtml(applicantName))}
      ${row('Email', escapeHtml(applicantEmail))}
      ${row('Course', escapeHtml(courseTitle))}
      ${row('Payment ref', escapeHtml(enrollment.payment_reference ?? 'not provided'))}
      ${receiptRow}
      ${row('Applied at', escapeHtml(new Date(enrollment.enrolled_at).toUTCString()))}
    </table>
    <a href="${escapeHtml(siteUrl)}/admin"
       style="display:inline-block;margin-top:24px;padding:12px 20px;background:#0f172a;color:#ffffff;
              border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">
      Review in admin panel
    </a>`
  );

  try {
    await sendEmail({
      to: adminEmail,
      subject: `New application: ${courseTitle} — ${applicantName}`,
      html,
      // Replying to the alert reaches the applicant directly.
      replyTo: authUser?.user?.email ?? undefined,
    });
  } catch (error) {
    // Never fail loudly here: the enrollment is already committed, and the trigger
    // fires this asynchronously. Log it so a missing email is diagnosable.
    console.error('Failed to send admin notification:', error);
    return new Response(JSON.stringify({ sent: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
