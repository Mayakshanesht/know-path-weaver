-- Two fixes to invoice issuing, both exposed by the V1 -> V2 migration.
--
-- 1. The trigger fired only on UPDATE OF status. A returning V1 learner is INSERTED already
--    approved -- they paid on the old platform, and making them wait for an admin to
--    re-approve a course they have been studying for months would be the worst possible
--    first impression of the new platform. No UPDATE ever happened, so they got no invoice.
--
-- 2. The invoice was stamped with now(). For a migrating learner who paid in March, that
--    files the sale under July. period_year/period_month drive the monthly directories and
--    the tax return, so they must follow the date the money actually arrived (approved_at),
--    not the date the row happened to be copied across.
--
-- Everything else is preserved exactly as it was: the next_invoice_number() helper, the
-- buyer name from profiles.user_id, the buyer email from auth.users (profiles has no email
-- column -- an earlier attempt at this assumed it did and broke every enrolment insert),
-- and the pg_net webhook that renders the PDF without holding the approval open.

CREATE OR REPLACE FUNCTION public.issue_invoice_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_course      public.courses%ROWTYPE;
  v_region      public.billing_region;
  v_amount      numeric(12,2);
  v_currency    text;
  v_issued      timestamptz;
  v_year        integer;
  v_month       integer;
  v_number      text;
  v_name        text;
  v_email       text;
  v_invoice_id  uuid;
  v_url         text;
  v_secret      text;
BEGIN
  -- Fires when the row ARRIVES approved (a migrated V1 learner) or MOVES to approved (a new
  -- student an admin has just approved). Never twice for the same enrolment.
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE enrollment_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_course FROM public.courses WHERE id = NEW.course_id;

  -- The date the money actually arrived, not the date this row was written.
  v_issued := COALESCE(NEW.approved_at, NEW.enrolled_at, now());
  v_year   := extract(year  FROM v_issued)::int;
  v_month  := extract(month FROM v_issued)::int;

  v_region := COALESCE(NEW.billing_region, 'international');

  IF v_region = 'india' THEN
    v_amount   := COALESCE(v_course.price_india, 0);
    v_currency := 'INR';
  ELSE
    v_amount   := COALESCE(v_course.price_international, 0);
    v_currency := 'EUR';
  END IF;

  SELECT p.full_name INTO v_name  FROM public.profiles p WHERE p.user_id = NEW.user_id;
  SELECT u.email     INTO v_email FROM auth.users u      WHERE u.id      = NEW.user_id;

  v_number := public.next_invoice_number(v_year, v_month);

  INSERT INTO public.invoices (
    invoice_number, enrollment_id, user_id, course_id,
    amount, currency, region, billing_country,
    course_title, buyer_name, buyer_email,
    period_year, period_month, issued_at
  ) VALUES (
    v_number, NEW.id, NEW.user_id, NEW.course_id,
    v_amount, v_currency, v_region, NEW.billing_country,
    v_course.title, v_name, v_email,
    v_year, v_month, v_issued
  )
  RETURNING id INTO v_invoice_id;

  -- Ask the edge function to render and store the PDF. Queued via pg_net, so a slow render
  -- never holds the admin's approval open.
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'invoice_webhook_url';
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'enrollment_webhook_secret';

  IF v_url IS NOT NULL AND v_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type',     'application/json',
        'x-webhook-secret', v_secret
      ),
      body    := jsonb_build_object('invoice_id', v_invoice_id)
    );
  ELSE
    -- The invoice row still exists and is numbered; only the PDF is missing, and it can be
    -- re-rendered later (api/invoice-download.ts renders lazily on first download anyway).
    -- Approval must never fail over a render.
    RAISE LOG 'issue_invoice_on_approval: invoice webhook not configured for %', v_number;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_enrollment_approved ON public.enrollments;

CREATE TRIGGER on_enrollment_approved
AFTER INSERT OR UPDATE OF status ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.issue_invoice_on_approval();
