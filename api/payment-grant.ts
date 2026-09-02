import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from './_lib/groq.js';

/**
 * Authoritative enrollment grant from the Razorpay payment chain.
 *
 * The main website (knowgraphapp.com) verifies every payment against
 * Razorpay — checkout signature server-side, webhook HMAC from Razorpay —
 * and then calls this endpoint, signing the body with the shared
 * KG_PAYMENT_SECRET. That signature is the trust boundary: a valid call
 * here means money genuinely moved through the gateway.
 *
 * Which is why this endpoint may set BOTH flags that verify-receipt.ts
 * deliberately keeps apart: status='approved' (access) AND
 * payment_confirmed=true (money). The receipt-OCR flow splits them because
 * a screenshot can be faked; a gateway webhook is the authoritative
 * confirmation that design note says to wait for.
 *
 * The buyer may not have an LMS account yet — they paid on the marketing
 * site. In that case the account is created for their payment email
 * (confirmed, no password); they sign in via "forgot password" or a magic
 * link and the course is already unlocked.
 *
 * Vercel env vars required: KG_PAYMENT_SECRET (same value as the main
 * site), SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL.
 */

export const config = { api: { bodyParser: false } };

// Marketing-site course slugs -> LMS catalogue titles (courses table has no
// slug column; titles are the stable key, seeded from src/data/courses.ts).
const SLUG_TO_TITLE: Record<string, string> = {
  'ai': 'AI Bootcamp for Autonomous Driving',
  'ai-bootcamp': 'AI Bootcamp for Autonomous Driving',
  'autonomous-driving-adas':
    'Advanced Driver Assistance Systems (ADAS): Engineering & Development',
  'autonomous-driving':
    'Advanced Driver Assistance Systems (ADAS): Engineering & Development',
  'vehicle-control':
    'Advanced Vehicle Dynamics & Control: From Modern C++ to Predictive Autonomy',
  'motion-prediction-planning': 'Advanced Motion Planning for Autonomous Driving',
  'motion-planning': 'Advanced Motion Planning for Autonomous Driving',
  'cicd-autonomous-systems':
    'CI/CD Foundations: From Git Commit to Kubernetes Cluster',
  'cicd-for-robotics':
    'CI/CD Foundations: From Git Commit to Kubernetes Cluster',
  // app courses exist in the LMS catalogue too — a purchase grants both
  'cv': 'Computer Vision & Generative AI',
  'computer-vision-generative-ai': 'Computer Vision & Generative AI',
  'physical-ai': 'Physical AI & Robotics',
  'physical-ai-robotics': 'Physical AI & Robotics',
};

function rawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  // trim: a pasted env value often carries an invisible trailing newline
  const secret = process.env.KG_PAYMENT_SECRET?.trim();
  if (!secret) return res.status(503).json({ error: 'not configured' });

  const payload = await rawBody(req);
  const signature = (req.headers['x-signature'] as string) ?? '';
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  // secret_fp = first 8 hex of sha256(secret): compares which secret each
  // side holds without revealing anything about the secret itself
  const fp = createHash('sha256').update(secret).digest('hex').slice(0, 8);
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return res.status(401).json({ error: 'bad signature', secret_fp: fp });
    }
  } catch {
    return res.status(401).json({ error: 'bad signature', secret_fp: fp });
  }

  const body = JSON.parse(payload) as {
    email?: string;
    courseSlug?: string;
    amountCents?: number;
    paymentId?: string;
  };
  const email = body.email?.toLowerCase().trim();
  const title = body.courseSlug ? SLUG_TO_TITLE[body.courseSlug] : undefined;
  if (!email || !/^[^@\s]{1,64}@[^@\s]{3,190}$/.test(email)) {
    return res.status(400).json({ error: 'valid email required' });
  }
  if (!title) return res.status(400).json({ error: 'unknown course slug' });

  const db = supabaseAdmin();

  // DB titles drift from the static catalogue (edited in the admin panel) —
  // fall back to a distinctive keyword per course.
  const KEYWORD: Record<string, string> = {
    'ai': '%AI Bootcamp%',
    'ai-bootcamp': '%AI Bootcamp%',
    'autonomous-driving-adas': '%ADAS%',
    'autonomous-driving': '%ADAS%',
    'vehicle-control': '%Vehicle Dynamics%',
    'motion-prediction-planning': '%Motion Planning%',
    'motion-planning': '%Motion Planning%',
    'cicd-autonomous-systems': '%CI/CD%',
    'cicd-for-robotics': '%CI/CD%',
    'cv': '%Computer Vision & Generative%',
    'computer-vision-generative-ai': '%Computer Vision & Generative%',
    'physical-ai': '%Physical AI%',
    'physical-ai-robotics': '%Physical AI%',
  };
  let { data: course } = await db
    .from('courses')
    .select('id, title')
    .ilike('title', title)
    .maybeSingle();
  if (!course) {
    const kw = KEYWORD[body.courseSlug!];
    if (kw) {
      const { data: rows } = await db
        .from('courses')
        .select('id, title')
        .ilike('title', kw)
        .limit(2);
      if (rows && rows.length === 1) course = rows[0];
    }
  }
  if (!course) {
    // titles are the public catalogue — listing them turns a blind 404
    // into an actionable one
    const { data: all } = await db.from('courses').select('title').limit(20);
    return res.status(404).json({
      error: `no course titled ${title}`,
      available: (all ?? []).map((c) => c.title),
    });
  }

  // find-or-create the auth user for the payment email
  let userId: string | null = null;
  const created = await db.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    // already registered: page through users to find them (small user base)
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await db.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) break;
      userId =
        data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      if (data.users.length < 1000) break;
    }
  }
  if (!userId) return res.status(500).json({ error: 'could not resolve user' });

  const { error: upsertErr } = await db.from('enrollments').upsert(
    {
      user_id: userId,
      course_id: course.id,
      status: 'approved',
      payment_confirmed: true,
      payment_confirmed_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      payment_reference: body.paymentId ?? 'razorpay',
      admin_notes: `Razorpay gateway payment${
        body.amountCents ? ` — ₹${(body.amountCents / 100).toLocaleString('en-IN')}` : ''
      } (auto-granted)`,
    },
    { onConflict: 'user_id,course_id' },
  );
  if (upsertErr) return res.status(500).json({ error: upsertErr.message });

  return res.status(200).json({ ok: true, userId, courseId: course.id });
}
