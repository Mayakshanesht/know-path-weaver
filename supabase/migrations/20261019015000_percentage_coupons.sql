-- Percentage coupons reserve a verified person's seat without granting access.
-- Only a verified gateway payment can complete a partial-discount checkout.
ALTER TABLE public.sponsorship_codes ADD COLUMN discount_percent numeric(5,2) NOT NULL DEFAULT 100
  CHECK (discount_percent > 0 AND discount_percent <= 100);
ALTER TABLE public.sponsorship_redemptions ADD COLUMN discount_percent numeric(5,2) NOT NULL DEFAULT 100
  CHECK (discount_percent > 0 AND discount_percent <= 100);
-- Existing free receipts receive 100 without mutating their protected rows.
-- Existing ordinary paid invoices receive zero before coupon invoices exist.
ALTER TABLE public.invoices ADD COLUMN discount_percent numeric(5,2) NOT NULL DEFAULT 100
  CHECK(discount_percent>=0 AND discount_percent<=100);
UPDATE public.invoices SET discount_percent=0 WHERE document_type='tax_invoice';
ALTER TABLE public.invoices ALTER COLUMN discount_percent SET DEFAULT 0;

ALTER FUNCTION public.admin_create_sponsorship_code(text,text,text,text,integer,text[],timestamptz,uuid)
  RENAME TO _create_sponsorship_code_before_percentage;
REVOKE ALL ON FUNCTION public._create_sponsorship_code_before_percentage(text,text,text,text,integer,text[],timestamptz,uuid)
  FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.admin_create_sponsorship_code(
  p_label text,p_campaign text,p_audience text,p_team_name text,p_max_redemptions integer,
  p_allowed_emails text[],p_expires_at timestamptz,p_request_id uuid DEFAULT NULL,
  p_discount_percent numeric DEFAULT 100
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_row public.sponsorship_codes%ROWTYPE; v_created jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only administrators can create sponsorship codes' USING ERRCODE='42501';
  END IF;
  IF p_discount_percent IS NULL OR p_discount_percent <= 0 OR p_discount_percent > 100
    OR p_discount_percent <> round(p_discount_percent,2) THEN
    RAISE EXCEPTION 'Discount percentage must be greater than zero and at most 100, with up to two decimal places';
  END IF;
  IF p_request_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,270027));
    SELECT * INTO v_row FROM public.sponsorship_codes WHERE creation_request_id=p_request_id;
    IF FOUND THEN
      IF v_row.created_by <> auth.uid() THEN RAISE EXCEPTION 'This creation request belongs to another administrator'; END IF;
      RETURN to_jsonb(v_row);
    END IF;
  END IF;
  v_created := public._create_sponsorship_code_before_percentage(p_label,p_campaign,p_audience,p_team_name,
    p_max_redemptions,p_allowed_emails,p_expires_at,p_request_id);
  UPDATE public.sponsorship_codes SET discount_percent=p_discount_percent WHERE id=(v_created->>'id')::uuid
    RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END;
$$;

-- One private claim routine is shared by free redemption and paid reservation.
CREATE FUNCTION public.claim_coupon_member(p_code text,p_full_name text,p_college text,p_require_free boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_user uuid:=auth.uid(); v_email text; v_code public.sponsorship_codes%ROWTYPE;
  v_redemption public.sponsorship_redemptions%ROWTYPE; v_already boolean:=false;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=v_user AND email_confirmed_at IS NOT NULL
    AND NULLIF(trim(email),'') IS NOT NULL;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Verify your email address or continue with Google before claiming sponsored access' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(270027,2027);
  SELECT * INTO v_code FROM public.sponsorship_codes WHERE code=upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This sponsorship code is not valid. Check it with your team captain or KnowGraph.'; END IF;
  IF p_require_free AND v_code.discount_percent <> 100 THEN
    RAISE EXCEPTION 'This percentage coupon requires payment of the remaining balance; complete paid checkout';
  END IF;
  IF NOT p_require_free AND v_code.discount_percent = 100 THEN
    RAISE EXCEPTION 'This 100 percent coupon uses free enrollment confirmation';
  END IF;
  SELECT * INTO v_redemption FROM public.sponsorship_redemptions WHERE code_id=v_code.id AND user_id=v_user;
  IF FOUND THEN v_already:=true;
  ELSE
    IF EXISTS(SELECT 1 FROM public.sponsorship_redemptions WHERE user_id=v_user AND campaign=v_code.campaign) THEN
      RAISE EXCEPTION 'You already have sponsored access for this programme. Use your original code or contact KnowGraph to change your team.';
    END IF;
    IF NOT v_code.active THEN RAISE EXCEPTION 'This sponsorship code is paused. Contact your team captain or KnowGraph.'; END IF;
    IF v_code.expires_at IS NOT NULL AND v_code.expires_at<=now() THEN RAISE EXCEPTION 'The redemption deadline for this sponsorship code has passed'; END IF;
    IF v_code.allowed_emails IS NOT NULL AND NOT(v_email=ANY(v_code.allowed_emails)) THEN
      RAISE EXCEPTION 'This email is not on the invitation roster. Ask your team captain to contact KnowGraph.' USING ERRCODE='42501';
    END IF;
    IF (SELECT count(*) FROM public.sponsorship_redemptions WHERE code_id=v_code.id)>=v_code.max_redemptions THEN
      RAISE EXCEPTION 'All seats for this sponsorship code have been claimed. Contact your team captain or KnowGraph.';
    END IF;
    IF p_full_name IS NULL OR length(trim(p_full_name)) NOT BETWEEN 2 AND 160
      OR p_college IS NULL OR length(trim(p_college)) NOT BETWEEN 2 AND 200 THEN RAISE EXCEPTION 'Provide your full name and college or organisation'; END IF;
    INSERT INTO public.sponsorship_redemptions(code_id,user_id,full_name,email,college,coupon_code,code_label,campaign,audience,team_name,discount_percent)
      VALUES(v_code.id,v_user,trim(p_full_name),v_email,trim(p_college),v_code.code,v_code.label,v_code.campaign,v_code.audience,v_code.team_name,v_code.discount_percent)
      RETURNING * INTO v_redemption;
  END IF;
  RETURN jsonb_build_object('redemption_id',v_redemption.id,'already_redeemed',v_already);
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_sponsorship_code(p_code text,p_full_name text,p_college text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_claim jsonb; v_redemption public.sponsorship_redemptions%ROWTYPE; v_course uuid; v_count integer:=0;
BEGIN
  v_claim:=public.claim_coupon_member(p_code,p_full_name,p_college,true);
  SELECT * INTO STRICT v_redemption FROM public.sponsorship_redemptions WHERE id=(v_claim->>'redemption_id')::uuid;
  FOR v_course IN SELECT id FROM public.courses WHERE is_published=true ORDER BY id LOOP
    IF public.grant_sponsored_course(v_redemption.id,v_course) THEN v_count:=v_count+1; END IF;
  END LOOP;
  RETURN v_claim || jsonb_build_object('enrolled_count',v_count,'campaign',v_redemption.campaign,'team_name',v_redemption.team_name);
END;
$$;

DROP FUNCTION public.quote_sponsorship_code(text,uuid);
CREATE FUNCTION public.quote_sponsorship_code(p_code text,p_course_id uuid,p_region text DEFAULT 'india')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_email text; v_code public.sponsorship_codes%ROWTYPE; v_course public.courses%ROWTYPE;
  v_already boolean; v_price numeric(12,2); v_discount numeric(12,2); v_currency text; v_existing jsonb;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL AND NULLIF(trim(email),'') IS NOT NULL;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Verify your email address or continue with Google before applying your code' USING ERRCODE='42501'; END IF;
  IF p_region IS NULL OR p_region NOT IN('india','international') THEN RAISE EXCEPTION 'Choose india or international billing region'; END IF;
  SELECT * INTO v_course FROM public.courses WHERE id=p_course_id AND is_published=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose an available published course'; END IF;
  SELECT * INTO v_code FROM public.sponsorship_codes WHERE code=upper(trim(p_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'This sponsorship code is not valid. Check it with your team captain or KnowGraph.'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.sponsorship_redemptions WHERE code_id=v_code.id AND user_id=auth.uid()) INTO v_already;
  IF NOT v_already THEN
    IF EXISTS(SELECT 1 FROM public.sponsorship_redemptions WHERE user_id=auth.uid() AND campaign=v_code.campaign) THEN
      RAISE EXCEPTION 'You already have sponsored access for this programme. Use your original code or contact KnowGraph to change your team.';
    END IF;
    IF NOT v_code.active THEN RAISE EXCEPTION 'This sponsorship code is paused. Contact your team captain or KnowGraph.'; END IF;
    IF v_code.expires_at IS NOT NULL AND v_code.expires_at<=now() THEN RAISE EXCEPTION 'The redemption deadline for this sponsorship code has passed'; END IF;
    IF v_code.allowed_emails IS NOT NULL AND NOT(v_email=ANY(v_code.allowed_emails)) THEN
      RAISE EXCEPTION 'This email is not on the invitation roster. Ask your team captain to contact KnowGraph.' USING ERRCODE='42501';
    END IF;
    IF (SELECT count(*) FROM public.sponsorship_redemptions WHERE code_id=v_code.id)>=v_code.max_redemptions THEN
      RAISE EXCEPTION 'All seats for this sponsorship code have been claimed. Contact your team captain or KnowGraph.';
    END IF;
  END IF;
  SELECT jsonb_build_object('checkout_id',cc.id,'course_id',cc.course_id,'title',cc.course_title,
    'list_price',cc.list_price,'discount_percent',cc.discount_percent,'discount_amount',cc.discount_amount,
    'total',cc.total,'currency',cc.currency,'campaign',cc.sponsorship_campaign,'team_name',cc.team_name,
    'already_redeemed',true) INTO v_existing FROM public.coupon_checkouts cc
    JOIN public.sponsorship_redemptions r ON r.id=cc.redemption_id
    WHERE r.code_id=v_code.id AND r.user_id=auth.uid() AND cc.course_id=p_course_id;
  IF FOUND THEN RETURN v_existing; END IF;
  v_price:=GREATEST(COALESCE(CASE WHEN p_region='india' THEN v_course.price_india ELSE v_course.price_international END,0),0);
  v_currency:=CASE WHEN p_region='india' THEN 'INR' ELSE 'EUR' END;
  IF v_code.discount_percent=100 THEN v_discount:=v_price;
  ELSE
    IF v_price<=0 THEN RAISE EXCEPTION 'Course has no payable price for a percentage discount'; END IF;
    v_discount:=LEAST(round(v_price*v_code.discount_percent/100,2),GREATEST(v_price-0.01,0));
  END IF;
  RETURN jsonb_build_object('course_id',v_course.id,'title',v_course.title,'list_price',v_price,
    'discount_percent',v_code.discount_percent,'discount_amount',v_discount,'total',v_price-v_discount,
    'currency',v_currency,'campaign',v_code.campaign,'team_name',v_code.team_name,'already_redeemed',v_already);
END;
$$;

CREATE TABLE public.coupon_checkouts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_id uuid NOT NULL REFERENCES public.sponsorship_redemptions(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id),
  course_title text NOT NULL, buyer_name text NOT NULL, buyer_email text NOT NULL,
  coupon_code text NOT NULL, sponsorship_campaign text NOT NULL, team_name text,
  list_price numeric(12,2) NOT NULL CHECK(list_price>0),
  discount_percent numeric(5,2) NOT NULL CHECK(discount_percent>0 AND discount_percent<100),
  discount_amount numeric(12,2) NOT NULL CHECK(discount_amount>=0),
  total numeric(12,2) NOT NULL CHECK(total>0), currency text NOT NULL CHECK(currency IN('INR','EUR')),
  billing_region public.billing_region NOT NULL, billing_country text, billing_state text,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','paid','needs_review')),
  gateway_order_id text UNIQUE, payment_reference text UNIQUE,
  enrollment_id uuid REFERENCES public.enrollments(id),
  created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz,
  UNIQUE(redemption_id,course_id), CHECK(discount_amount+total=list_price),
  CHECK((status='pending' AND payment_reference IS NULL AND paid_at IS NULL)
    OR(status IN('paid','needs_review') AND payment_reference IS NOT NULL AND gateway_order_id IS NOT NULL AND paid_at IS NOT NULL))
);
ALTER TABLE public.enrollments ADD COLUMN coupon_checkout_id uuid REFERENCES public.coupon_checkouts(id);
ALTER TABLE public.invoices ADD COLUMN coupon_checkout_id uuid REFERENCES public.coupon_checkouts(id);
ALTER TABLE public.coupon_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins can read coupon checkouts" ON public.coupon_checkouts FOR SELECT TO authenticated
  USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
REVOKE ALL ON public.coupon_checkouts FROM anon,authenticated,service_role;
GRANT SELECT ON public.coupon_checkouts TO authenticated,service_role;

CREATE FUNCTION public.reserve_coupon_checkout(p_code text,p_course_id uuid,p_region text,p_full_name text,p_college text,
  p_billing_country text DEFAULT NULL,p_billing_state text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_quote jsonb; v_claim jsonb; v_member public.sponsorship_redemptions%ROWTYPE; v_checkout public.coupon_checkouts%ROWTYPE;
BEGIN
  v_quote:=public.quote_sponsorship_code(p_code,p_course_id,p_region);
  IF (v_quote->>'discount_percent')::numeric=100 THEN RAISE EXCEPTION 'This 100 percent coupon uses free enrollment confirmation'; END IF;
  IF EXISTS(SELECT 1 FROM public.enrollments WHERE user_id=auth.uid() AND course_id=p_course_id
    AND (access_source='sponsorship' OR (status='approved' AND payment_confirmed=true))) THEN
    RAISE EXCEPTION 'You already have access to this course; another paid checkout is not needed';
  END IF;
  IF NULLIF(trim(p_billing_country),'') IS NOT NULL AND trim(p_billing_country) !~ '^[A-Za-z]{2}$' THEN RAISE EXCEPTION 'Billing country must be a two-letter country code'; END IF;
  IF length(p_billing_state)>160 THEN RAISE EXCEPTION 'Billing state is too long'; END IF;
  v_claim:=public.claim_coupon_member(p_code,p_full_name,p_college,false);
  IF EXISTS(SELECT 1 FROM public.enrollments WHERE user_id=auth.uid() AND course_id=p_course_id
    AND (access_source='sponsorship' OR (status='approved' AND payment_confirmed=true))) THEN
    RAISE EXCEPTION 'You already have access to this course; another paid checkout is not needed';
  END IF;
  SELECT * INTO STRICT v_member FROM public.sponsorship_redemptions WHERE id=(v_claim->>'redemption_id')::uuid;
  INSERT INTO public.coupon_checkouts(redemption_id,user_id,course_id,course_title,buyer_name,buyer_email,coupon_code,
    sponsorship_campaign,team_name,list_price,discount_percent,discount_amount,total,currency,billing_region,billing_country,billing_state)
  VALUES(v_member.id,v_member.user_id,p_course_id,v_quote->>'title',v_member.full_name,v_member.email,v_member.coupon_code,
    v_member.campaign,v_member.team_name,(v_quote->>'list_price')::numeric,v_member.discount_percent,
    (v_quote->>'discount_amount')::numeric,(v_quote->>'total')::numeric,v_quote->>'currency',p_region::public.billing_region,
    upper(NULLIF(trim(p_billing_country),'')),NULLIF(trim(p_billing_state),''))
  ON CONFLICT(redemption_id,course_id) DO NOTHING RETURNING * INTO v_checkout;
  IF NOT FOUND THEN SELECT * INTO STRICT v_checkout FROM public.coupon_checkouts WHERE redemption_id=v_member.id AND course_id=p_course_id; END IF;
  RETURN jsonb_build_object('checkout_id',v_checkout.id,'redemption_id',v_checkout.redemption_id,'course_id',v_checkout.course_id,
    'title',v_checkout.course_title,'list_price',v_checkout.list_price,'discount_percent',v_checkout.discount_percent,
    'discount_amount',v_checkout.discount_amount,'total',v_checkout.total,'currency',v_checkout.currency,
    'campaign',v_checkout.sponsorship_campaign,'team_name',v_checkout.team_name,'gateway_order_id',v_checkout.gateway_order_id,'status',v_checkout.status);
END;
$$;

CREATE FUNCTION public.record_coupon_gateway_order(p_checkout_id uuid,p_order_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_checkout public.coupon_checkouts%ROWTYPE;
BEGIN
  IF p_order_id IS NULL OR length(trim(p_order_id)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'A gateway order ID is required'; END IF;
  SELECT * INTO v_checkout FROM public.coupon_checkouts WHERE id=p_checkout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coupon checkout not found'; END IF;
  IF v_checkout.gateway_order_id IS NOT NULL AND v_checkout.gateway_order_id<>p_order_id THEN
    RAISE EXCEPTION 'Checkout is already bound to another gateway order';
  END IF;
  UPDATE public.coupon_checkouts SET gateway_order_id=p_order_id WHERE id=p_checkout_id;
END;
$$;

CREATE FUNCTION public.complete_coupon_checkout(p_checkout_id uuid,p_user_id uuid,p_payment_reference text,
  p_order_id text,p_amount numeric,p_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_checkout public.coupon_checkouts%ROWTYPE; v_enrollment public.enrollments%ROWTYPE; v_invoice uuid; v_review uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(270027,2027);
  SELECT * INTO v_checkout FROM public.coupon_checkouts WHERE id=p_checkout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coupon checkout not found'; END IF;
  IF v_checkout.user_id IS DISTINCT FROM p_user_id OR v_checkout.gateway_order_id IS NULL
    OR v_checkout.gateway_order_id IS DISTINCT FROM p_order_id
    OR v_checkout.total IS DISTINCT FROM p_amount OR v_checkout.currency IS DISTINCT FROM p_currency
    OR p_payment_reference IS NULL OR length(trim(p_payment_reference)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Verified payment does not match the coupon checkout user, order, amount or currency';
  END IF;
  IF v_checkout.status IN('paid','needs_review') THEN
    IF v_checkout.payment_reference<>p_payment_reference THEN RAISE EXCEPTION 'Checkout was already completed with another payment'; END IF;
    SELECT id INTO v_invoice FROM public.invoices WHERE enrollment_id=v_checkout.enrollment_id;
    SELECT id INTO v_review FROM public.sponsorship_payment_reviews WHERE payment_reference=p_payment_reference;
    RETURN jsonb_build_object('checkout_id',v_checkout.id,'enrollment_id',v_checkout.enrollment_id,'invoice_id',v_invoice,
      'already_completed',true,'payment_review_required',v_checkout.status='needs_review','review_id',v_review);
  END IF;
  -- Serialise with free redemption/publication and competing coupon checkouts.
  SELECT * INTO v_enrollment FROM public.enrollments WHERE user_id=p_user_id AND course_id=v_checkout.course_id FOR UPDATE;
  IF FOUND AND (v_enrollment.access_source='sponsorship' OR v_enrollment.payment_confirmed=true
    OR EXISTS(SELECT 1 FROM public.invoices WHERE enrollment_id=v_enrollment.id)) THEN
    v_review:=public.record_sponsorship_payment_review(p_user_id,v_checkout.course_id,p_payment_reference,
      p_amount,p_currency,'coupon_duplicate_payment');
    UPDATE public.coupon_checkouts SET status='needs_review',payment_reference=p_payment_reference,paid_at=now(),
      enrollment_id=v_enrollment.id WHERE id=p_checkout_id;
    SELECT id INTO v_invoice FROM public.invoices WHERE enrollment_id=v_enrollment.id;
    RETURN jsonb_build_object('checkout_id',v_checkout.id,'enrollment_id',v_enrollment.id,'invoice_id',v_invoice,
      'already_completed',false,'payment_review_required',true,'review_id',v_review);
  END IF;
  UPDATE public.coupon_checkouts SET status='paid',payment_reference=p_payment_reference,paid_at=now() WHERE id=p_checkout_id;
  INSERT INTO public.enrollments(user_id,course_id,status,approved_at,payment_confirmed,payment_confirmed_at,
    auto_approved,amount_paid,currency,payment_reference,billing_region,billing_country,billing_state,coupon_checkout_id)
  VALUES(p_user_id,v_checkout.course_id,'approved',now(),true,now(),false,v_checkout.total,v_checkout.currency,
    p_payment_reference,v_checkout.billing_region,v_checkout.billing_country,v_checkout.billing_state,v_checkout.id)
  ON CONFLICT(user_id,course_id) DO UPDATE SET status='approved',approved_at=now(),payment_confirmed=true,
    payment_confirmed_at=now(),auto_approved=false,amount_paid=v_checkout.total,currency=v_checkout.currency,
    payment_reference=p_payment_reference,billing_region=v_checkout.billing_region,billing_country=v_checkout.billing_country,
    billing_state=v_checkout.billing_state,coupon_checkout_id=v_checkout.id
  RETURNING * INTO v_enrollment;
  UPDATE public.coupon_checkouts SET enrollment_id=v_enrollment.id WHERE id=p_checkout_id;
  SELECT id INTO v_invoice FROM public.invoices WHERE enrollment_id=v_enrollment.id;
  RETURN jsonb_build_object('checkout_id',v_checkout.id,'enrollment_id',v_enrollment.id,'invoice_id',v_invoice,'already_completed',false);
END;
$$;

CREATE FUNCTION public.protect_coupon_checkout()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $$
BEGIN
  IF (to_jsonb(NEW)-ARRAY['status','gateway_order_id','payment_reference','enrollment_id','paid_at'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','gateway_order_id','payment_reference','enrollment_id','paid_at']) THEN
    RAISE EXCEPTION 'Coupon checkout identity and price snapshots are immutable';
  END IF;
  IF OLD.gateway_order_id IS NOT NULL AND NEW.gateway_order_id IS DISTINCT FROM OLD.gateway_order_id THEN
    RAISE EXCEPTION 'Coupon checkout gateway order cannot be changed';
  END IF;
  IF OLD.status IN('paid','needs_review') AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    -- Completion first records the capture, then links the resulting enrollment.
    IF NOT(OLD.enrollment_id IS NULL AND NEW.enrollment_id IS NOT NULL
      AND (to_jsonb(NEW)-'enrollment_id')=(to_jsonb(OLD)-'enrollment_id')) THEN
      RAISE EXCEPTION 'Completed coupon checkouts cannot be changed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_coupon_checkout BEFORE UPDATE ON public.coupon_checkouts
  FOR EACH ROW EXECUTE FUNCTION public.protect_coupon_checkout();

CREATE FUNCTION public.validate_coupon_enrollment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_checkout public.coupon_checkouts%ROWTYPE;
BEGIN
  IF NEW.access_source='sponsorship' AND NOT EXISTS(SELECT 1 FROM public.sponsorship_redemptions r
    WHERE r.id=NEW.sponsorship_redemption_id AND r.user_id=NEW.user_id AND r.discount_percent=100) THEN
    RAISE EXCEPTION 'Only a verified 100 percent coupon redemption can grant free course access';
  END IF;
  IF NEW.coupon_checkout_id IS NOT NULL THEN
    SELECT * INTO v_checkout FROM public.coupon_checkouts WHERE id=NEW.coupon_checkout_id;
    IF NOT FOUND OR v_checkout.user_id<>NEW.user_id OR v_checkout.course_id<>NEW.course_id
      OR v_checkout.status<>'paid' OR NEW.access_source<>'payment'
      OR (NEW.status<>'approved' AND (TG_OP='INSERT' OR OLD.coupon_checkout_id IS NULL))
      OR NEW.payment_confirmed IS NOT TRUE OR NEW.auto_approved IS TRUE
      OR NEW.amount_paid IS DISTINCT FROM v_checkout.total OR NEW.currency IS DISTINCT FROM v_checkout.currency
      OR NEW.billing_region IS DISTINCT FROM v_checkout.billing_region
      OR NEW.billing_country IS DISTINCT FROM v_checkout.billing_country OR NEW.billing_state IS DISTINCT FROM v_checkout.billing_state THEN
      RAISE EXCEPTION 'Paid enrollment requires its matching verified coupon checkout';
    END IF;
  END IF;
  IF TG_OP='UPDATE' AND OLD.coupon_checkout_id IS NOT NULL AND NEW.coupon_checkout_id IS DISTINCT FROM OLD.coupon_checkout_id THEN
    RAISE EXCEPTION 'Paid coupon enrollment attribution cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_coupon_enrollment BEFORE INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.validate_coupon_enrollment();

CREATE FUNCTION public.protect_paid_coupon_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.coupon_checkout_id IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.user_id) THEN
      RAISE EXCEPTION 'Paid coupon invoices cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF (OLD.coupon_checkout_id IS NOT NULL OR NEW.coupon_checkout_id IS NOT NULL)
    AND (to_jsonb(NEW)-'storage_path') IS DISTINCT FROM (to_jsonb(OLD)-'storage_path') THEN
    RAISE EXCEPTION 'Paid coupon invoice snapshots are immutable; only the PDF storage path may change';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_paid_coupon_invoice BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.protect_paid_coupon_invoice();

REVOKE ALL ON FUNCTION public.claim_coupon_member(text,text,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_create_sponsorship_code(text,text,text,text,integer,text[],timestamptz,uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_create_sponsorship_code(text,text,text,text,integer,text[],timestamptz,uuid,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.quote_sponsorship_code(text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quote_sponsorship_code(text,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.reserve_coupon_checkout(text,uuid,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reserve_coupon_checkout(text,uuid,text,text,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.record_coupon_gateway_order(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_coupon_gateway_order(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.complete_coupon_checkout(uuid,uuid,text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_coupon_checkout(uuid,uuid,text,text,numeric,text) TO service_role;
REVOKE ALL ON FUNCTION public.protect_coupon_checkout() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.validate_coupon_enrollment() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.protect_paid_coupon_invoice() FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION public.grant_sponsored_course(p_redemption_id uuid, p_course_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_redemption public.sponsorship_redemptions%ROWTYPE;
  v_rows integer;
BEGIN
  SELECT * INTO STRICT v_redemption FROM public.sponsorship_redemptions WHERE id = p_redemption_id;
  IF v_redemption.discount_percent <> 100 THEN RAISE EXCEPTION 'Only a 100 percent coupon can grant free course access'; END IF;
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
  FOR v_redemption IN SELECT DISTINCT ON (user_id) id FROM public.sponsorship_redemptions WHERE discount_percent = 100
    ORDER BY user_id, redeemed_at, id LOOP
    PERFORM public.grant_sponsored_course(v_redemption, NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_invoice_on_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_course public.courses%ROWTYPE;
  v_redemption public.sponsorship_redemptions%ROWTYPE;
  v_checkout public.coupon_checkouts%ROWTYPE;
  v_discount numeric(12,2) := 0;
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
    IF NEW.coupon_checkout_id IS NOT NULL THEN
      SELECT * INTO STRICT v_checkout FROM public.coupon_checkouts WHERE id = NEW.coupon_checkout_id;
      IF v_checkout.user_id <> NEW.user_id OR v_checkout.course_id <> NEW.course_id
        OR v_checkout.status <> 'paid' OR v_checkout.total <> v_amount OR v_checkout.currency <> v_currency THEN
        RAISE EXCEPTION 'Paid enrollment does not match a completed coupon checkout';
      END IF;
      v_list_price := v_checkout.list_price; v_discount := v_checkout.discount_amount;
      SELECT * INTO STRICT v_redemption FROM public.sponsorship_redemptions WHERE id = v_checkout.redemption_id;
    END IF;
    SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.user_id = NEW.user_id;
    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = NEW.user_id;
    IF NEW.coupon_checkout_id IS NOT NULL THEN
      v_name:=v_checkout.buyer_name; v_email:=v_checkout.buyer_email;
    END IF;
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
    coupon_code, sponsorship_campaign, team_name, sponsorship_redemption_id, coupon_checkout_id, discount_percent)
  VALUES (v_number, NEW.id, NEW.user_id, NEW.course_id, v_amount, v_currency, v_region,
    NEW.billing_country, NEW.billing_state, COALESCE(v_checkout.course_title,v_course.title), v_name, v_email, v_year, v_month, v_issued,
    CASE WHEN v_sponsored THEN 'sponsorship_receipt' ELSE 'tax_invoice' END, v_list_price,
    CASE WHEN v_sponsored THEN v_list_price ELSE v_discount END,
    v_redemption.coupon_code, v_redemption.campaign, v_redemption.team_name, v_redemption.id, NEW.coupon_checkout_id,
    CASE WHEN v_sponsored THEN 100 ELSE COALESCE(v_checkout.discount_percent,0) END)
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
  IF NOT FOUND OR NOT (v_enrollment.access_source = 'sponsorship' OR (v_enrollment.status = 'approved' AND v_enrollment.payment_confirmed = true)) THEN
    RAISE EXCEPTION 'Payment reviews must belong to an existing sponsored enrollment or confirmed paid enrollment';
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
