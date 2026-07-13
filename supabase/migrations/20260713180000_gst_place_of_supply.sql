-- Split GST into CGST/SGST or IGST, which is what a valid tax invoice must show.
--
-- The seller is registered in Maharashtra (27). Under GST that means:
--
--   buyer in Maharashtra  -> intra-state -> CGST 9% + SGST 9%
--   buyer in another state -> inter-state -> IGST 18%
--   buyer outside India    -> export of services
--
-- The invoice previously printed one "GST @ 18%" line, and the enrolment form never asked
-- the buyer which state they were in, so the split could not be computed at all. For an
-- online course (an OIDAR service) supplied to an unregistered person, the place of supply
-- IS the recipient's location — so it has to be captured at the point of sale, which is the
-- only moment anyone knows it.
--
-- Existing invoices are backfilled as IGST, because their buyer state was never recorded and
-- IGST is the treatment that does not under-collect. Re-issue any that turn out to be
-- Maharashtra sales.

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS billing_state text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS place_of_supply text,
  ADD COLUMN IF NOT EXISTS cgst_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS sgst_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS igst_amount numeric(12,2);

-- to_char(9.00,'FM990.99') renders as '9.' — a trailing dot that ends up printed on the
-- invoice as "CGST 9.%". Strip it.
CREATE OR REPLACE FUNCTION public.fmt_rate(r numeric) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT rtrim(rtrim(to_char(r, 'FM990.99'), '0'), '.');
$$;

-- ---------------------------------------------------------------------------
-- Carry the buyer's state onto the invoice when it is issued.
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
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE enrollment_id = NEW.id) THEN RETURN NEW; END IF;

  SELECT * INTO v_course FROM public.courses WHERE id = NEW.course_id;

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

-- ---------------------------------------------------------------------------
-- Compute the tax breakdown, splitting by place of supply.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_invoice_tax()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s          public.billing_settings%ROWTYPE;
  v_rate     numeric(5,2);
  v_intra    boolean;
BEGIN
  SELECT * INTO s FROM public.billing_settings WHERE id;

  IF NEW.region = 'india' THEN
    v_rate := COALESCE(s.india_gst_rate, 18.00);

    -- Intra-state only when the buyer is in the same state the seller is registered in.
    -- An unknown state is treated as inter-state (IGST), which never under-collects.
    v_intra := NEW.place_of_supply IS NOT NULL
               AND lower(trim(NEW.place_of_supply)) = lower(trim(COALESCE(split_part(s.place_of_supply, ' (', 1), '')));

    NEW.tax_rate := v_rate;
    NEW.base_amount := ROUND(NEW.amount / (1 + v_rate / 100), 2);
    NEW.tax_amount  := ROUND(NEW.amount - NEW.base_amount, 2);

    IF v_intra THEN
      NEW.cgst_amount := ROUND(NEW.tax_amount / 2, 2);
      NEW.sgst_amount := NEW.tax_amount - ROUND(NEW.tax_amount / 2, 2);
      NEW.igst_amount := 0;
      NEW.tax_label := 'CGST ' || public.fmt_rate(v_rate/2) || '% + SGST '
                       || public.fmt_rate(v_rate/2) || '% (included)';
    ELSE
      NEW.cgst_amount := 0;
      NEW.sgst_amount := 0;
      NEW.igst_amount := NEW.tax_amount;
      NEW.tax_label := 'IGST @ ' || public.fmt_rate(v_rate) || '% (included)';
    END IF;
  ELSE
    v_rate := COALESCE(s.export_gst_rate, 0.00);
    NEW.tax_rate    := v_rate;
    NEW.base_amount := ROUND(NEW.amount / (1 + v_rate / 100), 2);
    NEW.tax_amount  := ROUND(NEW.amount - NEW.base_amount, 2);
    NEW.cgst_amount := 0;
    NEW.sgst_amount := 0;
    NEW.igst_amount := NEW.tax_amount;
    NEW.tax_label := CASE
      WHEN v_rate = 0 THEN 'Export of services — zero-rated (LUT)'
      ELSE 'IGST @ ' || public.fmt_rate(v_rate) || '% (included)'
    END;
  END IF;

  NEW.seller_gstin := s.gstin;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_invoice_tax ON public.invoices;
CREATE TRIGGER trg_apply_invoice_tax
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.apply_invoice_tax();

-- Backfill: existing invoices never recorded a buyer state, so treat the domestic ones as
-- inter-state (IGST). That is the treatment that cannot under-collect.
UPDATE public.invoices
SET cgst_amount = 0,
    sgst_amount = 0,
    igst_amount = tax_amount,
    tax_label   = CASE WHEN region = 'india'
                       THEN 'IGST @ 18% (included)'
                       ELSE 'Export of services — zero-rated (LUT)' END
WHERE igst_amount IS NULL;
