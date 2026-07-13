/**
 * Issues an invoice for every approved enrollment that does not have one.
 *
 * The issue_invoice_on_approval trigger only fires on a pending -> approved UPDATE.
 * Enrollments that were approved before invoicing existed — and every enrollment
 * migrated from V1, which arrives already approved — never trigger it. Without this,
 * no existing paying customer would ever see an invoice.
 *
 * Safe to re-run: it skips any enrollment that already has one.
 *
 *   node scripts/backfill-invoices.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) {
  for (const l of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const db = createClient(process.env.V2_SUPABASE_URL, process.env.V2_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const [{ data: enrollments }, { data: existing }, { data: courses }] = await Promise.all([
  db.from('enrollments').select('*').eq('status', 'approved'),
  db.from('invoices').select('enrollment_id'),
  db.from('courses').select('id, title, price_india, price_international'),
]);

const invoiced = new Set((existing ?? []).map((i) => i.enrollment_id));
const pending = (enrollments ?? []).filter((e) => !invoiced.has(e.id));

console.log(`approved enrollments : ${enrollments?.length ?? 0}`);
console.log(`already invoiced     : ${invoiced.size}`);
console.log(`to issue             : ${pending.length}\n`);

if (pending.length === 0) {
  console.log('Nothing to do.');
  process.exit(0);
}

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
const emailOf = new Map((users?.users ?? []).map((u) => [u.id, u.email]));

const { data: profiles } = await db.from('profiles').select('user_id, full_name');
const nameOf = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));

let issued = 0;

for (const e of pending) {
  const course = courses.find((c) => c.id === e.course_id);
  if (!course) {
    console.log(`  skip ${e.id} — course missing`);
    continue;
  }

  // Region was not captured before checkout asked for it. Default to international
  // rather than guess: it is the safer assumption for tax, and an admin can correct
  // a specific invoice. Never invent a buyer's country.
  const region = e.billing_region ?? 'international';
  const amount = region === 'india' ? (course.price_india ?? 0) : (course.price_international ?? 0);
  const currency = region === 'india' ? 'INR' : 'EUR';

  // Number the invoice in the period the sale actually happened, not today — an
  // invoice dated after the payment it records is wrong.
  const when = new Date(e.approved_at ?? e.enrolled_at);
  const year = when.getUTCFullYear();
  const month = when.getUTCMonth() + 1;

  const { data: number, error: numError } = await db.rpc('next_invoice_number', {
    p_year: year,
    p_month: month,
  });

  if (numError) {
    console.log(`  FAILED ${e.id} — numbering: ${numError.message}`);
    continue;
  }

  const { error } = await db.from('invoices').insert({
    invoice_number: number,
    enrollment_id: e.id,
    user_id: e.user_id,
    course_id: e.course_id,
    amount,
    currency,
    region,
    billing_country: e.billing_country,
    course_title: course.title,
    buyer_name: nameOf.get(e.user_id) ?? null,
    buyer_email: emailOf.get(e.user_id) ?? null,
    period_year: year,
    period_month: month,
    issued_at: when.toISOString(),
  });

  if (error) {
    console.log(`  FAILED ${e.id} — ${error.message}`);
  } else {
    issued += 1;
    console.log(`  ${number}  ${currency} ${amount}  ${course.title.slice(0, 40)}`);
  }
}

console.log(`\n${issued} invoice(s) issued. PDFs render on first download.`);
