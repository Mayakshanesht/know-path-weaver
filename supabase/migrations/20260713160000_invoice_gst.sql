-- GST on invoices.
--
-- The listed price is the TOTAL the student pays (₹14,999 stays ₹14,999 — the QR amount and
-- the marketing do not change). The invoice back-computes the breakdown from it:
--
--     base  = total / 1.18
--     GST   = total - base
--     total = the listed price, unchanged
--
-- Domestic sales (billing_region = 'india') carry 18% GST. Online course content is an OIDAR
-- service and 18% is the standard rate.
--
-- International sales are recorded at 0% and labelled as an export of services. Under Indian
-- GST an export of services is zero-rated when supplied against a LUT/bond. THIS ASSUMES A
-- LUT IS ON FILE. If it is not, exports attract 18% IGST instead and this rate must change --
-- it is one UPDATE on the tax_rate default and a re-run of the backfill. Confirm with the
-- accountant; nothing else in the schema needs to move.
--
-- The GSTIN is stored in a settings row rather than hard-coded, so it can be corrected
-- without a migration, and so an invoice never silently goes out with a stale one.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS base_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS tax_rate    numeric(5,2),
  ADD COLUMN IF NOT EXISTS tax_amount  numeric(12,2),
  ADD COLUMN IF NOT EXISTS tax_label   text,
  ADD COLUMN IF NOT EXISTS seller_gstin text;

-- Seller details, editable without a deploy.
CREATE TABLE IF NOT EXISTS public.billing_settings (
  id           boolean PRIMARY KEY DEFAULT true CHECK (id),
  gstin        text,
  legal_name   text NOT NULL DEFAULT 'KnowGraph',
  address      text,
  place_of_supply text,
  india_gst_rate numeric(5,2) NOT NULL DEFAULT 18.00,
  export_gst_rate numeric(5,2) NOT NULL DEFAULT 0.00,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.billing_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Billing settings readable by authenticated" ON public.billing_settings;
CREATE POLICY "Billing settings readable by authenticated"
  ON public.billing_settings FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Only admins change billing settings" ON public.billing_settings;
CREATE POLICY "Only admins change billing settings"
  ON public.billing_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- Compute the tax breakdown whenever an invoice is issued.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_invoice_tax()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s        public.billing_settings%ROWTYPE;
  v_rate   numeric(5,2);
BEGIN
  SELECT * INTO s FROM public.billing_settings WHERE id;

  IF NEW.region = 'india' THEN
    v_rate := COALESCE(s.india_gst_rate, 18.00);
    NEW.tax_label := 'GST @ ' || trim(to_char(v_rate, 'FM990.99')) || '% (included)';
  ELSE
    v_rate := COALESCE(s.export_gst_rate, 0.00);
    NEW.tax_label := CASE
      WHEN v_rate = 0 THEN 'Export of services — zero-rated (LUT)'
      ELSE 'IGST @ ' || trim(to_char(v_rate, 'FM990.99')) || '% (included)'
    END;
  END IF;

  -- The listed price is the total the buyer pays. Work backwards from it.
  NEW.tax_rate    := v_rate;
  NEW.base_amount := ROUND(NEW.amount / (1 + v_rate / 100), 2);
  NEW.tax_amount  := ROUND(NEW.amount - NEW.base_amount, 2);
  NEW.seller_gstin := s.gstin;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_invoice_tax ON public.invoices;

CREATE TRIGGER trg_apply_invoice_tax
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.apply_invoice_tax();

-- Backfill the invoices that already exist, using the same arithmetic.
UPDATE public.invoices i
SET base_amount = ROUND(i.amount / (1 + r.rate / 100), 2),
    tax_amount  = ROUND(i.amount - ROUND(i.amount / (1 + r.rate / 100), 2), 2),
    tax_rate    = r.rate,
    tax_label   = r.label,
    seller_gstin = (SELECT gstin FROM public.billing_settings WHERE id)
FROM (
  SELECT id,
         CASE WHEN region = 'india'
              THEN (SELECT india_gst_rate  FROM public.billing_settings WHERE id)
              ELSE (SELECT export_gst_rate FROM public.billing_settings WHERE id)
         END AS rate,
         CASE WHEN region = 'india'
              THEN 'GST @ 18% (included)'
              ELSE 'Export of services — zero-rated (LUT)'
         END AS label
  FROM public.invoices
) r
WHERE i.id = r.id AND i.base_amount IS NULL;
