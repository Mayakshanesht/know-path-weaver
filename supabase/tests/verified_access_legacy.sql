-- Stage historical rows before installing the paid-access guard. These states
-- cannot be inserted once the new migration has closed the OCR approval path.
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
SELECT ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'learner' || n || '@example.edu', now(), jsonb_build_object('full_name', 'Legacy Learner ' || n)
FROM generate_series(13, 18) n;
INSERT INTO auth.identities (user_id, provider, identity_data)
SELECT id, 'google', jsonb_build_object('email', email, 'email_verified', true)
FROM auth.users WHERE email IN ('learner13@example.edu','learner14@example.edu','learner15@example.edu',
  'learner16@example.edu','learner17@example.edu','learner18@example.edu');
INSERT INTO public.enrollments (user_id, course_id, status, payment_confirmed, auto_approved,
  amount_paid, currency, payment_reference, payment_receipt_url, admin_notes, approved_at)
VALUES
  ('00000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'approved', false, true,
    1999, 'INR', 'FORGED-UPI-REF', 'private/fake-image', '{"receipt_check":{"grants_access":true,"match":true}}', now()),
  ('00000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'approved', true, true,
    1999, 'INR', 'CONFIRMED-BANK-REF', 'private/real-image', 'Payment subsequently confirmed at the bank', now()),
  ('00000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001', 'approved', false, false,
    1999, 'INR', 'LEGACY-MANUAL', 'private/manual-image', 'Historical manual approval without bank confirmation', now()),
  ('00000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001', 'pending', false, false,
    1999, 'INR', 'FAKE-NEW-IMAGE', 'private/new-fake', NULL, NULL),
  ('00000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001', 'approved', false, true,
    1999, 'INR', 'LEGACY-INVOICE-REF', 'private/legacy-invoice-image', 'Existing accounting document must remain untouched', now());
INSERT INTO public.invoices (invoice_number, enrollment_id, user_id, course_id, amount, currency,
  region, course_title, buyer_email, period_year, period_month)
SELECT 'KG-LOCAL-PREEXISTING', e.id, e.user_id, e.course_id, 1999, 'INR', 'india', 'Course 1',
  'learner18@example.edu', extract(year FROM now())::int, extract(month FROM now())::int
FROM public.enrollments e WHERE e.user_id = '00000000-0000-0000-0000-000000000018';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT public.admin_create_sponsorship_code('Preserve sponsored access', 'Legacy sponsorship fixture',
  'individual', NULL, 1, ARRAY['learner15@example.edu'], NULL) ->> 'code' AS legacy_sponsor_code \gset
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000015', false);
SELECT public.redeem_sponsorship_code(:'legacy_sponsor_code', 'Sponsored Learner', 'Engineering College');

-- Content fixtures prove the database boundary, independent of UI decisions.
INSERT INTO public.learning_paths(id, course_id, title) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Protected path');
INSERT INTO public.capsules(id, learning_path_id, title, drive_file_id, drive_file_name, drive_file_type) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Protected capsule',
   'private-course-video-id', 'Legacy video', 'video/mp4'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Legacy-only capsule',
   'legacy-only-private-video', 'Legacy-only video', 'video/mp4');
INSERT INTO public.capsule_content(capsule_id, content_type, content_value) VALUES
  ('40000000-0000-0000-0000-000000000001', 'google_drive', 'private-course-video-id');
INSERT INTO public.quizzes(id, course_id, title, is_published) VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Protected quiz', true);
INSERT INTO public.quiz_questions(quiz_id, question_text, question_type, correct_answer) VALUES
  ('50000000-0000-0000-0000-000000000001', 'Protected question', 'mcq', '"answer"');
