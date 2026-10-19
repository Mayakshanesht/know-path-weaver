\set ON_ERROR_STOP on
-- Fixed local identities; no production data or OAuth service is used.
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
SELECT ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'learner' || n || '@example.edu', CASE WHEN n IN (3, 4, 5) THEN NULL ELSE now() END,
  jsonb_build_object('full_name', 'Learner ' || n)
FROM generate_series(1, 12) n;
INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-000000000001', 'admin');
INSERT INTO auth.identities (user_id, provider, identity_data)
SELECT id, 'google', jsonb_build_object('email', CASE WHEN email = 'learner4@example.edu' THEN 'wrong@example.edu' ELSE email END,
  'email_verified', true) FROM auth.users WHERE email <> 'learner3@example.edu';
UPDATE public.billing_settings SET place_of_supply = 'Maharashtra (27)', india_gst_rate = 18;
INSERT INTO public.courses (id, title, price_india, price_international, is_published)
SELECT ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'Course ' || n, n * 1000 + 999, n * 20 + 99, n <> 3 FROM generate_series(1, 5) n;
INSERT INTO public.enrollments (user_id, course_id, status, amount_paid, currency, billing_region,
  billing_country, billing_state, payment_confirmed, payment_confirmed_at)
VALUES ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'approved', 14999, 'INR',
  'india', 'IN', 'Maharashtra', true, now());
INSERT INTO public.enrollments (user_id, course_id, status, amount_paid, currency, payment_reference, payment_receipt_url, payment_code, auto_approved)
VALUES
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'pending', 1234, 'INR', 'Original reference', 'private/receipt', 'ORIGINAL-CODE', false),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'approved', 4999, 'INR', 'OCR reference', 'private/ocr', 'OCR-CODE', true),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'rejected', 0, 'INR', NULL, NULL, NULL, false);
SELECT public.test_assert((SELECT count(*) = 1 AND min(amount) = 14999 AND min(tax_amount) = 2287.98
  AND min(cgst_amount) = 1143.99 AND min(document_type) = 'tax_invoice' AND min(discount_amount) = 0
  FROM public.invoices), 'paid amount and GST remain unchanged');
INSERT INTO vault.decrypted_secrets VALUES ('enrollment_webhook_url', 'https://local.invalid/enrollment'),
  ('invoice_webhook_url', 'https://local.invalid/invoice'), ('enrollment_webhook_secret', 'local-test-secret');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT public.admin_create_sponsorship_code('Team Alpha', 'SAEINDIA 2027 aBAJA', 'team', 'Alpha Racing', 5, NULL, now() + interval '1 day',
  '20000000-0000-0000-0000-000000000001') ->> 'code' AS team_code \gset
SELECT public.test_assert((public.admin_create_sponsorship_code('Retry', 'Changed', 'general', NULL, 1, NULL, NULL,
  '20000000-0000-0000-0000-000000000001') ->> 'code') = :'team_code', 'creation retries reuse the same code');
SELECT public.admin_create_sponsorship_code('Roster', 'Roster programme', 'committee', NULL, 2,
  ARRAY[' LEARNER6@EXAMPLE.EDU ', 'learner6@example.edu'], NULL) ->> 'code' AS roster_code \gset
SELECT public.admin_create_sponsorship_code('Capacity', 'Capacity programme', 'general', NULL, 1, NULL, NULL) ->> 'code' AS capacity_code \gset
SELECT public.admin_create_sponsorship_code('Expiry', 'Expiry programme', 'general', NULL, 1, NULL, now() + interval '1 hour') ->> 'code' AS expiry_code \gset
SELECT public.admin_create_sponsorship_code('Second Team', 'SAEINDIA 2027 aBAJA', 'team', 'Beta Racing', 5, NULL, NULL) ->> 'code' AS second_team_code \gset
SELECT public.admin_create_sponsorship_code('Individual', 'Invitation programme', 'individual', NULL, 1, ARRAY['learner10@example.edu'], NULL) ->> 'code' AS invitation_code \gset
SELECT public.test_expect_error($q$SELECT public.admin_create_sponsorship_code('Bad', 'Campaign', 'team', 'Team', 36, NULL, NULL)$q$, '5 to 35');
SELECT public.test_expect_error($q$SELECT public.admin_create_sponsorship_code('Bad', 'Campaign', 'individual', NULL, 1, NULL, NULL)$q$, 'exactly one invited email');
SELECT public.test_expect_error($q$SELECT public.admin_create_sponsorship_code('Bad', 'Campaign', 'general', NULL, 1, ARRAY['a@example.edu','b@example.edu'], NULL)$q$, 'more email addresses');
SELECT public.test_expect_error($q$UPDATE public.sponsorship_codes SET max_redemptions = 5000$q$, 'permission denied');
SELECT public.test_assert((SELECT allowed_emails = ARRAY['learner6@example.edu'] FROM public.sponsorship_codes WHERE code = :'roster_code'), 'rosters normalized and deduplicated');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
SELECT public.test_expect_error(format('SELECT public.redeem_sponsorship_code(%L, %L, %L)', :'team_code', 'Fake User', 'College'), 'Verify your email');
SELECT public.test_expect_error(format('SELECT public.quote_sponsorship_code(%L, %L)', :'team_code', '10000000-0000-0000-0000-000000000002'), 'Verify your email');
SELECT public.test_expect_error($q$SELECT public.admin_create_sponsorship_code('Bad', 'Campaign', 'general', NULL, 1, NULL, NULL)$q$, 'Only administrators');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.sponsorship_codes), 'learners cannot read codes or rosters');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
SELECT public.test_expect_error(format('SELECT public.redeem_sponsorship_code(%L, %L, %L)', :'team_code', 'Wrong Identity', 'College'), 'Verify your email');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
SELECT public.test_expect_error(format('SELECT public.redeem_sponsorship_code(%L, %L, %L)', :'team_code', 'Unverified', 'College'), 'Verify your email');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
SELECT public.test_expect_error(format('SELECT public.redeem_sponsorship_code(%L, %L, %L)', :'roster_code', 'Not Invited', 'College'), 'not on the invitation roster');
SELECT public.test_expect_error(format('SELECT public.quote_sponsorship_code(%L, %L)', :'roster_code', '10000000-0000-0000-0000-000000000002'), 'not on the invitation roster');
SELECT public.test_assert((public.quote_sponsorship_code(lower(:'team_code'), '10000000-0000-0000-0000-000000000002')->>'list_price')::numeric = 2999
  AND (public.quote_sponsorship_code(:'team_code', '10000000-0000-0000-0000-000000000002')->>'discount_amount')::numeric = 2999
  AND (public.quote_sponsorship_code(:'team_code', '10000000-0000-0000-0000-000000000002')->>'total')::numeric = 0,
  'coupon quote previews the full discount and zero payable total');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.sponsorship_redemptions), 'quoting does not consume any sponsorship seats');
SELECT public.test_assert((SELECT count(*) = 4 FROM public.enrollments), 'quoting does not enroll in any additional course');
SELECT public.test_expect_error(format('SELECT public.quote_sponsorship_code(%L, %L)', :'team_code', '10000000-0000-0000-0000-000000000003'), 'published course');
SELECT public.test_expect_error($q$INSERT INTO public.enrollments(user_id, course_id, status, payment_confirmed)
  VALUES(auth.uid(), '10000000-0000-0000-0000-000000000003', 'approved', true)$q$, 'row-level security');
SELECT public.test_expect_error($q$SELECT public.grant_sponsored_course(gen_random_uuid(), gen_random_uuid())$q$, 'permission denied');
SELECT public.test_assert((public.redeem_sponsorship_code(lower(:'team_code'), 'Student Alpha', 'Engineering College') ->> 'enrolled_count')::int = 3, 'claim converts pending, OCR and rejected checkouts');
SELECT public.test_assert((public.redeem_sponsorship_code(:'team_code', '', '') ->> 'already_redeemed')::boolean, 'claim retry is idempotent');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.sponsorship_redemptions), 'one seat covers all courses');
SELECT public.test_assert((SELECT count(*) = 4 FROM public.enrollments WHERE status = 'approved'), 'published courses unlocked');
SELECT public.test_assert((SELECT count(*) = 3 FROM public.invoices WHERE document_type = 'sponsorship_receipt'
  AND amount = 0 AND tax_amount = 0 AND discount_amount = list_price AND coupon_code = :'team_code'
  AND sponsorship_campaign = 'SAEINDIA 2027 aBAJA' AND team_name = 'Alpha Racing' AND invoice_number LIKE 'KGS-%'), 'receipts show full discount and exact attribution');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.invoices WHERE document_type = 'tax_invoice' AND amount = 14999), 'paid invoice preserved');
SELECT public.test_assert((SELECT sponsorship_prior_checkout ->> 'amount_paid' = '1234.00'
  AND sponsorship_prior_checkout ->> 'payment_code' = 'ORIGINAL-CODE'
  AND payment_reference = 'Original reference' AND payment_receipt_url = 'private/receipt'
  FROM public.enrollments WHERE course_id = '10000000-0000-0000-0000-000000000002'), 'pending payment evidence preserved');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.unreconciled_enrollments), 'free access excluded from bank reconciliation');
SELECT public.test_assert((SELECT sum(invoice_count) = 1 AND sum(total_amount) = 14999 FROM public.invoice_monthly_summary), 'free receipts excluded from paid tax summary');
SELECT public.test_expect_error(format('SELECT public.redeem_sponsorship_code(%L, %L, %L)', :'second_team_code', 'Student Alpha', 'College'), 'already have sponsored access');
SELECT public.test_expect_error(format('SELECT public.quote_sponsorship_code(%L, %L)', :'second_team_code', '10000000-0000-0000-0000-000000000002'), 'already have sponsored access');
WITH changes AS (UPDATE public.enrollments SET status = 'rejected' WHERE user_id = auth.uid() RETURNING id)
SELECT public.test_assert(count(*) = 0, 'learners cannot modify enrollments') FROM changes;
SELECT public.test_expect_error($q$INSERT INTO public.sponsorship_redemptions(code_id,user_id,full_name,email,college,coupon_code,code_label,campaign,audience)
  VALUES(gen_random_uuid(),auth.uid(),'Fake','fake@example.edu','College','FAKE','Fake','Fake','general')$q$, 'permission denied');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', false);
SELECT public.redeem_sponsorship_code(:'roster_code', 'Committee Member', 'SAEINDIA');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.sponsorship_redemptions), 'redemption rows protected by user RLS');
SELECT public.test_assert((SELECT count(*) = 4 FROM public.invoices), 'invoice RLS hides other learners');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000010', false);
SELECT public.redeem_sponsorship_code(:'invitation_code', 'Invited Member', 'Organisation');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT public.admin_set_sponsorship_code_active((SELECT id FROM public.sponsorship_codes WHERE code = :'team_code'), false);
SELECT public.test_expect_error($q$UPDATE public.enrollments SET payment_confirmed = true WHERE access_source = 'sponsorship'$q$, 'cannot be changed');
SELECT public.test_expect_error($q$UPDATE public.enrollments SET access_source = 'payment', sponsorship_redemption_id = NULL WHERE access_source = 'sponsorship'$q$, 'cannot be changed');
SELECT public.test_expect_error($q$UPDATE public.enrollments SET billing_region = 'international' WHERE access_source = 'sponsorship'$q$, 'cannot be changed');
SELECT public.test_expect_error($q$UPDATE public.invoices SET amount = 1 WHERE document_type = 'sponsorship_receipt'$q$, 'immutable');
SELECT public.test_expect_error($q$UPDATE public.invoices SET coupon_code = 'EDITED' WHERE document_type = 'sponsorship_receipt'$q$, 'immutable');
SELECT public.test_expect_error($q$DELETE FROM public.enrollments WHERE access_source = 'sponsorship'$q$, 'cannot be deleted');
SELECT public.test_expect_error($q$DELETE FROM public.invoices WHERE document_type = 'sponsorship_receipt'$q$, 'cannot be deleted');
UPDATE public.invoices SET storage_path = 'local-test/receipt.pdf' WHERE document_type = 'sponsorship_receipt';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', false);
SELECT public.test_expect_error(format('SELECT public.redeem_sponsorship_code(%L, %L, %L)', :'team_code', 'New Student', 'College'), 'paused');
SELECT public.test_expect_error(format('SELECT public.quote_sponsorship_code(%L, %L)', :'team_code', '10000000-0000-0000-0000-000000000002'), 'paused');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
SELECT public.test_assert((public.redeem_sponsorship_code(:'team_code', '', '') ->> 'already_redeemed')::boolean, 'paused code preserves prior entitlement and retry');
SELECT public.test_assert((public.quote_sponsorship_code(:'team_code', '10000000-0000-0000-0000-000000000002')->>'already_redeemed')::boolean, 'existing learner can still quote a paused invitation');

RESET ROLE;
SELECT public.test_assert((SELECT count(*) = 0 FROM net.test_http_requests WHERE body ->> 'table' = 'enrollments'), 'free grants do not send payment approval emails');
UPDATE public.sponsorship_codes SET expires_at = now() - interval '1 hour' WHERE code = :'expiry_code';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', false);
SELECT public.test_expect_error(format('SELECT public.redeem_sponsorship_code(%L, %L, %L)', :'expiry_code', 'New Student', 'College'), 'deadline');
SELECT public.test_expect_error(format('SELECT public.quote_sponsorship_code(%L, %L)', :'expiry_code', '10000000-0000-0000-0000-000000000002'), 'deadline');
RESET ROLE;
UPDATE public.courses SET is_published = true WHERE id = '10000000-0000-0000-0000-000000000003';
SELECT public.test_assert((SELECT count(*) = 3 FROM public.enrollments WHERE course_id = '10000000-0000-0000-0000-000000000003' AND access_source = 'sponsorship'), 'newly published courses granted after code pause');
SELECT public.test_assert((SELECT count(*) = 3 FROM public.invoices WHERE course_id = '10000000-0000-0000-0000-000000000003' AND document_type = 'sponsorship_receipt'), 'future courses issue zero receipts');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.enrollments WHERE user_id IN ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005')), 'rejected identities did not receive access');
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000010';
SELECT public.test_assert((SELECT count(*) = 0 FROM public.invoices WHERE user_id = '00000000-0000-0000-0000-000000000010'), 'intentional account erasure still cascades');

-- Late gateway confirmations are a separate reconciliation record, never a
-- rewrite of the existing sponsorship or its zero-payment receipt.
SET ROLE service_role;
SELECT public.record_sponsorship_payment_review('00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002', 'pay_late_one', 1234, 'inr', 'razorpay-verify') AS review_id \gset
SELECT public.test_assert(public.record_sponsorship_payment_review('00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002', 'pay_late_one', 1234, 'INR', 'payment-grant') = :'review_id'::uuid,
  'duplicate gateway notification is idempotent across the two trusted sources');
SELECT public.test_expect_error($q$SELECT public.record_sponsorship_payment_review('00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002', 'pay_late_one', 999, 'INR', 'payment-grant')$q$, 'different learner, course, amount or currency');
SELECT public.test_expect_error($q$SELECT public.record_sponsorship_payment_review('00000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000002', 'pay_late_one', 1234, 'INR', 'payment-grant')$q$, 'different learner, course, amount or currency');
SELECT public.test_expect_error($q$SELECT public.record_sponsorship_payment_review('00000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000001', 'pay_paid_enrollment', 14999, 'INR', 'payment-grant')$q$, 'existing sponsored enrollment');
SELECT public.test_expect_error($q$SELECT public.record_sponsorship_payment_review('00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002', 'pay_no_amount', NULL, 'INR', 'payment-grant')$q$, 'positive payment amount');
SELECT public.test_expect_error($q$SELECT public.record_sponsorship_payment_review('00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002', 'pay_bad_amount', 12.345, 'INR', 'payment-grant')$q$, 'positive payment amount');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
SELECT public.test_expect_error($q$SELECT public.record_sponsorship_payment_review(auth.uid(),
  '10000000-0000-0000-0000-000000000002', 'pay_fake', 1234, 'INR', 'payment-grant')$q$, 'permission denied');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.sponsorship_payment_reviews), 'learners cannot read gateway payment reviews');
SELECT public.test_expect_error(format('SELECT public.admin_resolve_sponsorship_payment_review(%L, %L)', :'review_id', 'Fake resolution'), 'Only administrators');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT public.test_assert((SELECT count(*) = 1 AND min(amount) = 1234 AND min(buyer_email) = 'learner2@example.edu'
  AND min(course_title) = 'Course 2' AND min(status) = 'needs_review' FROM public.sponsorship_payment_reviews), 'admin sees immutable original payment and buyer snapshots');
SELECT public.test_expect_error($q$UPDATE public.sponsorship_payment_reviews SET amount = 1$q$, 'permission denied');
SELECT public.test_expect_error(format('SELECT public.admin_resolve_sponsorship_payment_review(%L, %L)', :'review_id', ''), 'how this payment was reconciled');
SELECT public.admin_resolve_sponsorship_payment_review(:'review_id', 'Refund confirmed in gateway dashboard; reference refund_local_test.');
SELECT public.admin_resolve_sponsorship_payment_review(:'review_id', 'Repeated resolution must not replace original notes.');
SELECT public.test_assert((SELECT status = 'resolved' AND review_notes = 'Refund confirmed in gateway dashboard; reference refund_local_test.'
  AND resolved_by = auth.uid() AND resolved_at IS NOT NULL FROM public.sponsorship_payment_reviews WHERE id = :'review_id'), 'admin resolution is attributed and idempotent');
SELECT public.test_assert((SELECT amount = 0 AND discount_amount = list_price AND document_type = 'sponsorship_receipt'
  FROM public.invoices WHERE user_id = '00000000-0000-0000-0000-000000000002'
  AND course_id = '10000000-0000-0000-0000-000000000002'), 'late actual payment never rewrites the original zero receipt');
RESET ROLE;
SELECT public.test_expect_error($q$UPDATE public.sponsorship_payment_reviews SET amount = 1$q$, 'Original sponsorship payment details are immutable');
-- A password account with a completed email confirmation is also eligible.
-- Merely inspecting a valid quote leaves the invitation unused.
UPDATE auth.users SET email_confirmed_at = now() WHERE id = '00000000-0000-0000-0000-000000000003';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT public.admin_create_sponsorship_code('Verified email invitation', 'Verified email programme', 'individual', NULL,
  1, ARRAY['learner3@example.edu'], NULL) ->> 'code' AS email_code \gset
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
SELECT public.test_assert((public.quote_sponsorship_code(:'email_code', '10000000-0000-0000-0000-000000000002')->>'total')::numeric = 0,
  'confirmed email account can quote without a Google identity');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.sponsorship_redemptions), 'verified email quote does not enroll or claim a seat');
SELECT public.test_assert((public.redeem_sponsorship_code(:'email_code', 'Verified Email Student', 'Engineering College')->>'enrolled_count')::int = 5,
  'explicit free-enrollment confirmation grants the verified email account access');
SELECT public.test_assert((public.quote_sponsorship_code(:'email_code', '10000000-0000-0000-0000-000000000002')->>'already_redeemed')::boolean,
  'a full single-seat code stays valid for its original learner');
RESET ROLE;
-- Used by the shell runner to exercise simultaneous claims from two sessions.
SELECT :'capacity_code' AS concurrency_code;
\echo Sponsorship SQL assertions passed.
