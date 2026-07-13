-- Structured syllabus for the public course page.
--
-- The description field was being used to hold pasted internal notes ("🔹 Module 0 —
-- Foundations for Autonomous Systems\n\nGoal: Align programming + safety mindset...")
-- and the marketing page rendered them verbatim. curriculum_preview was a flat blob
-- of text with no structure to lay out.
--
-- This is the marketing view of the course, kept deliberately separate from
-- learning_paths/capsules, which are the delivery structure. They answer different
-- questions: "should I buy this" versus "what do I watch next".

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS tagline  text,
  ADD COLUMN IF NOT EXISTS syllabus jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.courses.syllabus IS
  'Marketing syllabus: { outcomes: string[], modules: [{title, goal, lectures[]}], projects: [{name, blurb}] }';

COMMENT ON COLUMN public.courses.tagline IS
  'One line under the title. Not the description.';
