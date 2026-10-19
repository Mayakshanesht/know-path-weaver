-- Sponsored access is an entitlement, never evidence that money was collected.
-- Codes count people, not courses. Attribution and receipt values are snapshots.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.sponsorship_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^AB27-[A-F0-9]{32}$'),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 160),
  campaign text NOT NULL DEFAULT 'SAEINDIA 2027 aBAJA' CHECK (length(trim(campaign)) BETWEEN 1 AND 160),
  audience text NOT NULL CHECK (audience IN ('team', 'committee', 'individual', 'general')),
  team_name text CHECK (team_name IS NULL OR length(team_name) <= 160),
  max_redemptions integer NOT NULL CHECK (max_redemptions BETWEEN 1 AND 5000),
  allowed_emails text[],
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  creation_request_id uuid UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (audience <> 'team' OR (team_name IS NOT NULL AND length(trim(team_name)) > 0 AND max_redemptions BETWEEN 5 AND 35)),
  CHECK (audience <> 'individual' OR (max_redemptions = 1 AND allowed_emails IS NOT NULL AND cardinality(allowed_emails) = 1)),
  CHECK (allowed_emails IS NULL OR cardinality(allowed_emails) BETWEEN 1 AND max_redemptions)
);

CREATE TABLE public.sponsorship_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.sponsorship_codes(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  college text NOT NULL,
  -- Keep the original invitation identity even if a future administration tool
  -- changes a code's presentation or the learner changes their profile/email.
  coupon_code text NOT NULL,
  code_label text NOT NULL,
  campaign text NOT NULL,
  audience text NOT NULL,
  team_name text,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id),
  UNIQUE (user_id, campaign)
);
CREATE INDEX sponsorship_redemptions_user_idx ON public.sponsorship_redemptions(user_id);
CREATE INDEX sponsorship_redemptions_code_idx ON public.sponsorship_redemptions(code_id);

ALTER TABLE public.sponsorship_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read sponsorship codes" ON public.sponsorship_codes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Learners can read own sponsorship redemptions" ON public.sponsorship_redemptions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
-- All writes go through the checked RPCs, including admin writes. A browser
-- cannot raise a cap, edit attribution, or manufacture a redemption directly.
REVOKE ALL ON public.sponsorship_codes, public.sponsorship_redemptions FROM anon, authenticated;
GRANT SELECT ON public.sponsorship_codes, public.sponsorship_redemptions TO authenticated;

ALTER TABLE public.enrollments
  ADD COLUMN access_source text NOT NULL DEFAULT 'payment' CHECK (access_source IN ('payment', 'sponsorship')),
  ADD COLUMN sponsorship_redemption_id uuid REFERENCES public.sponsorship_redemptions(id),
  ADD COLUMN sponsorship_prior_checkout jsonb,
  ADD CONSTRAINT enrollment_sponsorship_consistent CHECK (
    (access_source = 'payment' AND sponsorship_redemption_id IS NULL AND sponsorship_prior_checkout IS NULL)
    OR (access_source = 'sponsorship' AND sponsorship_redemption_id IS NOT NULL
        AND amount_paid IS NOT NULL AND amount_paid = 0 AND currency IS NOT NULL AND currency = 'INR' AND payment_confirmed = false
        AND payment_confirmed_at IS NULL AND auto_approved = false)
  );
CREATE INDEX enrollments_sponsorship_idx ON public.enrollments(sponsorship_redemption_id)
  WHERE sponsorship_redemption_id IS NOT NULL;

ALTER TABLE public.invoices
  ADD COLUMN document_type text NOT NULL DEFAULT 'tax_invoice' CHECK (document_type IN ('tax_invoice', 'sponsorship_receipt')),
  ADD COLUMN list_price numeric(12,2),
  ADD COLUMN discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  ADD COLUMN coupon_code text,
  ADD COLUMN sponsorship_campaign text,
  ADD COLUMN team_name text,
  ADD COLUMN sponsorship_redemption_id uuid REFERENCES public.sponsorship_redemptions(id);
UPDATE public.invoices SET list_price = amount WHERE list_price IS NULL;
ALTER TABLE public.invoices ADD CONSTRAINT invoice_sponsorship_consistent CHECK (
  document_type <> 'sponsorship_receipt'
  OR (amount = 0 AND list_price IS NOT NULL AND list_price >= 0
      AND discount_amount = list_price AND coupon_code IS NOT NULL
      AND sponsorship_campaign IS NOT NULL AND sponsorship_redemption_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION public.admin_create_sponsorship_code(
  p_label text, p_campaign text, p_audience text, p_team_name text,
  p_max_redemptions integer, p_allowed_emails text[], p_expires_at timestamptz,
  p_request_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_row public.sponsorship_codes%ROWTYPE;
  v_emails text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can create sponsorship codes' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 270027));
    SELECT * INTO v_row FROM public.sponsorship_codes WHERE creation_request_id = p_request_id;
    IF FOUND THEN
      IF v_row.created_by <> auth.uid() THEN RAISE EXCEPTION 'This creation request belongs to another administrator'; END IF;
      RETURN to_jsonb(v_row);
    END IF;
  END IF;
  IF p_label IS NULL OR length(trim(p_label)) NOT BETWEEN 1 AND 160
     OR p_campaign IS NULL OR length(trim(p_campaign)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Provide a label and campaign (up to 160 characters each)';
  END IF;
  IF p_audience IS NULL OR p_audience NOT IN ('team', 'committee', 'individual', 'general') THEN
    RAISE EXCEPTION 'Choose a valid sponsorship audience';
  END IF;
  IF p_max_redemptions IS NULL OR p_max_redemptions NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'Seat limit must be between 1 and 5000';
  END IF;
  IF p_audience = 'team' AND (NULLIF(trim(p_team_name), '') IS NULL OR p_max_redemptions NOT BETWEEN 5 AND 35) THEN
    RAISE EXCEPTION 'Team codes require a team name and 5 to 35 seats';
  END IF;
  IF p_audience = 'individual' AND p_max_redemptions <> 1 THEN
    RAISE EXCEPTION 'An individual invitation must have exactly one seat';
  END IF;
  IF p_team_name IS NOT NULL AND length(trim(p_team_name)) > 160 THEN
    RAISE EXCEPTION 'Team name must be at most 160 characters';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'The redemption deadline must be in the future';
  END IF;
  IF p_allowed_emails IS NOT NULL THEN
    IF cardinality(p_allowed_emails) = 0 OR EXISTS (
      SELECT 1 FROM unnest(p_allowed_emails) email
      WHERE email IS NULL OR length(trim(email)) > 254 OR trim(email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ) THEN RAISE EXCEPTION 'Enter valid email addresses for the invitation roster'; END IF;
    SELECT array_agg(email ORDER BY email) INTO v_emails
      FROM (SELECT DISTINCT lower(trim(email)) email FROM unnest(p_allowed_emails) email) normalized;
  END IF;
  IF p_audience = 'individual' AND (v_emails IS NULL OR cardinality(v_emails) <> 1) THEN
    RAISE EXCEPTION 'An individual invitation requires exactly one invited email address';
  END IF;
  IF cardinality(v_emails) > p_max_redemptions THEN
    RAISE EXCEPTION 'The invitation roster has more email addresses than the seat limit';
  END IF;
  INSERT INTO public.sponsorship_codes (code, label, campaign, audience, team_name, max_redemptions, allowed_emails, expires_at, created_by, creation_request_id)
  VALUES ('AB27-' || upper(encode(gen_random_bytes(16), 'hex')), trim(p_label), trim(p_campaign),
          p_audience, NULLIF(trim(p_team_name), ''), p_max_redemptions, v_emails, p_expires_at, auth.uid(), p_request_id)
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_sponsorship_code_active(p_code_id uuid, p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can manage sponsorship codes' USING ERRCODE = '42501';
  END IF;
  IF p_active IS NULL THEN RAISE EXCEPTION 'Provide the active state'; END IF;
  UPDATE public.sponsorship_codes SET active = p_active WHERE id = p_code_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sponsorship code not found'; END IF;
END;
$$;

-- Called only by the entitlement RPC/trigger. Converting a pending checkout
-- preserves its original values and uploaded evidence for later reconciliation.
CREATE OR REPLACE FUNCTION public.grant_sponsored_course(p_redemption_id uuid, p_course_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_redemption public.sponsorship_redemptions%ROWTYPE;
  v_rows integer;
BEGIN
  SELECT * INTO STRICT v_redemption FROM public.sponsorship_redemptions WHERE id = p_redemption_id;
  INSERT INTO public.enrollments (user_id, course_id, status, approved_at, amount_paid, currency,
    payment_confirmed, auto_approved, billing_region, access_source, sponsorship_redemption_id)
  VALUES (v_redemption.user_id, p_course_id, 'approved', now(), 0, 'INR', false, false,
    'india', 'sponsorship', v_redemption.id)
  ON CONFLICT (user_id, course_id) DO UPDATE SET
    sponsorship_prior_checkout = jsonb_build_object('amount_paid', enrollments.amount_paid,
      'currency', enrollments.currency, 'status', enrollments.status, 'payment_code', enrollments.payment_code,
      'billing_region', enrollments.billing_region, 'billing_country', enrollments.billing_country,
      'billing_state', enrollments.billing_state, 'auto_approved', enrollments.auto_approved),
    status = 'approved', approved_at = now(), amount_paid = 0, currency = 'INR',
    payment_confirmed = false, payment_confirmed_at = NULL, auto_approved = false,
    billing_region = 'india', access_source = 'sponsorship', sponsorship_redemption_id = v_redemption.id
  WHERE enrollments.payment_confirmed = false
    AND enrollments.access_source = 'payment'
    AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.enrollment_id = enrollments.id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_sponsorship_code(p_code text, p_full_name text, p_college text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_code public.sponsorship_codes%ROWTYPE;
  v_redemption public.sponsorship_redemptions%ROWTYPE;
  v_course uuid;
  v_enrolled integer := 0;
  v_already boolean := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in and verify your email before redeeming your code' USING ERRCODE = '42501'; END IF;
  SELECT lower(u.email) INTO v_email FROM auth.users u
  WHERE u.id = v_user AND u.email_confirmed_at IS NOT NULL
    AND NULLIF(trim(u.email), '') IS NOT NULL;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Verify your email address or continue with Google before claiming sponsored access' USING ERRCODE = '42501';
  END IF;
  -- Serialise redemptions with course publication, preventing a concurrent
  -- publication/claim from missing each other's newly committed entitlement.
  PERFORM pg_advisory_xact_lock(270027, 2027);
  SELECT * INTO v_code FROM public.sponsorship_codes WHERE code = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This sponsorship code is not valid. Check it with your team captain or KnowGraph.'; END IF;
  SELECT * INTO v_redemption FROM public.sponsorship_redemptions WHERE code_id = v_code.id AND user_id = v_user;
  IF FOUND THEN
    v_already := true;
  ELSE
    IF EXISTS (SELECT 1 FROM public.sponsorship_redemptions WHERE user_id = v_user AND campaign = v_code.campaign) THEN
      RAISE EXCEPTION 'You already have sponsored access for this programme. Use your original code or contact KnowGraph to change your team.';
    END IF;
    IF NOT v_code.active THEN RAISE EXCEPTION 'This sponsorship code is paused. Contact your team captain or KnowGraph.'; END IF;
    IF v_code.expires_at IS NOT NULL AND v_code.expires_at <= now() THEN
      RAISE EXCEPTION 'The redemption deadline for this sponsorship code has passed';
    END IF;
    IF v_code.allowed_emails IS NOT NULL AND NOT (v_email = ANY(v_code.allowed_emails)) THEN
      RAISE EXCEPTION 'This email is not on the invitation roster. Ask your team captain to contact KnowGraph.' USING ERRCODE = '42501';
    END IF;
    IF (SELECT count(*) FROM public.sponsorship_redemptions WHERE code_id = v_code.id) >= v_code.max_redemptions THEN
      RAISE EXCEPTION 'All seats for this sponsorship code have been claimed. Contact your team captain or KnowGraph.';
    END IF;
    IF p_full_name IS NULL OR length(trim(p_full_name)) NOT BETWEEN 2 AND 160
       OR p_college IS NULL OR length(trim(p_college)) NOT BETWEEN 2 AND 200 THEN
      RAISE EXCEPTION 'Provide your full name and college or organisation';
    END IF;
    INSERT INTO public.sponsorship_redemptions (code_id, user_id, full_name, email, college,
      coupon_code, code_label, campaign, audience, team_name)
    VALUES (v_code.id, v_user, trim(p_full_name), v_email, trim(p_college),
      v_code.code, v_code.label, v_code.campaign, v_code.audience, v_code.team_name)
    RETURNING * INTO v_redemption;
  END IF;
  FOR v_course IN SELECT id FROM public.courses WHERE is_published = true ORDER BY id LOOP
    IF public.grant_sponsored_course(v_redemption.id, v_course) THEN v_enrolled := v_enrolled + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('redemption_id', v_redemption.id, 'enrolled_count', v_enrolled,
    'already_redeemed', v_already, 'campaign', v_redemption.campaign, 'team_name', v_redemption.team_name);
END;
$$;

-- A quote previews the 100% discount without consuming a seat or enrolling.
-- The final redemption repeats every check while holding the claim lock.
CREATE OR REPLACE FUNCTION public.quote_sponsorship_code(p_code text, p_course_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_code public.sponsorship_codes%ROWTYPE;
  v_course public.courses%ROWTYPE;
  v_already boolean;
  v_list_price numeric(12,2);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in and verify your email before applying your code' USING ERRCODE = '42501'; END IF;
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = v_user
    AND u.email_confirmed_at IS NOT NULL AND NULLIF(trim(u.email), '') IS NOT NULL;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Verify your email address or continue with Google before applying your code' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id AND is_published = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose an available published course'; END IF;
  SELECT * INTO v_code FROM public.sponsorship_codes WHERE code = upper(trim(p_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'This sponsorship code is not valid. Check it with your team captain or KnowGraph.'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.sponsorship_redemptions WHERE code_id = v_code.id AND user_id = v_user) INTO v_already;
  IF NOT v_already THEN
    IF EXISTS (SELECT 1 FROM public.sponsorship_redemptions WHERE user_id = v_user AND campaign = v_code.campaign) THEN
      RAISE EXCEPTION 'You already have sponsored access for this programme. Use your original code or contact KnowGraph to change your team.';
    END IF;
    IF NOT v_code.active THEN RAISE EXCEPTION 'This sponsorship code is paused. Contact your team captain or KnowGraph.'; END IF;
    IF v_code.expires_at IS NOT NULL AND v_code.expires_at <= now() THEN
      RAISE EXCEPTION 'The redemption deadline for this sponsorship code has passed';
    END IF;
    IF v_code.allowed_emails IS NOT NULL AND NOT (v_email = ANY(v_code.allowed_emails)) THEN
      RAISE EXCEPTION 'This email is not on the invitation roster. Ask your team captain to contact KnowGraph.' USING ERRCODE = '42501';
    END IF;
    IF (SELECT count(*) FROM public.sponsorship_redemptions WHERE code_id = v_code.id) >= v_code.max_redemptions THEN
      RAISE EXCEPTION 'All seats for this sponsorship code have been claimed. Contact your team captain or KnowGraph.';
    END IF;
  END IF;
  v_list_price := GREATEST(COALESCE(v_course.price_india, 0), 0);
  RETURN jsonb_build_object('course_id', v_course.id, 'title', v_course.title,
    'list_price', v_list_price, 'discount_amount', v_list_price, 'total', 0,
    'currency', 'INR', 'campaign', v_code.campaign, 'team_name', v_code.team_name,
    'already_redeemed', v_already);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_sponsors_new_course()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_redemption uuid;
BEGIN
  IF NEW.is_published IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_published IS TRUE THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(270027, 2027);
  -- A deadline/paused code stops new claims only; existing grants remain valid.
  -- Use the earliest redemption to keep the original team/invitation attribution.
  FOR v_redemption IN SELECT DISTINCT ON (user_id) id FROM public.sponsorship_redemptions
    ORDER BY user_id, redeemed_at, id LOOP
    PERFORM public.grant_sponsored_course(v_redemption, NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_course_published_grant_sponsors AFTER INSERT OR UPDATE OF is_published ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.grant_sponsors_new_course();

CREATE OR REPLACE FUNCTION public.protect_sponsorship_accounting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF ((TG_TABLE_NAME = 'enrollments' AND to_jsonb(OLD) ->> 'access_source' = 'sponsorship')
      OR (TG_TABLE_NAME = 'invoices' AND to_jsonb(OLD) ->> 'document_type' = 'sponsorship_receipt'))
      AND EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
      RAISE EXCEPTION 'Sponsored records cannot be deleted; revoke course access instead';
    END IF;
    -- Auth account erasure removes the parent user before its FK cascades run.
    RETURN OLD;
  END IF;
  IF TG_TABLE_NAME = 'enrollments' THEN
    IF OLD.access_source = 'sponsorship' AND (
      NEW.sponsorship_redemption_id IS DISTINCT FROM OLD.sponsorship_redemption_id
      OR NEW.access_source IS DISTINCT FROM OLD.access_source
      OR NEW.sponsorship_prior_checkout IS DISTINCT FROM OLD.sponsorship_prior_checkout
      OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.course_id IS DISTINCT FROM OLD.course_id
      OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid OR NEW.currency IS DISTINCT FROM OLD.currency
      OR NEW.payment_confirmed IS DISTINCT FROM OLD.payment_confirmed
      OR NEW.payment_confirmed_at IS DISTINCT FROM OLD.payment_confirmed_at
      OR NEW.billing_region IS DISTINCT FROM OLD.billing_region
      OR NEW.billing_country IS DISTINCT FROM OLD.billing_country
      OR NEW.billing_state IS DISTINCT FROM OLD.billing_state
    ) THEN RAISE EXCEPTION 'Sponsored enrollment accounting and attribution cannot be changed'; END IF;
  ELSE
    IF (OLD.document_type = 'sponsorship_receipt' OR NEW.document_type = 'sponsorship_receipt')
      AND (to_jsonb(NEW) - 'storage_path') IS DISTINCT FROM (to_jsonb(OLD) - 'storage_path') THEN
      RAISE EXCEPTION 'A sponsorship receipt is immutable; only its PDF storage path may change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_sponsored_enrollment BEFORE UPDATE OR DELETE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.protect_sponsorship_accounting();
CREATE TRIGGER protect_sponsorship_receipt BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.protect_sponsorship_accounting();

-- Never trust a learner-supplied sponsorship FK or payment confirmation.
DROP POLICY IF EXISTS "Users can create own enrollments" ON public.enrollments;
CREATE POLICY "Users can create own enrollments" ON public.enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending'::public.enrollment_status
    AND payment_confirmed = false AND auto_approved = false
    AND access_source = 'payment' AND sponsorship_redemption_id IS NULL
    AND sponsorship_prior_checkout IS NULL);

-- Sponsored access must not enter the list of payments waiting for a bank check.
DROP VIEW public.unreconciled_enrollments;
CREATE VIEW public.unreconciled_enrollments WITH (security_invoker = true) AS
SELECT e.*, c.title AS course_title FROM public.enrollments e
JOIN public.courses c ON c.id = e.course_id
WHERE e.status = 'approved' AND e.payment_confirmed = false AND e.access_source = 'payment';

-- Keep complimentary access out of paid invoice counts and tax-return exports.
CREATE OR REPLACE VIEW public.invoice_monthly_summary WITH (security_invoker = true) AS
SELECT period_year, period_month, region, currency, count(*) AS invoice_count, sum(amount) AS total_amount
FROM public.invoices WHERE document_type = 'tax_invoice'
GROUP BY period_year, period_month, region, currency;

-- Keep paid tax invoices unchanged and handle sponsored documents separately.
CREATE OR REPLACE FUNCTION public.apply_invoice_tax()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.billing_settings%ROWTYPE;
  v_rate numeric(5,2);
  v_intra boolean;
BEGIN
  SELECT * INTO s FROM public.billing_settings WHERE id;
  NEW.list_price := COALESCE(NEW.list_price, NEW.amount);
  IF NEW.document_type = 'sponsorship_receipt' THEN
    NEW.tax_rate := 0; NEW.base_amount := 0; NEW.tax_amount := 0;
    NEW.cgst_amount := 0; NEW.sgst_amount := 0; NEW.igst_amount := 0;
    NEW.tax_label := 'No payment collected - sponsored access (100% discount)';
    NEW.seller_gstin := s.gstin;
    RETURN NEW;
  END IF;
  IF NEW.region = 'india' THEN
    v_rate := COALESCE(s.india_gst_rate, 18.00);
    v_intra := NEW.place_of_supply IS NOT NULL
      AND lower(trim(NEW.place_of_supply)) = lower(trim(COALESCE(split_part(s.place_of_supply, ' (', 1), '')));
    NEW.tax_rate := v_rate;
    NEW.base_amount := ROUND(NEW.amount / (1 + v_rate / 100), 2);
    NEW.tax_amount := ROUND(NEW.amount - NEW.base_amount, 2);
    IF v_intra THEN
      NEW.cgst_amount := ROUND(NEW.tax_amount / 2, 2);
      NEW.sgst_amount := NEW.tax_amount - ROUND(NEW.tax_amount / 2, 2);
      NEW.igst_amount := 0;
      NEW.tax_label := 'CGST ' || public.fmt_rate(v_rate/2) || '% + SGST ' || public.fmt_rate(v_rate/2) || '% (included)';
    ELSE
      NEW.cgst_amount := 0; NEW.sgst_amount := 0; NEW.igst_amount := NEW.tax_amount;
      NEW.tax_label := 'IGST @ ' || public.fmt_rate(v_rate) || '% (included)';
    END IF;
  ELSE
    v_rate := COALESCE(s.export_gst_rate, 0.00);
    NEW.tax_rate := v_rate;
    NEW.base_amount := ROUND(NEW.amount / (1 + v_rate / 100), 2);
    NEW.tax_amount := ROUND(NEW.amount - NEW.base_amount, 2);
    NEW.cgst_amount := 0; NEW.sgst_amount := 0; NEW.igst_amount := NEW.tax_amount;
    NEW.tax_label := CASE WHEN v_rate = 0 THEN 'Export of services — zero-rated (LUT)'
      ELSE 'IGST @ ' || public.fmt_rate(v_rate) || '% (included)' END;
  END IF;
  NEW.seller_gstin := s.gstin;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_invoice_on_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_course public.courses%ROWTYPE;
  v_redemption public.sponsorship_redemptions%ROWTYPE;
  v_sponsored boolean := NEW.access_source = 'sponsorship';
  v_region public.billing_region;
  v_amount numeric(12,2);
  v_list_price numeric(12,2);
  v_currency text;
  v_issued timestamptz;
  v_year integer;
  v_month integer;
  v_number text;
  v_sequence integer;
  v_period text;
  v_name text;
  v_email text;
  v_invoice_id uuid;
  v_url text;
  v_secret text;
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF NOT v_sponsored THEN
    IF NEW.payment_confirmed IS NOT TRUE THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.payment_confirmed IS TRUE THEN RETURN NEW; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE enrollment_id = NEW.id) THEN RETURN NEW; END IF;
  SELECT * INTO v_course FROM public.courses WHERE id = NEW.course_id;
  v_region := COALESCE(NEW.billing_region, 'international');
  IF v_sponsored THEN
    SELECT * INTO STRICT v_redemption FROM public.sponsorship_redemptions WHERE id = NEW.sponsorship_redemption_id;
    IF v_redemption.user_id <> NEW.user_id THEN RAISE EXCEPTION 'Sponsorship belongs to another learner'; END IF;
    v_issued := COALESCE(NEW.approved_at, now());
    v_amount := 0; v_currency := 'INR';
    v_list_price := GREATEST(COALESCE(v_course.price_india, 0), 0);
    v_name := v_redemption.full_name; v_email := v_redemption.email;
  ELSE
    v_issued := COALESCE(NEW.payment_confirmed_at, NEW.approved_at, NEW.enrolled_at, now());
    IF NEW.amount_paid IS NOT NULL THEN
      v_amount := NEW.amount_paid;
      v_currency := COALESCE(NEW.currency, CASE WHEN v_region = 'india' THEN 'INR' ELSE 'EUR' END);
    ELSIF v_region = 'india' THEN v_amount := COALESCE(v_course.price_india, 0); v_currency := 'INR';
    ELSE v_amount := COALESCE(v_course.price_international, 0); v_currency := 'EUR'; END IF;
    v_list_price := v_amount;
    SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.user_id = NEW.user_id;
    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = NEW.user_id;
  END IF;
  v_year := extract(year FROM v_issued)::int; v_month := extract(month FROM v_issued)::int;
  IF v_sponsored THEN
    v_period := 'S' || to_char(v_issued, 'YYYYMM');
    INSERT INTO public.invoice_counters (period, last_number) VALUES (v_period, 1)
      ON CONFLICT (period) DO UPDATE SET last_number = public.invoice_counters.last_number + 1
      RETURNING last_number INTO v_sequence;
    v_number := 'KGS-' || substr(v_period, 2) || '-' || lpad(v_sequence::text, GREATEST(4, length(v_sequence::text)), '0');
  ELSE v_number := public.next_invoice_number(v_year, v_month); END IF;
  INSERT INTO public.invoices (invoice_number, enrollment_id, user_id, course_id,
    amount, currency, region, billing_country, place_of_supply, course_title, buyer_name, buyer_email,
    period_year, period_month, issued_at, document_type, list_price, discount_amount,
    coupon_code, sponsorship_campaign, team_name, sponsorship_redemption_id)
  VALUES (v_number, NEW.id, NEW.user_id, NEW.course_id, v_amount, v_currency, v_region,
    NEW.billing_country, NEW.billing_state, v_course.title, v_name, v_email, v_year, v_month, v_issued,
    CASE WHEN v_sponsored THEN 'sponsorship_receipt' ELSE 'tax_invoice' END, v_list_price,
    CASE WHEN v_sponsored THEN v_list_price ELSE 0 END,
    v_redemption.coupon_code, v_redemption.campaign, v_redemption.team_name, v_redemption.id)
  RETURNING id INTO v_invoice_id;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'invoice_webhook_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'enrollment_webhook_secret';
  IF v_url IS NOT NULL AND v_secret IS NOT NULL THEN
    PERFORM net.http_post(url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
      body := jsonb_build_object('invoice_id', v_invoice_id));
  END IF;
  RETURN NEW;
END;
$$;
-- Conversions of a pending checkout can be status changes; future repairs may
-- attach a sponsorship to already-approved rows. Always recheck the invariant.
DROP TRIGGER IF EXISTS on_enrollment_approved ON public.enrollments;
CREATE TRIGGER on_enrollment_approved
  AFTER INSERT OR UPDATE OF status, payment_confirmed, sponsorship_redemption_id ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.issue_invoice_on_approval();

-- Do not send the admin one "payment awaiting approval" email per free course.
CREATE OR REPLACE FUNCTION public.notify_admin_new_enrollment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_url text; v_secret text;
BEGIN
  IF NEW.access_source = 'sponsorship' THEN RETURN NEW; END IF;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'enrollment_webhook_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'enrollment_webhook_secret';
  IF v_url IS NOT NULL AND v_secret IS NOT NULL THEN
    PERFORM net.http_post(url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',v_secret),
      body := jsonb_build_object('type','INSERT','table','enrollments','record',to_jsonb(NEW)));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_sponsored_course(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_sponsors_new_course() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_sponsorship_accounting() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_create_sponsorship_code(text, text, text, text, integer, text[], timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_sponsorship_code_active(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_sponsorship_code(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quote_sponsorship_code(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_sponsorship_code(text, text, text, text, integer, text[], timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_sponsorship_code_active(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_sponsorship_code(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quote_sponsorship_code(text, uuid) TO authenticated;

-- A gateway order can have been opened before a sponsorship was claimed. A
-- later real payment must be recorded without rewriting its free-access receipt.
CREATE TABLE public.sponsorship_payment_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id),
  payment_reference text NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency IN ('INR', 'EUR')),
  source text NOT NULL,
  buyer_email text,
  course_title text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'needs_review' CHECK (status IN ('needs_review', 'resolved')),
  review_notes text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  CHECK ((status = 'needs_review' AND resolved_at IS NULL AND review_notes IS NULL)
    OR (status = 'resolved' AND resolved_at IS NOT NULL AND length(trim(review_notes)) > 0))
);
ALTER TABLE public.sponsorship_payment_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read sponsorship payment reviews" ON public.sponsorship_payment_reviews
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.sponsorship_payment_reviews FROM anon, authenticated, service_role;
GRANT SELECT ON public.sponsorship_payment_reviews TO authenticated;

CREATE OR REPLACE FUNCTION public.record_sponsorship_payment_review(
  p_user_id uuid, p_course_id uuid, p_payment_reference text,
  p_amount numeric, p_currency text, p_source text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_review public.sponsorship_payment_reviews%ROWTYPE;
  v_reference text := trim(p_payment_reference);
  v_currency text := upper(trim(p_currency));
  v_email text;
  v_title text;
BEGIN
  IF v_reference IS NULL OR length(v_reference) NOT BETWEEN 1 AND 200
    OR p_source IS NULL OR length(trim(p_source)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'A payment reference and source are required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 2)
    OR p_amount > 9999999999.99 OR v_currency IS NULL OR v_currency NOT IN ('INR', 'EUR') THEN
    RAISE EXCEPTION 'Provide the positive payment amount and INR or EUR currency';
  END IF;
  SELECT * INTO v_enrollment FROM public.enrollments
    WHERE user_id = p_user_id AND course_id = p_course_id FOR SHARE;
  IF NOT FOUND OR v_enrollment.access_source <> 'sponsorship' THEN
    RAISE EXCEPTION 'Payment reviews must belong to an existing sponsored enrollment';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  SELECT title INTO v_title FROM public.courses WHERE id = p_course_id;
  INSERT INTO public.sponsorship_payment_reviews (enrollment_id, user_id, course_id,
    payment_reference, amount, currency, source, buyer_email, course_title)
  VALUES (v_enrollment.id, p_user_id, p_course_id, v_reference, p_amount, v_currency, trim(p_source), v_email, v_title)
  ON CONFLICT (payment_reference) DO NOTHING RETURNING * INTO v_review;
  IF NOT FOUND THEN
    SELECT * INTO STRICT v_review FROM public.sponsorship_payment_reviews WHERE payment_reference = v_reference;
    IF v_review.user_id IS DISTINCT FROM p_user_id OR v_review.course_id IS DISTINCT FROM p_course_id
      OR v_review.amount IS DISTINCT FROM p_amount OR v_review.currency IS DISTINCT FROM v_currency THEN
      RAISE EXCEPTION 'This payment reference already has different learner, course, amount or currency details';
    END IF;
  END IF;
  RETURN v_review.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_sponsorship_payment_review(p_review_id uuid, p_notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_review public.sponsorship_payment_reviews%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can resolve payment reviews' USING ERRCODE = '42501';
  END IF;
  IF p_notes IS NULL OR length(trim(p_notes)) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Record how this payment was reconciled (up to 4000 characters)';
  END IF;
  SELECT * INTO v_review FROM public.sponsorship_payment_reviews WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment review not found'; END IF;
  IF v_review.status = 'resolved' THEN RETURN; END IF;
  UPDATE public.sponsorship_payment_reviews SET status = 'resolved', review_notes = trim(p_notes),
    resolved_by = auth.uid(), resolved_at = now() WHERE id = p_review_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_sponsorship_payment_review()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['status', 'review_notes', 'resolved_by', 'resolved_at'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'review_notes', 'resolved_by', 'resolved_at']) THEN
    RAISE EXCEPTION 'Original sponsorship payment details are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_sponsorship_payment_review BEFORE UPDATE ON public.sponsorship_payment_reviews
  FOR EACH ROW EXECUTE FUNCTION public.protect_sponsorship_payment_review();
REVOKE ALL ON FUNCTION public.record_sponsorship_payment_review(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_sponsorship_payment_review(uuid, uuid, text, numeric, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_resolve_sponsorship_payment_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_sponsorship_payment_review(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.protect_sponsorship_payment_review() FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.sponsorship_codes.expires_at IS 'Deadline for new redemptions only; existing access includes future published courses.';
COMMENT ON COLUMN public.invoices.document_type IS 'Sponsorship receipts acknowledge free access; they are not paid GST tax invoices.';
