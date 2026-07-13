-- Give the catalogue a deliberate order.
--
-- It was ordered by created_at DESC, so the shop window was arranged by the accident of
-- which course happened to be imported last. That put Motion Planning -- 2 lessons, no
-- hours, early access -- above ADAS, which is the flagship and the one that makes the case
-- for everything else.
--
-- The grid is three columns on desktop, so the first three occupy row one. Flagships there;
-- the short Perception Lab and the still-building Motion Planning on row two.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 100;

UPDATE public.courses SET display_order = 1 WHERE title ILIKE '%Advanced Driver Assistance%';
UPDATE public.courses SET display_order = 2 WHERE title ILIKE '%AI Bootcamp%';
UPDATE public.courses SET display_order = 3 WHERE title ILIKE '%Vehicle Dynamics%';
UPDATE public.courses SET display_order = 4 WHERE title ILIKE '%Perception lab%';
UPDATE public.courses SET display_order = 5 WHERE title ILIKE '%Motion Planning%';
