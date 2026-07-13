import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

/**
 * Single place the platform sends mail from.
 *
 * Supabase's built-in email service can only send *auth* emails (confirm signup,
 * reset password) from its own templates -- there is no API to send an arbitrary
 * message, and its default sender is rate limited to a few per hour. So anything
 * we compose ourselves (admin alerts, invoices) goes out over SMTP instead.
 *
 * Configured for Gmail by default. To move to Resend/SendGrid later, only this
 * file changes: swap the SMTP call for their HTTP API and keep `sendEmail`.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

export async function sendEmail({ to, subject, html, replyTo }: EmailMessage): Promise<void> {
  const host = Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com';
  const port = Number(Deno.env.get('SMTP_PORT') ?? '465');
  const user = requireEnv('SMTP_USER');
  const pass = requireEnv('SMTP_PASS');
  const from = Deno.env.get('SMTP_FROM') ?? user;

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: port === 465,
      auth: { username: user, password: pass },
    },
  });

  try {
    await client.send({
      from: `KnowGraph <${from}>`,
      to,
      subject,
      html,
      replyTo,
    });
  } finally {
    // Leaking the connection wedges the isolate on the next invocation.
    await client.close();
  }
}

/** Wraps body content in the shared KnowGraph shell so every email looks the same. */
export function renderEmail(heading: string, bodyHtml: string): string {
  return `
  <div style="margin:0;padding:24px;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <div style="padding:20px 28px;background:linear-gradient(135deg,#0ea5e9,#a855f7);">
        <h1 style="margin:0;font-size:18px;font-weight:600;color:#ffffff;letter-spacing:0.02em;">KnowGraph</h1>
      </div>
      <div style="padding:28px;">
        <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${heading}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#64748b;">Sent automatically by the KnowGraph platform.</p>
      </div>
    </div>
  </div>`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
