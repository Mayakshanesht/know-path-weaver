-- Close the paywall.
--
-- The old policy granted SELECT on capsule_content whenever the COURSE was published,
-- with no reference to the viewer at all. Publishing a course therefore published its
-- content to the entire internet: the anon key ships in the public JS bundle, so anyone
-- could read all 187 rows — every Google Drive video id and every Colab notebook link —
-- without signing in, let alone paying.
--
-- The app already gates the learn page on an APPROVED enrollment. The database now agrees
-- with it, which is the only place the gate actually holds: a client-side check protects
-- nothing from someone who skips the client.
--
-- What stays public, deliberately: courses, learning_paths and capsules — the titles and
-- descriptions. That is the curriculum, and a prospective learner should be able to read
-- every word of it before deciding to buy. It is the marketing surface, not the product.
-- The product is what capsule_content points at.

DROP POLICY IF EXISTS "Capsule content is viewable" ON public.capsule_content;

CREATE POLICY "Capsule content is viewable by enrolled learners"
ON public.capsule_content
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM capsules cap
    JOIN learning_paths lp ON lp.id = cap.learning_path_id
    JOIN enrollments e ON e.course_id = lp.course_id
    WHERE cap.id = capsule_content.capsule_id
      AND e.user_id = auth.uid()
      AND e.status = 'approved'
  )
);
