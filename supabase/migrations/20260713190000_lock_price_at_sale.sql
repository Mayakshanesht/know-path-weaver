-- Record what the buyer was actually charged, at the moment they paid.
--
-- The invoice trigger read courses.price_india at APPROVAL time. So if a price changed
-- between a learner paying and an admin approving them, they were invoiced the new price for
-- a payment they made at the old one. That is not hypothetical: AI Bootcamp went from
-- ₹9,999 to ₹14,999, and any pending enrolment would have been invoiced ₹5,000 too high.
--
-- The price shown on the course page at the moment of enrolment is the price agreed. It is
-- captured on the enrolment row and the invoice uses it, falling back to the course price
-- only for older rows that never recorded one.

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2),
  ADD COLUMN IF NOT EXISTS currency text,
  -- The code the buyer is asked to put in the UPI/transfer note. courses.payment_reference_code
  -- already existed but is per-COURSE ("ADAS_COURSE_2026"), so every ADAS buyer sends the same
  -- string and it identifies the course, not the person. This one is per buyer per course, so
  -- a line on the bank statement can be matched to exactly one enrolment.
  ADD COLUMN IF NOT EXISTS payment_code text;

CREATE INDEX IF NOT EXISTS enrollments_payment_code_idx ON public.enrollments (payment_code);

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
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE enrollment_id = NEW.id) THEN RETURN NEW; END IF;

  SELECT * INTO v_course FROM public.courses WHERE id = NEW.course_id;

  v_issued := COALESCE(NEW.approved_at, NEW.enrolled_at, now());
  v_year   := extract(year  FROM v_issued)::int;
  v_month  := extract(month FROM v_issued)::int;

  v_region := COALESCE(NEW.billing_region, 'international');

  -- What they were actually charged wins over what the course costs today.
  IF NEW.amount_paid IS NOT NULL THEN
    v_amount   := NEW.amount_paid;
    v_currency := COALESCE(NEW.currency, CASE WHEN v_region = 'india' THEN 'INR' ELSE 'EUR' END);
  ELSIF v_region = 'india' THEN
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
    amount, currency, region, billing_country, place_of_supply,
    course_title, buyer_name, buyer_email,
    period_year, period_month, issued_at
  ) VALUES (
    v_number, NEW.id, NEW.user_id, NEW.course_id,
    v_amount, v_currency, v_region, NEW.billing_country, NEW.billing_state,
    v_course.title, v_name, v_email,
    v_year, v_month, v_issued
  )
  RETURNING id INTO v_invoice_id;

  SELECT decrypted_secret INTO v_url    FROM vault.decrypted_secrets WHERE name = 'invoice_webhook_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'enrollment_webhook_secret';

  IF v_url IS NOT NULL AND v_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', v_secret),
      body    := jsonb_build_object('invoice_id', v_invoice_id)
    );
  ELSE
    RAISE LOG 'issue_invoice_on_approval: invoice webhook not configured for %', v_number;
  END IF;

  RETURN NEW;
END;
$$;
