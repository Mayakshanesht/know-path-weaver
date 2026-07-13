-- Separate ACCESS from MONEY.
--
-- The receipt OCR may now grant a learner access straight away, so nobody who has genuinely
-- paid sits locked out waiting for an admin. But a screenshot is not proof of payment — it
-- takes minutes to fake one — so the OCR must NOT be allowed to issue an invoice.
--
-- Wrongly granting access costs a course, and can be revoked.
-- Wrongly issuing a GST invoice creates a tax document for a sale that never happened, and
-- that is not something you can quietly take back.
--
-- So:
--   status = 'approved'      -> the learner can open the course (OCR may set this)
--   payment_confirmed = true -> an admin has seen the money on the bank statement
--
-- The invoice trigger now fires on payment_confirmed, NOT on status. Access is optimistic;
-- revenue is not.

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS payment_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz;

-- Everything that already exists was approved by a human against a real payment, and its
-- invoice has already been issued. Mark it confirmed so nothing re-fires or looks unreconciled.
UPDATE public.enrollments
SET payment_confirmed = true,
    payment_confirmed_at = COALESCE(approved_at, enrolled_at)
WHERE status = 'approved' AND payment_confirmed = false;

-- ---------------------------------------------------------------------------
-- The invoice now follows the money, not the access.
-- ---------------------------------------------------------------------------
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
  -- Only when the money is confirmed. An OCR-granted enrolment sits here, with access, and
  -- no invoice, until a human has seen the payment on the statement.
  IF NEW.payment_confirmed IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.payment_confirmed IS TRUE THEN RETURN NEW; END IF;
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE enrollment_id = NEW.id) THEN RETURN NEW; END IF;

  SELECT * INTO v_course FROM public.courses WHERE id = NEW.course_id;

  v_issued := COALESCE(NEW.payment_confirmed_at, NEW.approved_at, NEW.enrolled_at, now());
  v_year   := extract(year  FROM v_issued)::int;
  v_month  := extract(month FROM v_issued)::int;

  v_region := COALESCE(NEW.billing_region, 'international');

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

DROP TRIGGER IF EXISTS on_enrollment_approved ON public.enrollments;

CREATE TRIGGER on_enrollment_approved
AFTER INSERT OR UPDATE OF status, payment_confirmed ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.issue_invoice_on_approval();

-- A learner may still only ever create a PENDING enrolment, and may never confirm their own
-- payment. Auto-approval happens server-side, with the service role, never from the browser.
DROP POLICY IF EXISTS "Users can create own enrollments" ON public.enrollments;
CREATE POLICY "Users can create own enrollments"
ON public.enrollments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'::enrollment_status
  AND payment_confirmed = false
  AND auto_approved = false
);

-- What still needs reconciling against the bank: access granted, money not yet seen.
CREATE OR REPLACE VIEW public.unreconciled_enrollments AS
SELECT e.*, c.title AS course_title
FROM public.enrollments e
JOIN public.courses c ON c.id = e.course_id
WHERE e.status = 'approved' AND e.payment_confirmed = false;
