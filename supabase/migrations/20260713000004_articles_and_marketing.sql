-- Daily AI-written research articles, and the marketing campaign workspace.

-- ---------------------------------------------------------------------------
-- Articles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.articles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  title        text NOT NULL,
  summary      text NOT NULL,
  body         text NOT NULL,                 -- markdown
  topic        text NOT NULL,
  reading_minutes integer NOT NULL DEFAULT 5,
  -- [{title, url}] — what the model actually read, so a reader can check it.
  sources      jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS articles_published_idx
  ON public.articles(published_at DESC) WHERE is_published;

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Articles are the public front page: readable by anyone, signed in or not.
DROP POLICY IF EXISTS "Published articles are public" ON public.articles;
CREATE POLICY "Published articles are public"
ON public.articles FOR SELECT
USING (is_published OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage articles" ON public.articles;
CREATE POLICY "Admins can manage articles"
ON public.articles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- Marketing
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.campaign_channel AS ENUM ('linkedin', 'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.campaign_status AS ENUM ('draft', 'approved', 'scheduled', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  channel     public.campaign_channel NOT NULL,
  course_id   uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  objective   text,                              -- what this campaign is for
  audience    text,                              -- who it targets
  status      public.campaign_status NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  published_at  timestamptz,
  -- Outcome tracking. Filled in by the admin; the agent has no way to know these.
  impressions integer NOT NULL DEFAULT 0,
  clicks      integer NOT NULL DEFAULT 0,
  signups     integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Several drafts per campaign, so a variant can be picked rather than regenerated.
CREATE TABLE IF NOT EXISTS public.marketing_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  variant     integer NOT NULL DEFAULT 1,
  subject     text,                              -- email only
  body        text NOT NULL,
  hashtags    text[] NOT NULL DEFAULT '{}',
  hook        text,                              -- the opening line, called out for review
  is_selected boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_posts_campaign_idx
  ON public.marketing_posts(campaign_id);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_posts     ENABLE ROW LEVEL SECURITY;

-- Marketing is admin-only in every direction. Learners have no reason to see it.
DROP POLICY IF EXISTS "Admins manage campaigns" ON public.marketing_campaigns;
CREATE POLICY "Admins manage campaigns"
ON public.marketing_campaigns FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage posts" ON public.marketing_posts;
CREATE POLICY "Admins manage posts"
ON public.marketing_posts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_marketing_campaigns_updated_at ON public.marketing_campaigns;

CREATE TRIGGER update_marketing_campaigns_updated_at
BEFORE UPDATE ON public.marketing_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
