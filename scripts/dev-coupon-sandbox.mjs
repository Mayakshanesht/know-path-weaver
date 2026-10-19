#!/usr/bin/env node
/**
 * Disposable manual-test environment. Only the auth adapter, payment refusal and
 * watermarked PDF download are fixtures. Application tables, RPCs, triggers and
 * RLS policies are the real migrations, served by real PostgreSQL + PostgREST.
 *
 * Start: scripts/start-coupon-sandbox.sh
 * Stop/reset/delete all local demo data: scripts/start-coupon-sandbox.sh --stop
 * Requirements: Docker, installed repository npm dependencies, ports 4179,
 * 55321 and 55322 available. No .env files or production services are loaded.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer as createHttpServer, request as httpRequest } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const uid = process.getuid?.() ?? 'local';
const statePath = join(tmpdir(), `knowgraph-coupon-sandbox-${uid}.json`);
const webOrigin = 'http://localhost:4179';
const apiOrigin = 'http://127.0.0.1:55321';
const restOrigin = 'http://127.0.0.1:55322';
const courseId = '10000000-0000-4000-8000-000000000001';
const secondCourseId = '10000000-0000-4000-8000-000000000002';
const accounts = [
  { id: '00000000-0000-4000-8000-000000000001', email: 'admin@demo.knowgraph.test', name: 'Demo Admin' },
  { id: '00000000-0000-4000-8000-000000000002', email: 'student@demo.knowgraph.test', name: 'Demo Student' },
];
const demoPassword = 'Demo2027!';
const createdAt = new Date().toISOString();

async function existingState() {
  try { return JSON.parse(await readFile(statePath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function isOurProcess(pid) {
  if (!Number.isInteger(pid) || pid < 2) return false;
  try {
    const command = await readFile(`/proc/${pid}/cmdline`, 'utf8');
    return command.includes('dev-coupon-sandbox.mjs');
  } catch { return false; }
}

if (process.argv.includes('--stop')) {
  const state = await existingState();
  if (!state) { console.log('No local coupon sandbox is running.'); process.exit(0); }
  if (await isOurProcess(state.pid)) {
    process.kill(state.pid, 'SIGTERM');
    for (let attempt = 0; attempt < 100; attempt++) {
      if (!(await existingState())) {
        console.log('Stopped local coupon sandbox and deleted its disposable database.');
        process.exit(0);
      }
      if (!(await isOurProcess(state.pid))) break;
      await new Promise(resolveWait => setTimeout(resolveWait, 150));
    }
    if (await isOurProcess(state.pid)) throw new Error('Sandbox is still stopping. Wait a moment and retry --stop.');
  }
  {
    // A previous process may have been killed before its cleanup handler ran.
    if (state.postgrest?.startsWith('kg-coupon-')) await execute('docker', ['rm', '-f', state.postgrest]).catch(() => {});
    if (state.postgres?.startsWith('kg-coupon-')) await execute('docker', ['rm', '-f', state.postgres]).catch(() => {});
    if (state.network?.startsWith('kg-coupon-')) await execute('docker', ['network', 'rm', state.network]).catch(() => {});
    if (state.temp?.startsWith(join(tmpdir(), 'kg-coupon-'))) await rm(state.temp, { recursive: true, force: true });
    await rm(statePath, { force: true });
    console.log('Removed stale local coupon sandbox resources.');
  }
  process.exit(0);
}

const oldState = await existingState();
if (oldState) throw new Error(`A sandbox state already exists. Run scripts/start-coupon-sandbox.sh --stop first. ${statePath}`);
for (const port of [4179, 55321, 55322]) {
  await new Promise((resolvePort, rejectPort) => {
    const check = createNetServer();
    check.once('error', () => rejectPort(new Error(`Port ${port} is busy. The existing server was left untouched.`)));
    check.listen(port, '127.0.0.1', () => check.close(resolvePort));
  });
}
await execute('docker', ['info', '--format', '{{.ServerVersion}}']);
const temp = await mkdtemp(join(tmpdir(), 'kg-coupon-'));
const suffix = randomBytes(5).toString('hex');
const postgres = `kg-coupon-pg-${suffix}`;
const postgrest = `kg-coupon-rest-${suffix}`;
const network = `kg-coupon-net-${suffix}`;
const jwtSecret = randomBytes(48).toString('base64url');
const dbPassword = randomBytes(24).toString('hex');
let vite;
let api;
let stopping = false;
const pdfs = new Map();
await writeFile(statePath, JSON.stringify({ pid: process.pid, temp, postgres, postgrest, network, webOrigin, apiOrigin }), { mode: 0o600 });

async function cleanup() {
  if (stopping) return;
  stopping = true;
  await vite?.close().catch(() => {});
  if (api) await new Promise(resolveClose => api.close(resolveClose));
  await execute('docker', ['rm', '-f', postgrest, postgres]).catch(() => {});
  await execute('docker', ['network', 'rm', network]).catch(() => {});
  await rm(temp, { recursive: true, force: true });
  await rm(statePath, { force: true });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  void cleanup().then(() => process.exit(0));
});

const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
async function dockerSql(sql) {
  const child = (await import('node:child_process')).spawn('docker', ['exec', '-i', postgres, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let errors = '';
  child.stdout.resume();
  child.stderr.on('data', chunk => { errors += chunk; });
  const completed = new Promise((resolveSql, rejectSql) => {
    child.on('error', rejectSql);
    child.on('exit', code => code === 0 ? resolveSql() : rejectSql(new Error(errors)));
  });
  child.stdin.end(sql);
  return completed;
}
function signToken(claims, lifetime = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ iss: `${apiOrigin}/auth/v1`, iat: now, exp: now + lifetime, ...claims })).toString('base64url');
  const signature = createHmac('sha256', jwtSecret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}
function verifyToken(value, expectedKind = 'access') {
  const [header, body, signature, extra] = (value || '').replace(/^Bearer /i, '').split('.');
  if (!header || !body || !signature || extra) throw new Error('Invalid local session');
  const expected = createHmac('sha256', jwtSecret).update(`${header}.${body}`).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error('Invalid local session');
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (claims.exp <= Date.now() / 1000 || claims.sandbox_kind !== expectedKind || claims.role !== 'authenticated') throw new Error('Local session expired');
  const account = accounts.find(candidate => candidate.id === claims.sub);
  if (!account) throw new Error('Unknown local test account');
  return account;
}
function authUser(account) {
  return { id: account.id, aud: 'authenticated', role: 'authenticated', email: account.email,
    email_confirmed_at: createdAt, confirmed_at: createdAt, created_at: createdAt, updated_at: createdAt,
    app_metadata: { provider: 'email', providers: ['email'], local_sandbox: true },
    user_metadata: { full_name: account.name, email_verified: true }, identities: [], is_anonymous: false };
}
function session(account) {
  return { access_token: signToken({ sub: account.id, role: 'authenticated', aud: 'authenticated', email: account.email, sandbox_kind: 'access' }),
    token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: signToken({ sub: account.id, role: 'authenticated', sandbox_kind: 'refresh' }, 86400), user: authUser(account) };
}
function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}
async function readJson(request) {
  let input = '';
  for await (const chunk of request) {
    input += chunk;
    if (input.length > 16384) throw new Error('Request is too large');
  }
  return input ? JSON.parse(input) : {};
}
const sandboxHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>KnowGraph local coupon sandbox</title><style>body{font:16px system-ui;max-width:820px;margin:40px auto;padding:20px;line-height:1.65;background:#0f172a;color:#e2e8f0}a{color:#67e8f9}code{background:#1e293b;padding:3px 6px}li{margin:12px 0}</style></head><body><h1>Local coupon sandbox</h1><p>This disposable environment uses the real course database migrations, coupon RPCs and access policies. Everything here is fake test data. Production accounts, courses and payments are untouched.</p><p><strong>Password for both accounts:</strong> <code>${demoPassword}</code></p><ul><li>Admin: <code>${accounts[0].email}</code>. <a href="${webOrigin}/login">Sign in</a>, open <a href="${webOrigin}/admin">Admin</a> → Sponsorship coupons. Create a general coupon with 100% or 25%, or a team/individual invitation. Individual invitations must use the demo student's email. Team codes need 5–35 seats and a team name.</li><li>Learner: <code>${accounts[1].email}</code>. Use a separate private browser window for the learner. Open <a href="${webOrigin}/courses/${courseId}">the ₹2,000 demo course</a>, apply the copied coupon, and review the quote. A 100% coupon shows ₹0. Enter your name and college, then click <strong>Complete free enrollment</strong>. One redemption unlocks <strong>both published demo courses at once</strong>, with one participant seat and a zero collection receipt per course. Open <a href="${webOrigin}/courses/${secondCourseId}">the second course</a> to verify access without entering a coupon again. The admin sees the real tracking row.</li><li>A 25% coupon shows ₹500 discount and ₹1,500 remaining on the first course. Gateway checkout is deliberately unavailable and cannot charge money. Partial coupons cover only the purchased course after verified payment. Test partial coupons before completing 100% enrollment, or restart the sandbox to reset the learner.</li></ul><p>Google sign-in, new account signup, email delivery, password recovery, real payment gateways and production PDF storage are not connected. Both fixture accounts are already verified email accounts. Google buttons explain this limitation and never create a fake Google identity. Downloaded PDFs are visibly marked local test documents.</p><p>Sessions persist across refreshes. Stopping/resetting deletes all sandbox data; restart creates fresh secrets, accounts and courses. Stop with <code>scripts/start-coupon-sandbox.sh --stop</code> or Ctrl+C in the running terminal.</p><p><a href="${webOrigin}/courses">Open demo course catalog</a> · <a href="${webOrigin}/login">Sign in</a></p></body></html>`;

async function invoiceDownload(request, response) {
  verifyToken(request.headers.authorization);
  const body = await readJson(request);
  if (!/^[0-9a-f-]{36}$/i.test(body.invoice_id || '')) return json(response, 400, { error: 'invoice_id is required' });
  const result = await fetch(`${restOrigin}/invoices?id=eq.${body.invoice_id}&select=*`, { headers: { Authorization: request.headers.authorization } });
  if (!result.ok) return json(response, 500, { error: 'Could not load the local receipt' });
  const [invoice] = await result.json();
  if (!invoice) return json(response, 404, { error: 'Receipt not found for this account' });
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const lines = [
    'LOCAL TEST DOCUMENT - NOT A TAX DOCUMENT', 'KnowGraph disposable coupon sandbox',
    invoice.document_type === 'sponsorship_receipt' ? 'Sponsorship access receipt' : 'Demo invoice',
    `Number: ${invoice.invoice_number}`, `Learner: ${invoice.buyer_name || invoice.buyer_email || ''}`,
    `Course: ${invoice.course_title || 'Demo course'}`, `Currency: ${invoice.currency}`,
    `List price: ${invoice.list_price}`, `Discount: ${invoice.discount_amount}`,
    `Amount collected: ${invoice.amount}`, `Tax: ${invoice.tax_amount}`,
    `Coupon: ${invoice.coupon_code || ''}`, `Campaign: ${invoice.sponsorship_campaign || ''}`,
    `Team: ${invoice.team_name || ''}`, '', 'All values above are local database snapshots.',
    'No real payment, sale or tax document was created.',
  ];
  lines.forEach((line, index) => page.drawText(String(line).replace(/[^\x20-\x7e]/g, '?').slice(0, 95), {
    x: 40, y: 790 - index * 26, size: index === 0 ? 14 : 12, font, color: index === 0 ? rgb(0.8, 0.1, 0.1) : rgb(0.1, 0.1, 0.1),
  }));
  const key = randomBytes(24).toString('hex');
  for (const [id, entry] of pdfs) if (entry.expires < Date.now()) pdfs.delete(id);
  pdfs.set(key, { bytes: await document.save(), expires: Date.now() + 300000 });
  json(response, 200, { url: `/sandbox-receipts/${key}.pdf`, invoice_number: invoice.invoice_number });
}

try {
  console.log('Creating disposable PostgreSQL database and applying real migrations…');
  await execute('docker', ['network', 'create', network]);
  await execute('docker', ['run', '--rm', '-d', '--name', postgres, '--network', network,
    '-e', `POSTGRES_PASSWORD=${dbPassword}`, 'postgres:16-alpine']);
  for (let attempt = 0; ; attempt++) {
    const ready = await execute('docker', ['exec', postgres, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).then(() => true, () => false);
    if (ready) break;
    if (attempt > 80) throw new Error('Local PostgreSQL did not become ready');
    await delay(250);
  }
  await dockerSql(await readFile(join(repo, 'supabase/tests/sponsorship_bootstrap.sql'), 'utf8'));
  const migrations = (await readdir(join(repo, 'supabase/migrations'))).filter(name => name.endsWith('.sql')).sort();
  for (const name of migrations) {
    const sql = (await readFile(join(repo, 'supabase/migrations', name), 'utf8'))
      .replace(/^CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;\r?\n/gm, '');
    try { await dockerSql(sql); }
    catch (error) { throw new Error(`Local migration ${name}: ${error.message}`); }
  }
  await dockerSql(`
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), ''),
        COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub')::uuid;
    $$;
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '${dbPassword}';
    GRANT anon, authenticated, service_role TO authenticator;
    INSERT INTO auth.users (id,email,email_confirmed_at,raw_user_meta_data) VALUES
      ('${accounts[0].id}','${accounts[0].email}',now(),'{"full_name":"Demo Admin"}'),
      ('${accounts[1].id}','${accounts[1].email}',now(),'{"full_name":"Demo Student"}');
    INSERT INTO public.user_roles (user_id,role) VALUES ('${accounts[0].id}','admin');
    UPDATE public.billing_settings SET legal_name='LOCAL DEMO ONLY - KnowGraph',place_of_supply='Maharashtra (27)';
    INSERT INTO public.courses(id,title,description,price_india,price_international,is_published,created_by)
    VALUES('${courseId}','Coupon Sandbox: aBAJA Learning Demo',
      'A local demo course for testing genuine coupon quotes, enrollment and protected learning. No production data or real money is involved.',2000,30,true,'${accounts[0].id}');
    INSERT INTO public.learning_paths(id,course_id,title,description,order_index)
    VALUES('20000000-0000-4000-8000-000000000001','${courseId}','Start learning','Validate your coupon and access the protected lesson.',0);
    INSERT INTO public.capsules(id,learning_path_id,title,description,duration_minutes,order_index)
    VALUES('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Your protected demo lesson',
      'This lesson is visible only after verified course access. Apply a 100% invitation and complete free enrollment to unlock it.',5,0);
    INSERT INTO public.capsule_content(id,capsule_id,content_type,title,content_value,order_index)
    VALUES('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','text','Coupon access verified',
      'Welcome to the protected sandbox classroom! Your 100% invitation created a real sponsored enrollment through the production SQL RPC and RLS policies. The course list price is INR 2000, the sponsorship discount is INR 2000, and the amount collected is INR 0. Your admin can now inspect your name, email, team, code and zero collection receipt. This text cannot be read by an unauthenticated visitor or a learner who has not enrolled. Everything is disposable local demo data.',0);
    INSERT INTO public.courses(id,title,description,price_india,price_international,is_published,created_by)
    VALUES('${secondCourseId}','Coupon Sandbox: Second Course',
      'Confirm that one 100% sponsorship invitation unlocks every published course at once, without claiming a second seat.',3500,45,true,'${accounts[0].id}');
    INSERT INTO public.learning_paths(id,course_id,title,description,order_index)
    VALUES('20000000-0000-4000-8000-000000000002','${secondCourseId}','All courses access','Your original invitation also covers this course.',0);
    INSERT INTO public.capsules(id,learning_path_id,title,description,duration_minutes,order_index)
    VALUES('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Access without another coupon',
      'After one 100% redemption, this second course is available under the same account.',3,0);
    INSERT INTO public.capsule_content(id,capsule_id,content_type,title,content_value,order_index)
    VALUES('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','text','All courses are unlocked',
      'You unlocked this second published course with the same 100% invitation. No second coupon, payment or seat was needed. Your account has two approved sponsored enrollments and two zero collection receipts, linked to one participant redemption.',0);
    NOTIFY pgrst, 'reload schema';
  `);
  await execute('docker', ['run', '--rm', '-d', '--name', postgrest, '--network', network,
    '-p', '127.0.0.1:55322:3000', '-e', `PGRST_DB_URI=postgres://authenticator:${dbPassword}@${postgres}:5432/postgres`,
    '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', `PGRST_JWT_SECRET=${jwtSecret}`,
    'postgrest/postgrest:v12.2.12']);
  for (let attempt = 0; ; attempt++) {
    const ready = await fetch(`${restOrigin}/courses?select=id`).then(result => result.ok, () => false);
    if (ready) break;
    if (attempt > 80) throw new Error('Local PostgREST did not become ready');
    await delay(250);
  }

  api = createHttpServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && !['http://localhost:4179', 'http://127.0.0.1:4179', apiOrigin].includes(origin)) {
      return json(response, 403, { error: 'Local sandbox accepts only its localhost frontend' });
    }
    response.setHeader('Access-Control-Allow-Origin', origin || webOrigin);
    response.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info, prefer, range, range-unit, accept-profile, content-profile, x-supabase-api-version');
    response.setHeader('Access-Control-Expose-Headers', 'content-range, range-unit, location, preference-applied');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, PUT, OPTIONS');
    if (request.method === 'OPTIONS') { response.writeHead(204); return response.end(); }
    const url = new URL(request.url, apiOrigin);
    try {
      if (url.pathname.startsWith('/rest/v1/')) {
        const upstream = httpRequest(`${restOrigin}/${url.pathname.slice('/rest/v1/'.length)}${url.search}`, {
          method: request.method, headers: { ...request.headers, host: '127.0.0.1:55322' },
        }, upstreamResponse => {
          for (const [key, value] of Object.entries(upstreamResponse.headers)) {
            if (value !== undefined && !key.toLowerCase().startsWith('access-control-')) response.setHeader(key, value);
          }
          response.writeHead(upstreamResponse.statusCode);
          upstreamResponse.pipe(response);
        });
        upstream.on('error', () => { if (!response.headersSent) json(response, 502, { error: 'Local database unavailable' }); else response.end(); });
        request.pipe(upstream);
        return;
      }
      if (url.pathname === '/auth/v1/token' && request.method === 'POST') {
        const body = await readJson(request);
        if (url.searchParams.get('grant_type') === 'refresh_token') return json(response, 200, session(verifyToken(body.refresh_token, 'refresh')));
        const account = accounts.find(candidate => candidate.email === String(body.email || '').trim().toLowerCase());
        if (!account || body.password !== demoPassword) return json(response, 400, { code: 'invalid_credentials', msg: 'Use a local demo account from Sandbox help. Password: Demo2027!' });
        return json(response, 200, session(account));
      }
      if (url.pathname === '/auth/v1/user' && request.method === 'GET') return json(response, 200, authUser(verifyToken(request.headers.authorization)));
      if (url.pathname === '/auth/v1/logout' && request.method === 'POST') { response.writeHead(204); return response.end(); }
      if (url.pathname === '/auth/v1/settings') return json(response, 200, { external: { google: false }, disable_signup: true, mailer_autoconfirm: true });
      if (url.pathname === '/auth/v1/authorize') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return response.end(sandboxHtml.replace('<h1>Local coupon sandbox</h1>', '<h1>Google is not connected in this local sandbox</h1><p>Use one of the verified demo email accounts below. No Google sign-in or Google identity is simulated here.</p>'));
      }
      if (url.pathname.startsWith('/auth/')) return json(response, 400, { code: 'sandbox_unavailable', msg: 'Local sandbox: signup, email delivery and password changes are unavailable. Use the verified demo accounts in Sandbox help.' });
      if (url.pathname === '/api/invoice-download' && request.method === 'POST') return await invoiceDownload(request, response);
      if (url.pathname.startsWith('/api/')) return json(response, 503, { error: 'Local sandbox: Razorpay and payment processing are not configured. No money was charged and no paid enrollment was created. Test the displayed partial discount, or use a 100% invitation to unlock the demo lesson.' });
      if (url.pathname.startsWith('/sandbox-receipts/')) {
        const key = url.pathname.match(/^\/sandbox-receipts\/([0-9a-f]{48})\.pdf$/)?.[1];
        const pdf = pdfs.get(key);
        if (!pdf || pdf.expires < Date.now()) return json(response, 404, { error: 'Local receipt link expired. Download it again.' });
        response.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="LOCAL-TEST-sponsorship-receipt.pdf"', 'Cache-Control': 'no-store' });
        return response.end(Buffer.from(pdf.bytes));
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(sandboxHtml);
    } catch (error) {
      json(response, 401, { error: error.message, msg: error.message });
    }
  });
  await new Promise((resolveListen, rejectListen) => { api.once('error', rejectListen); api.listen(55321, '127.0.0.1', resolveListen); });

  // Do not read repository .env files, even public production configuration.
  process.env.VITE_SUPABASE_URL = apiOrigin;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = signToken({ role: 'anon', sandbox_kind: 'anon' }, 86400);
  process.env.VITE_LEGACY_SUPABASE_URL = '';
  process.env.VITE_LEGACY_SUPABASE_ANON_KEY = '';
  const { createServer } = await import('vite');
  const oldSignalListeners = new Set(process.listeners('SIGTERM'));
  const oldStdinListeners = new Set(process.stdin.listeners('end'));
  const localProxy = () => ({ target: apiOrigin, changeOrigin: true, headers: { origin: apiOrigin } });
  vite = await createServer({ root: repo, envDir: temp,
    // Browsers only need the frontend port. Authentication, REST, downloads and
    // test help share that origin, including when a local preview is forwarded.
    define: { 'import.meta.env.VITE_SUPABASE_URL': 'window.location.origin' },
    server: { host: '127.0.0.1', port: 4179, strictPort: true,
      proxy: { '/api': localProxy(), '/auth/v1': localProxy(), '/rest/v1': localProxy(), '/sandbox': localProxy() } }, plugins: [{
      name: 'local-coupon-sandbox-label',
      transformIndexHtml: () => [
        { tag: 'script', children: `try { if(localStorage.getItem('knowgraph.local-sandbox-run') !== '${suffix}') { localStorage.removeItem('sb-127-auth-token'); localStorage.removeItem('sb-localhost-auth-token'); sessionStorage.removeItem('knowgraph.sponsorship.pending-code'); sessionStorage.removeItem('knowgraph.auth.return'); localStorage.setItem('knowgraph.local-sandbox-run','${suffix}'); } } catch {}`, injectTo: 'head-prepend' },
        { tag: 'div', attrs: { style: 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#fef3c7;color:#78350f;text-align:center;padding:8px;font:13px system-ui;box-shadow:0 -1px 6px #0003' },
          children: 'LOCAL DEMO · No real payments · Verified demo accounts only · <a href="/sandbox" target="_blank" style="font-weight:700;text-decoration:underline;color:inherit">Test accounts & instructions</a>', injectTo: 'body' },
        { tag: 'script', children: 'window.Razorpay = function LocalPaymentDisabled(){throw new Error("Local sandbox: payment gateway is not configured.");};', injectTo: 'head-prepend' },
      ],
    }] });
  // Vite's standalone-server handler calls process.exit() immediately after
  // closing Vite. This embedded launcher owns shutdown, including its database.
  for (const listener of process.listeners('SIGTERM')) if (!oldSignalListeners.has(listener)) process.off('SIGTERM', listener);
  for (const listener of process.stdin.listeners('end')) if (!oldStdinListeners.has(listener)) process.stdin.off('end', listener);
  await vite.listen();
  console.log(`\nLocal coupon sandbox is ready: ${webOrigin}/login\nInstructions: ${webOrigin}/sandbox\nAdmin: ${accounts[0].email}\nLearner: ${accounts[1].email}\nPassword for both: ${demoPassword}\nCourse: ${webOrigin}/courses/${courseId}\nUse separate browser/private windows for admin and learner.\nGoogle/email delivery and paid checkout are disabled. 100% enrollment uses the real database.\nStop and delete demo data: scripts/start-coupon-sandbox.sh --stop\n`);
} catch (error) {
  console.error(`Sandbox startup failed: ${error.message}`);
  await cleanup();
  process.exitCode = 1;
}
