Vercel Deployment Notes

- This project is a Vite React app. Vercel will detect and use the `build` script.
- Ensure `npm ci` and `npm run build` succeed in CI. A GitHub Action `CI` is included.
- `vercel.json` rewrites all routes to `index.html` for SPA routing.
- If using environment variables for Supabase, add them in Vercel dashboard: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Recommended steps:
1. Connect the GitHub repo in Vercel.
2. Set Environment Variables in Project Settings.
3. Deploy; check logs for `npm run build` output.

## SAEINDIA 2027 aBAJA sponsored access

The implementation uses one invitation per team, with a seat for each learner,
and separate committee, individual, or general invitations. For approximately
28 teams of 5–35 members, this covers 140–980 students plus committee members.
Each person uses their own verified email account or Google sign-in. A 100% coupon seat grants all published courses
and automatically includes courses published later. Claimed access has no
automatic expiry; a code's optional deadline only limits when it can be claimed.
Pausing a code stops new claims without withdrawing existing access.

Use an approved account-email roster for each team and committee. Email verification or Google sign-in verifies
control of an email address; the roster establishes that person's invitation to
the programme. Codes without a roster can be claimed by any verified account
who holds the code, until the seat limit is reached. Individual invitations must
have exactly one allowed email. A person cannot claim multiple codes for the
same campaign. Team affiliation comes from the issued code, not a student-entered
team name. No real team codes are seeded or fabricated by this change.

### Release order

1. Apply `supabase/migrations/20261019000000_sponsored_course_access.sql`, then
   `supabase/migrations/20261019010000_require_verified_paid_access.sql`, each
   once in a transaction after the existing migrations. Then apply
   `supabase/migrations/20261019015000_percentage_coupons.sql` for percentage
   discounts and payment reservations. It adds the sponsorship
   tables, RLS, checked RPCs, course grants, immutable attribution and receipts.
   Use the existing Supabase migration process or SQL Editor. Do not re-run the
   legacy `APPLY_PENDING.sql` bundle to install this feature; it contains historical
   data updates for older payment migrations.
2. Email confirmation is enabled (`mailer_autoconfirm=false`) and Google is enabled in the live project's public auth settings as checked on
   19 October 2026. Confirm the provider's OAuth client is published for public
   use. In Supabase Authentication → URL Configuration, allow
   `https://courses.knowgraphapp.com/auth/callback` and
   `https://courses.knowgraphapp.com/auth/callback**` for the callback's safe `next`
   parameter. Set Site URL to `https://courses.knowgraphapp.com`. In Google Cloud,
   the authorized redirect URI is the Supabase project's
   `https://<project-ref>.supabase.co/auth/v1/callback`.
   See [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
   and [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
   Also allow `knowgraph://auth-callback` for the installed app's Google and
   verification callbacks. Direct Google buttons on the course catalog and
   course enrollment card retain the selected course after authentication.
3. Deploy this repository to its existing Vercel project, `know-path-weaver`.
   The new receipts use the existing `/api/invoice-download` route and its existing
   service-role environment variable; no extra public API key or client secret is
   introduced. All three database migrations must precede the LMS and mobile releases. Also deploy
   the main website instruction pages at `/abaja-students`, `/abaja-committee`,
   and `/start`. The mobile app uses the same Supabase project and enrollments;
   no duplicate purchase or separate coupon inventory is needed.
   For native reel courses, apply the app repository's
   `backend/migrations/0018_sponsorship_access.sql` before deploying its Worker.
   Verified 100% claims are mirrored into that catalog on sign-in, refresh and
   app resume. They create sponsorship attribution records without changing
   subscription tiers or recording paid revenue. Release the rebuilt Android
   app after both backends are ready.
4. Use one internal Google account with an approved roster entry to create and
   apply a test invitation on a course page. Confirm the 100% discount and zero
   total, then select Complete free enrollment. Verify Classroom access and its
   KGS receipt on web and mobile, sign
   out/in again, and confirm the same seat is retained. Test a Google email outside
   that roster is rejected. Then issue the actual team and committee codes.

The source changes are not a production deployment. Local tests use an isolated
database and do not create live users, live codes, or financial documents.

### Percentage discounts

Courses are free only for holders of a valid 100% coupon. Administrators choose
0.01–100% when generating a code; aBAJA full sponsorship defaults to 100%.
The generated code uses cryptographic random bytes in the database and is
shared from the admin panel. The client cannot choose a code or a discount.
Once created, its percentage is preserved; issue a new code to change terms.

Partial coupons show list price, percentage, discount, and remaining balance.
They do not call the free-enrollment RPC. The signed-in member completes secure
Razorpay checkout for the remaining amount; only a captured payment with the
correct user, order, amount and currency creates approved paid access. The
paid invoice retains the original price, discount, code, campaign, and actual
amount paid. A partial discount covers the course purchased, not the whole catalog.

Starting partial checkout claims the member's seat but grants no learning
access. Its immutable order snapshot can be resumed by the same member, so
an abandoned browser does not create duplicate claims or a different charge.
Admins can distinguish these pending payment checkouts from completed enrollments.
Coupon validity is rechecked at claim time, not trusted from the earlier preview.
Captured payments that collide with existing access are retained for admin
reconciliation instead of changing an earlier invoice.

### Admin procedure

Open `/admin` → **Coupons**. Create a team code with the actual team name,
member count (5–35), and approved account-email roster. Set an optional claim
deadline. Create committee invitations separately; use individual invitations
for a single named email, or general invitations for other sponsored groups.
Use **Copy student instructions** to obtain the actual code and a ready-to-share
message. Code values are random, not predictable team numbers.

For the approximately 28 teams, paste a CSV in **Bulk team setup**, preview
all rows, then create. The template columns are:

```csv
label,team_name,seats,emails
aBAJA 2027 - Example Team A,Example Team A,5,member1@example.com;member2@example.com
aBAJA 2027 - Example Team B,Example Team B,10,member3@example.com;member4@example.com
```

Replace the examples with actual names, capacities and all approved account
emails. The bulk campaign and claim deadline come from the form. Validation runs
before creation; each row retains its outcome and idempotency key, so retrying a
failed or uncertain response does not create a second code. Keep the import view
open until outcomes are confirmed. If a browser session is lost, check the
existing invitations before importing those teams again.

The admin table shows used/available seats, deadline and active/paused state.
Participant tracking records the account ID, verified email, submitted full name,
college/organization, assigned team/audience, campaign and redemption time.
Export participant and code CSVs for sponsorship reporting. Treat exported codes
and rosters as private. Pause a leaked code immediately; existing claims remain
recorded. Incorrect team attribution requires administrator investigation rather
than silently editing the historical record.

### Billing records

Each newly sponsored course enrollment creates a **sponsored access receipt**
in the existing Invoices & receipts area: the course's price at redemption,
100% discount, coupon, campaign, team and zero due/collected. Receipts have a
separate `KGS-YYYYMM-####` sequence and PDF heading. They are labelled as access
records, not tax invoices, and are excluded from paid-invoice revenue summaries.
The paid `KG-` invoice sequence and confirmed payment history are preserved.

Pending or OCR-approved checkouts without confirmed money or an invoice can be
converted to sponsored access; the original checkout amount, currency, status
and billing information are retained in `sponsorship_prior_checkout`, and any
receipt/payment reference is retained for audit. Existing confirmed/invoiced
sales remain unchanged. Sponsored rows cannot be confirmed as paid, repriced or
deleted through the ordinary enrollment controls, and do not appear in bank
reconciliation. This feature records complimentary access; any separate sponsor
contract or tax treatment is handled outside the student course checkout.

New checkout orders are blocked when access is already approved or sponsored.
If a gateway order was opened before a coupon was claimed and its real payment
arrives afterward, the immutable sponsorship receipt stays unchanged. The
service records that payment separately in `sponsorship_payment_reviews`, keyed
by gateway payment reference. Admin → Invoices displays it for reconciliation.
Resolve a review only after handling the actual payment outside this feature
(for example, refunding in the gateway); record the refund or reconciliation
reference in the required notes. The review tool does not perform refunds or
issue an additional tax document automatically.

### Student / technical committee message

> KnowGraph is providing free course access for SAEINDIA 2027 aBAJA teams and the
> technical committee. Create your own account at
> https://courses.knowgraphapp.com/signup and confirm the verification email, or
> continue with Google. Sign in, open any course page, and apply the sponsorship
> coupon shared by your captain or KnowGraph. Check the 100% discount and zero
> total, enter your name and college/organization, then select **Complete free
> enrollment**. No card or payment is needed. Install KnowGraph from
> https://www.knowgraphapp.com/get-app and use the same account to learn in the
> mobile app. Each member needs their own account. Keep the code within your
> assigned group and sign out on shared computers.

Public instruction pages:

- https://www.knowgraphapp.com/abaja-students — team members and captains.
- https://www.knowgraphapp.com/abaja-committee — technical committee invitations.
- https://www.knowgraphapp.com/start — free app starter, normal paid courses and plans.

Partial coupon payments in the mobile app continue through the selected course
on the secure website. The app explicitly copies the coupon; the user pastes it
after signing in with the same account. Coupon values and access tokens are never
put in browser URLs. After payment, returning to the app refreshes course access.
The free app starter (feed, review and discovery) remains distinct from paid courses.

### Receipt-upload security repair

`api/notify-enrollment` no longer grants access after reading an image, and
`api/verify-receipt` always records `grants_access:false`. OCR is advisory only.
Paid access requires actual gateway verification or explicit admin confirmation
against the bank/gateway. The second migration enforces this at enrollment and
content RLS boundaries, including mobile requests. An enrollment marked approved
without payment confirmation cannot read videos, text, or quizzes. Valid sponsored
redemptions remain eligible without payment. Public curriculum metadata no longer
exposes legacy video identifiers; those resources move into protected content.

Historical OCR-only approvals are preserved in `unverified_access_suspensions`
and moved to pending. A read-only production audit on 19 October 2026 found zero
rows with that OCR flag, and nine other approved enrollments without confirmed
payment. Those nine need review before release: the new content policy will hold
their access until a real payment is confirmed or they receive legitimate sponsored
access. This is not a finding that they are fraudulent. Keep their evidence and
verify the actual payment; do not mark them paid merely to bypass the safeguard.
Legacy-account migration now preserves pending/rejected states and cannot turn a
receipt-only enrollment into approved access.

### Course improvements after the access release

The second phase is prepared separately in
`supabase/migrations/20261019020000_course_quality_improvements.sql`.
Across all six published courses it improves 55 lesson descriptions, corrects
14 existing text resources and four quiz questions, and adds six study guides
and 24 formative questions across eight optional quizzes. Existing recordings,
other resources and historical grades remain in place.

Apply this migration only after the coupon/account/access release. It verifies
the audited text and ownership before changing anything; a conflicting edit
aborts the transaction. It can be re-run without duplicate content. Seven
published Python examples were executed, including the CI/CD HTTP exercise on
an automatically selected local port. The authored manifests and primary-source
references are in `content/`; regenerate with
`node scripts/prepare-course-quality.mjs --snapshot backup/course-quality-20261019.json --write`
only against a current audited catalog snapshot.

### Verification

For a manual, disposable browser test, run
`bash scripts/start-coupon-sandbox.sh` and open `http://localhost:4179/login`.
The in-page demo banner links to test accounts and instructions. It uses local
PostgreSQL, PostgREST and the real application migrations/RPCs/access policies,
with two already-verified fixture accounts. Create a 100% invitation as admin,
then redeem it as the demo learner in a separate private window: both published
demo courses unlock under one participant claim, with two zero-collection receipts.
A 25% code on the INR 2,000 demo course previews INR 1,500 remaining.
Google identity, email delivery and paid checkout are deliberately disconnected
in this local fixture; no charge can occur. Demo PDFs are visibly labelled test
documents. Real Google sign-in must be checked after provider redirect URLs are
configured for the release host. Stop and delete the disposable data with
`bash scripts/start-coupon-sandbox.sh --stop`. Existing local services and all
production accounts/data remain untouched.

Run `npm test`, `npx tsc --noEmit -p tsconfig.app.json`, and `npm run build`.
Run `bash scripts/test-sponsorship.sh` for the isolated PostgreSQL integration
suite (Docker required). It checks verified accounts and email rosters, seat caps
and concurrent claims, replay safety, permission boundaries, sponsored receipt
immutability, preservation of paid invoices, and automatic future-course grants.
It also tests the editorial migration twice against a portable teaching-only
fixture, checks preservation of media and grades, and verifies rollback when
content or ownership has changed.
