-- Base schema.
--
-- These tables were created by Lovable directly against the database, so no
-- migration for them ever existed in this repo. Reconstructed from the generated
-- types (src/integrations/supabase/types.ts) so the project can be stood up from
-- scratch on a Supabase project we actually own.
--
-- Runs first (filename sorts before the capsule_content and quiz migrations, which
-- build on top of it).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE public.app_role          AS ENUM ('admin', 'student');                      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.enrollment_status AS ENUM ('pending', 'approved', 'rejected');       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quiz_type         AS ENUM ('quiz', 'assignment');                    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.question_type     AS ENUM ('mcq', 'short_answer', 'true_false', 'multiple_select'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.content_type AS ENUM
    ('google_drive', 'youtube', 'github', 'colab', 'weblink', 'text', 'image', 'pdf');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Shared functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER is load-bearing: this is called from inside the RLS policies on
-- user_roles itself, so a plain function would recurse into the policy that calls it.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles + roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Roles live in their own table, never as a column on profiles: a self-editable
-- profile row with a role column is a privilege-escalation waiting to happen.
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Give every new signup a profile and the student role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Course structure
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  text NOT NULL,
  description            text,
  thumbnail_url          text,
  curriculum_preview     text,
  price_india            numeric,
  price_international    numeric,
  bank_details           text,
  payment_reference_code text,
  is_published           boolean DEFAULT false,
  created_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_paths (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.capsules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  drive_file_id    text,
  drive_file_name  text,
  drive_file_type  text,
  duration_minutes integer,
  order_index      integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.capsule_prerequisites (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id              uuid NOT NULL REFERENCES public.capsules(id) ON DELETE CASCADE,
  prerequisite_capsule_id uuid NOT NULL REFERENCES public.capsules(id) ON DELETE CASCADE,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capsule_id, prerequisite_capsule_id),
  CHECK (capsule_id <> prerequisite_capsule_id)
);

CREATE INDEX IF NOT EXISTS learning_paths_course_idx ON public.learning_paths(course_id);
CREATE INDEX IF NOT EXISTS capsules_path_idx         ON public.capsules(learning_path_id);

-- ---------------------------------------------------------------------------
-- Enrollments + progress
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enrollments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id           uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status              public.enrollment_status NOT NULL DEFAULT 'pending',
  payment_reference   text,
  payment_receipt_url text,
  admin_notes         text,
  enrolled_at         timestamptz NOT NULL DEFAULT now(),
  approved_at         timestamptz,
  UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.progress (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capsule_id       uuid NOT NULL REFERENCES public.capsules(id) ON DELETE CASCADE,
  watch_percentage numeric DEFAULT 0,
  is_completed     boolean DEFAULT false,
  completed_at     timestamptz,
  last_watched_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, capsule_id)
);

CREATE INDEX IF NOT EXISTS enrollments_user_idx ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS progress_user_idx    ON public.progress(user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'courses', 'learning_paths', 'capsules'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- This is the entire security boundary: the anon key is public by design and ships
-- in the browser bundle, so these policies are what actually stop a stranger from
-- reading another learner's data.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_paths        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capsules              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capsule_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress              ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- user_roles: readable by the owner, writable only by admins. A user must never be
-- able to insert their own 'admin' row.
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- courses
DROP POLICY IF EXISTS "Published courses are viewable" ON public.courses;
CREATE POLICY "Published courses are viewable" ON public.courses FOR SELECT
  USING (is_published = true OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage courses" ON public.courses;
CREATE POLICY "Admins can manage courses" ON public.courses FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- learning_paths
DROP POLICY IF EXISTS "Learning paths are viewable" ON public.learning_paths;
CREATE POLICY "Learning paths are viewable" ON public.learning_paths FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = learning_paths.course_id
      AND (c.is_published = true OR has_role(auth.uid(), 'admin'))
  ));

DROP POLICY IF EXISTS "Admins can manage learning paths" ON public.learning_paths;
CREATE POLICY "Admins can manage learning paths" ON public.learning_paths FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- capsules
DROP POLICY IF EXISTS "Capsules are viewable" ON public.capsules;
CREATE POLICY "Capsules are viewable" ON public.capsules FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.learning_paths lp
    JOIN public.courses c ON c.id = lp.course_id
    WHERE lp.id = capsules.learning_path_id
      AND (c.is_published = true OR has_role(auth.uid(), 'admin'))
  ));

DROP POLICY IF EXISTS "Admins can manage capsules" ON public.capsules;
CREATE POLICY "Admins can manage capsules" ON public.capsules FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- capsule_prerequisites
DROP POLICY IF EXISTS "Prerequisites are viewable" ON public.capsule_prerequisites;
CREATE POLICY "Prerequisites are viewable" ON public.capsule_prerequisites FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage prerequisites" ON public.capsule_prerequisites;
CREATE POLICY "Admins can manage prerequisites" ON public.capsule_prerequisites FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- enrollments: a learner may create and read their own; only an admin may approve.
DROP POLICY IF EXISTS "Users can view own enrollments" ON public.enrollments;
CREATE POLICY "Users can view own enrollments" ON public.enrollments FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can create own enrollments" ON public.enrollments;
CREATE POLICY "Users can create own enrollments" ON public.enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Admins can manage enrollments" ON public.enrollments;
CREATE POLICY "Admins can manage enrollments" ON public.enrollments FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- progress
DROP POLICY IF EXISTS "Users can manage own progress" ON public.progress;
CREATE POLICY "Users can manage own progress" ON public.progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all progress" ON public.progress;
CREATE POLICY "Admins can view all progress" ON public.progress FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('course-content', 'course-content', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-receipts', 'payment-receipts', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Course content is readable" ON storage.objects;
CREATE POLICY "Course content is readable" ON storage.objects FOR SELECT
  USING (bucket_id IN ('course-content', 'payment-receipts'));

DROP POLICY IF EXISTS "Admins can upload course content" ON storage.objects;
CREATE POLICY "Admins can upload course content" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'course-content' AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can upload own receipts" ON storage.objects;
CREATE POLICY "Users can upload own receipts" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND auth.uid() IS NOT NULL
    -- Receipts are stored under <user_id>/..., so this confines a learner to their
    -- own prefix rather than letting them overwrite anyone else's receipt.
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Making yourself admin, after signing up on the new project:
--
--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'you@example.com'
--   on conflict (user_id, role) do nothing;
-- ---------------------------------------------------------------------------
