-- Invoicing.
--
-- One invoice per enrollment, issued when an admin approves the payment. Numbers
-- are allocated per calendar month and gapless, because tax authorities treat a
-- missing invoice number as a missing sale. PDFs live in a month-partitioned path
-- (invoices/2026/07/...) so a year-end export is a prefix listing, not a scan.

-- ---------------------------------------------------------------------------
-- Where the buyer was, which is what decides both price and tax treatment.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.billing_region AS ENUM ('india', 'international');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS billing_country text,           -- ISO 3166-1 alpha-2
  ADD COLUMN IF NOT EXISTS billing_region  public.billing_region;

COMMENT ON COLUMN public.enrollments.billing_country IS
  'ISO 3166-1 alpha-2 country the learner declared at checkout.';

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  enrollment_id  uuid NOT NULL UNIQUE REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id      uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,

  amount         numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency       text NOT NULL CHECK (currency IN ('INR', 'EUR')),
  region         public.billing_region NOT NULL,
  billing_country text,

  -- Denormalised so a reissued PDF always matches the original, even if the
  -- course is later renamed or repriced.
  course_title   text NOT NULL,
  buyer_name     text,
  buyer_email    text,

  period_year    integer NOT NULL,
  period_month   integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  storage_path   text,

  issued_at      timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_user_idx   ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS invoices_period_idx ON public.invoices(period_year, period_month);
CREATE INDEX IF NOT EXISTS invoices_region_idx ON public.invoices(region);

-- ---------------------------------------------------------------------------
-- Gapless per-month numbering: KG-202607-0001
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  period      text PRIMARY KEY,          -- 'YYYYMM'
  last_number integer NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
-- No policy: only SECURITY DEFINER functions may touch this.

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_year int, p_month int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text := to_char(make_date(p_year, p_month, 1), 'YYYYMM');
  v_next   integer;
BEGIN
  -- ON CONFLICT ... RETURNING serialises concurrent callers on the row lock, so
  -- two simultaneous approvals cannot be handed the same number.
  INSERT INTO public.invoice_counters (period, last_number)
  VALUES (v_period, 1)
  ON CONFLICT (period) DO UPDATE
    SET last_number = public.invoice_counters.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN 'KG-' || v_period || '-' || lpad(v_next::text, 4, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- Issue the invoice the moment an admin approves the enrollment.
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
  v_year        integer := extract(year  FROM now())::int;
  v_month       integer := extract(month FROM now())::int;
  v_number      text;
  v_name        text;
  v_email       text;
  v_invoice_id  uuid;
  v_url         text;
  v_secret      text;
BEGIN
  -- Only on the pending -> approved transition, and never twice.
  IF NEW.status <> 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.invoices WHERE enrollment_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_course FROM public.courses WHERE id = NEW.course_id;

  v_region := COALESCE(NEW.billing_region, 'international');

  IF v_region = 'india' THEN
    v_amount   := COALESCE(v_course.price_india, 0);
    v_currency := 'INR';
  ELSE
    v_amount   := COALESCE(v_course.price_international, 0);
    v_currency := 'EUR';
  END IF;

  SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.user_id = NEW.user_id;
  SELECT u.email     INTO v_email FROM auth.users u    WHERE u.id      = NEW.user_id;

  v_number := public.next_invoice_number(v_year, v_month);

  INSERT INTO public.invoices (
    invoice_number, enrollment_id, user_id, course_id,
    amount, currency, region, billing_country,
    course_title, buyer_name, buyer_email,
    period_year, period_month
  ) VALUES (
    v_number, NEW.id, NEW.user_id, NEW.course_id,
    v_amount, v_currency, v_region, NEW.billing_country,
    v_course.title, v_name, v_email,
    v_year, v_month
  )
  RETURNING id INTO v_invoice_id;

  -- Ask the edge function to render and store the PDF. Queued via pg_net, so a
  -- slow render never holds the admin's approval open.
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
    -- The invoice row still exists and is numbered; only the PDF is missing, and
    -- it can be re-rendered later. Approval must not fail over a render.
    RAISE LOG 'issue_invoice_on_approval: invoice webhook not configured for %', v_number;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_enrollment_approved ON public.enrollments;

CREATE TRIGGER on_enrollment_approved
AFTER UPDATE OF status ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.issue_invoice_on_approval();

-- ---------------------------------------------------------------------------
-- RLS: a learner sees only their own invoices; admins see everything.
-- Nobody writes invoices from the client -- only the trigger and edge function do.
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
CREATE POLICY "Users can view their own invoices"
ON public.invoices FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
CREATE POLICY "Admins can manage invoices"
ON public.invoices FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- Private bucket. Downloads go through a signed URL from the edge function, so
-- an invoice is never guessable by path.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins can read all invoice files" ON storage.objects;
CREATE POLICY "Admins can read all invoice files"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoices' AND has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- Monthly tax summary, split by region.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.invoice_monthly_summary AS
SELECT
  period_year,
  period_month,
  region,
  currency,
  count(*)     AS invoice_count,
  sum(amount)  AS total_amount
FROM public.invoices
GROUP BY period_year, period_month, region, currency;

-- ---------------------------------------------------------------------------
-- One-time setup:
--   select vault.create_secret(
--     'https://<PROJECT_REF>.supabase.co/functions/v1/generate-invoice',
--     'invoice_webhook_url');
-- ---------------------------------------------------------------------------
