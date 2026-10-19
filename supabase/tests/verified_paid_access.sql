\set ON_ERROR_STOP on
SELECT public.test_assert((SELECT status = 'pending' AND payment_confirmed = false AND auto_approved = true
  AND payment_reference = 'FORGED-UPI-REF' AND payment_receipt_url = 'private/fake-image' AND amount_paid = 1999
  FROM public.enrollments WHERE user_id = '00000000-0000-0000-0000-000000000013'), 'old OCR unlock suspended without discarding payment evidence');
SELECT public.test_assert((SELECT count(*) = 1 AND min(enrollment_snapshot ->> 'status') = 'approved'
  AND min(enrollment_snapshot ->> 'payment_reference') = 'FORGED-UPI-REF'
  AND min(enrollment_snapshot ->> 'admin_notes') LIKE '%grants_access%'
  FROM public.unverified_access_suspensions WHERE user_id='00000000-0000-0000-0000-000000000013'), 'exact historical OCR row preserved for admin review');
SELECT public.test_assert((SELECT count(*)=2 FROM public.unverified_access_suspensions), 'both manual and OCR unconfirmed approvals are audited');
SELECT public.test_assert((SELECT status='pending' AND payment_reference='LEGACY-MANUAL' AND payment_receipt_url='private/manual-image'
  FROM public.enrollments WHERE user_id='00000000-0000-0000-0000-000000000016'), 'manual approval without verified money is held pending with original evidence');
SELECT public.test_assert((SELECT status = 'approved' AND payment_confirmed = true AND auto_approved = true
  FROM public.enrollments WHERE user_id = '00000000-0000-0000-0000-000000000014'), 'confirmed real payment left intact');
SELECT public.test_assert((SELECT status = 'approved' AND payment_confirmed = false
  FROM public.enrollments WHERE user_id = '00000000-0000-0000-0000-000000000018'), 'migration does not rewrite enrollment with existing accounting document');
SELECT public.test_assert((SELECT amount = 1999 FROM public.invoices WHERE invoice_number = 'KG-LOCAL-PREEXISTING'), 'existing accounting document preserved');

SET ROLE service_role;
SELECT public.test_expect_error($q$UPDATE public.enrollments SET status='approved', auto_approved=true,
  admin_notes='{"receipt_check":{"grants_access":true,"match":true}}'
  WHERE user_id='00000000-0000-0000-0000-000000000017'$q$, 'receipt image cannot approve access');
SELECT public.test_expect_error($q$INSERT INTO public.enrollments(user_id,course_id,status,payment_confirmed,auto_approved)
  VALUES('00000000-0000-0000-0000-000000000017','10000000-0000-0000-0000-000000000002','approved',false,true)$q$, 'receipt image cannot approve access');
SELECT public.test_expect_error($q$UPDATE public.enrollments SET status='approved',payment_confirmed=true,auto_approved=true
  WHERE user_id='00000000-0000-0000-0000-000000000017'$q$, 'auto-approval is disabled');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);
SELECT public.test_assert(NOT public.has_verified_course_access('10000000-0000-0000-0000-000000000001'), 'fake-image learner cannot access the course');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.capsule_content), 'fake-image learner cannot retrieve video/content URLs');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.quizzes), 'fake-image learner cannot retrieve quizzes');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.quiz_questions), 'fake-image learner cannot retrieve questions');
SELECT public.test_assert((SELECT count(*) = 2 AND bool_and(drive_file_id IS NULL)
  FROM public.capsules), 'public curriculum stays visible without legacy video identifiers');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.unverified_access_suspensions), 'audit snapshots are admin-only');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000016', false);
SELECT public.test_assert(NOT public.has_verified_course_access('10000000-0000-0000-0000-000000000001'), 'legacy approved/unconfirmed manual row cannot bypass verified-payment requirement');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.capsule_content), 'legacy unconfirmed course content stays protected');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000014', false);
SELECT public.test_assert(public.has_verified_course_access('10000000-0000-0000-0000-000000000001'), 'confirmed paid learner keeps access even with historical OCR flag');
SELECT public.test_assert((SELECT count(*) = 2 FROM public.capsule_content), 'confirmed paid learner keeps video access, including migrated legacy video');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.quizzes), 'confirmed paid learner keeps quiz access');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.quiz_questions), 'confirmed paid learner keeps question access');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000015', false);
SELECT public.test_assert(public.has_verified_course_access('10000000-0000-0000-0000-000000000001'), 'legitimate sponsored learner keeps free access');
SELECT public.test_assert((SELECT count(*) = 2 FROM public.capsule_content), 'sponsored learner keeps video access, including migrated legacy video');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.quizzes), 'sponsored learner keeps quiz access');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.quiz_questions), 'sponsored learner keeps question access');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT public.test_assert((SELECT count(*) = 2 FROM public.unverified_access_suspensions), 'admin can review historical suspension evidence');
UPDATE public.enrollments SET status = 'approved', payment_confirmed = true, auto_approved = false,
  payment_confirmed_at = now(), admin_notes = 'Actual payment checked on bank statement'
WHERE user_id = '00000000-0000-0000-0000-000000000017';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000017', false);
SELECT public.test_assert(public.has_verified_course_access('10000000-0000-0000-0000-000000000001'), 'actual bank confirmation grants paid access');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.invoices WHERE document_type = 'tax_invoice'), 'real confirmed payment issues its tax invoice');
RESET ROLE;
UPDATE public.capsules SET drive_file_id = 'future-private-video', drive_file_name = 'New legacy upload',
  drive_file_type = 'video/mp4' WHERE id = '40000000-0000-0000-0000-000000000001';
SELECT public.test_assert((SELECT drive_file_id IS NULL AND drive_file_name IS NULL AND drive_file_type IS NULL
  FROM public.capsules WHERE id = '40000000-0000-0000-0000-000000000001'), 'future legacy uploads cannot expose a video on the public curriculum');
SELECT public.test_assert((SELECT count(*) = 1 FROM public.capsule_content WHERE content_value = 'future-private-video'
  AND metadata ->> 'file_name' = 'New legacy upload'), 'future legacy upload is preserved as protected course content');
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.test_assert((SELECT count(*) = 2 AND bool_and(drive_file_id IS NULL AND drive_file_name IS NULL AND drive_file_type IS NULL)
  FROM public.capsules), 'anonymous catalogue contains no legacy video identifiers');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.capsule_content), 'anonymous viewers cannot retrieve migrated video resources');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000014', false);
SELECT public.test_assert((SELECT count(*) = 1 FROM public.capsule_content WHERE content_value = 'legacy-only-private-video'), 'confirmed paid learner can watch the migrated legacy-only video');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000015', false);
SELECT public.test_assert((SELECT count(*) = 1 FROM public.capsule_content WHERE content_value = 'legacy-only-private-video'), 'sponsored learner can watch the migrated legacy-only video');
RESET ROLE;
INSERT INTO public.invoice_counters(period, last_number) VALUES ('S' || to_char(now(), 'YYYYMM'), 9999)
  ON CONFLICT (period) DO UPDATE SET last_number = 9999;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT public.admin_create_sponsorship_code('Large sequence test', 'Large receipt sequence', 'individual', NULL,
  1, ARRAY['learner13@example.edu'], NULL) ->> 'code' AS sequence_code \gset
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);
SELECT public.redeem_sponsorship_code(:'sequence_code', 'Previously Suspended Learner', 'Engineering College');
SELECT public.test_assert((SELECT count(*) = 5 AND bool_and(invoice_number ~ '^KGS-[0-9]{6}-1000[0-4]$')
  FROM public.invoices WHERE user_id = '00000000-0000-0000-0000-000000000013'), 'sponsorship receipt sequence does not truncate above 9999');
\echo Verified paid-access security assertions passed.
