-- A receipt image can be forged. Its OCR text cannot authorize course access.
-- Paid access follows a confirmed bank/gateway payment; free access follows a
-- protected sponsorship redemption. Preserve evidence from the former OCR path.
CREATE TABLE public.unverified_access_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL UNIQUE REFERENCES public.enrollments(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id),
  enrollment_snapshot jsonb NOT NULL,
  reason text NOT NULL DEFAULT 'Access approval was not backed by a confirmed bank or gateway payment',
  suspended_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.unverified_access_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read unverified access suspensions" ON public.unverified_access_suspensions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.unverified_access_suspensions FROM anon, authenticated, service_role;
GRANT SELECT ON public.unverified_access_suspensions TO authenticated;

-- Suspend approved paid access that has neither confirmed money nor an existing
-- invoice, including historical manual/OCR approvals. This is a review state,
-- not a fraud finding. Keep confirmed sales, invoices and sponsorships intact.
WITH suspect AS (
  SELECT e.* FROM public.enrollments e
  WHERE e.access_source = 'payment' AND e.status = 'approved'
    AND e.payment_confirmed = false
    AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.enrollment_id = e.id)
  FOR UPDATE
), logged AS (
  INSERT INTO public.unverified_access_suspensions (enrollment_id, user_id, course_id, enrollment_snapshot)
  SELECT s.id, s.user_id, s.course_id, to_jsonb(s) FROM suspect s
  ON CONFLICT (enrollment_id) DO NOTHING RETURNING enrollment_id
)
UPDATE public.enrollments e
SET status = 'pending', approved_at = NULL,
  admin_notes = concat_ws(E'\n', NULLIF(e.admin_notes, ''),
    'Access suspended: approval requires bank or gateway verification. Original enrollment preserved in unverified_access_suspensions.')
WHERE e.id IN (SELECT enrollment_id FROM logged);

CREATE OR REPLACE FUNCTION public.require_verified_paid_access()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.access_source = 'payment' AND NEW.status = 'approved' THEN
    IF NEW.payment_confirmed IS NOT TRUE THEN
      RAISE EXCEPTION 'Paid course access requires a verified bank or gateway payment; a receipt image cannot approve access';
    END IF;
    IF NEW.auto_approved IS TRUE THEN
      RAISE EXCEPTION 'Receipt-image auto-approval is disabled; confirm the payment and clear auto_approved';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER require_verified_paid_access BEFORE INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.require_verified_paid_access();
REVOKE ALL ON FUNCTION public.require_verified_paid_access() FROM PUBLIC, anon, authenticated;

-- Apply the same proof at the content boundary, including historical rows.
-- Sponsorship attribution can only be created by the protected redemption RPC.
CREATE OR REPLACE FUNCTION public.has_verified_course_access(p_course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.user_id = auth.uid() AND e.course_id = p_course_id AND e.status = 'approved'
      AND ((e.access_source = 'payment' AND e.payment_confirmed = true)
        OR (e.access_source = 'sponsorship' AND EXISTS (
          SELECT 1 FROM public.sponsorship_redemptions r
          WHERE r.id = e.sponsorship_redemption_id AND r.user_id = e.user_id
        )))
  );
$$;
REVOKE ALL ON FUNCTION public.has_verified_course_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_verified_course_access(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Capsule content is viewable by enrolled learners" ON public.capsule_content;
CREATE POLICY "Capsule content is viewable by enrolled learners" ON public.capsule_content FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.capsules cap JOIN public.learning_paths lp ON lp.id = cap.learning_path_id
    WHERE cap.id = capsule_content.capsule_id AND public.has_verified_course_access(lp.course_id)
  ));
DROP POLICY IF EXISTS "Published quizzes are viewable by enrolled users" ON public.quizzes;
CREATE POLICY "Published quizzes are viewable by enrolled users" ON public.quizzes FOR SELECT
  USING (is_published = true AND public.has_verified_course_access(course_id));
DROP POLICY IF EXISTS "Questions viewable for published quizzes by enrolled users" ON public.quiz_questions;
CREATE POLICY "Questions viewable for published quizzes by enrolled users" ON public.quiz_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_questions.quiz_id
    AND q.is_published = true AND public.has_verified_course_access(q.course_id)));

-- Capsules are public curriculum metadata, so legacy video identifiers must
-- live in the protected content table rather than in the public capsule row.
INSERT INTO public.capsule_content (capsule_id, content_type, title, content_value, metadata, order_index)
SELECT cap.id, 'google_drive', COALESCE(NULLIF(cap.drive_file_name, ''), 'Video'), cap.drive_file_id,
  jsonb_build_object('file_type', cap.drive_file_type, 'file_name', cap.drive_file_name,
    'migrated_from', 'capsules.legacy_drive_fields'),
  COALESCE((SELECT max(cc.order_index) + 1 FROM public.capsule_content cc WHERE cc.capsule_id = cap.id), 0)
FROM public.capsules cap WHERE NULLIF(trim(cap.drive_file_id), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.capsule_content cc WHERE cc.capsule_id = cap.id
    AND cc.content_type = 'google_drive' AND cc.content_value = cap.drive_file_id);
UPDATE public.capsules SET drive_file_id = NULL, drive_file_name = NULL, drive_file_type = NULL
WHERE drive_file_id IS NOT NULL OR drive_file_name IS NOT NULL OR drive_file_type IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_legacy_capsule_video()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NULLIF(trim(NEW.drive_file_id), '') IS NOT NULL THEN
    INSERT INTO public.capsule_content (capsule_id, content_type, title, content_value, metadata, order_index)
    SELECT NEW.id, 'google_drive', COALESCE(NULLIF(NEW.drive_file_name, ''), 'Video'), NEW.drive_file_id,
      jsonb_build_object('file_type', NEW.drive_file_type, 'file_name', NEW.drive_file_name,
        'migrated_from', 'capsules.legacy_drive_fields'),
      COALESCE((SELECT max(cc.order_index) + 1 FROM public.capsule_content cc WHERE cc.capsule_id = NEW.id), 0)
    WHERE NOT EXISTS (SELECT 1 FROM public.capsule_content cc WHERE cc.capsule_id = NEW.id
      AND cc.content_type = 'google_drive' AND cc.content_value = NEW.drive_file_id);
  END IF;
  IF NEW.drive_file_id IS NOT NULL OR NEW.drive_file_name IS NOT NULL OR NEW.drive_file_type IS NOT NULL THEN
    UPDATE public.capsules SET drive_file_id = NULL, drive_file_name = NULL, drive_file_type = NULL WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_legacy_capsule_video AFTER INSERT OR UPDATE OF drive_file_id, drive_file_name, drive_file_type
  ON public.capsules FOR EACH ROW EXECUTE FUNCTION public.protect_legacy_capsule_video();
REVOKE ALL ON FUNCTION public.protect_legacy_capsule_video() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.unverified_access_suspensions IS
  'Historical unconfirmed access suspensions. Original checkout evidence is retained for bank/gateway review.';
