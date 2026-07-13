-- Email the admin whenever a user applies for a course.
--
-- Fires from the database rather than the browser so the notification cannot be
-- skipped by a client that simply never calls the function, and cannot be forged
-- by one that posts a made-up enrollment.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_admin_new_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  -- Read config from Vault. See the setup notes at the bottom of this file.
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'enrollment_webhook_url';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'enrollment_webhook_secret';

  -- Not configured yet: let the enrollment through regardless. A missing email is
  -- an annoyance; a failed enrollment because email is misconfigured is a lost sale.
  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE LOG 'notify_admin_new_enrollment: webhook not configured, skipping';
    RETURN NEW;
  END IF;

  -- net.http_post queues the request and returns immediately, so a slow or down
  -- SMTP server never holds the user's enrollment INSERT open.
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'enrollments',
      'record', to_jsonb(NEW)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_enrollment_created ON public.enrollments;

CREATE TRIGGER on_enrollment_created
AFTER INSERT ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_new_enrollment();

-- ---------------------------------------------------------------------------
-- One-time setup (run once in the Supabase SQL editor, with real values):
--
--   select vault.create_secret(
--     'https://<PROJECT_REF>.supabase.co/functions/v1/notify-admin-enrollment',
--     'enrollment_webhook_url'
--   );
--
--   select vault.create_secret('<a long random string>', 'enrollment_webhook_secret');
--
-- The same random string must be set as the WEBHOOK_SECRET function secret:
--
--   supabase secrets set WEBHOOK_SECRET='<the same long random string>'
-- ---------------------------------------------------------------------------
