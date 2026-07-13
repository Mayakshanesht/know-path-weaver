-- Run the article generator once a day.
--
-- pg_cron rather than an external scheduler, so the schedule lives with the
-- database it feeds and survives a redeploy of the frontend.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_daily_articles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'articles_webhook_url';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'enrollment_webhook_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE LOG 'trigger_daily_articles: not configured, skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := '{}'::jsonb,
    -- Research plus writing is two model calls with web search in between; the
    -- default 5s timeout would abort it mid-run.
    timeout_milliseconds := 240000
  );
END;
$$;

-- 06:00 UTC daily: the article is on the page before the working day starts in
-- India and Europe, the two regions the courses are priced for.
SELECT cron.unschedule('daily-articles')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-articles');

SELECT cron.schedule(
  'daily-articles',
  '0 6 * * *',
  $$SELECT public.trigger_daily_articles()$$
);

-- ---------------------------------------------------------------------------
-- One-time setup:
--   select vault.create_secret(
--     'https://<PROJECT_REF>.supabase.co/functions/v1/generate-articles',
--     'articles_webhook_url');
-- ---------------------------------------------------------------------------
