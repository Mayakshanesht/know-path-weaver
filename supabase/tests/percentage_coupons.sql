\set ON_ERROR_STOP on
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
SELECT ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'learner'||n||'@example.edu',now(),
  jsonb_build_object('full_name','Discount Learner '||n) FROM generate_series(19,24) n;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.admin_create_sponsorship_code('Half price','Percentage paid programme','general',NULL,4,NULL,NULL,
  NULL,50)->>'code' AS half_code \gset
SELECT public.admin_create_sponsorship_code('Nearly all','Rounding programme','individual',NULL,1,ARRAY['learner22@example.edu'],NULL,
  NULL,99.99)->>'code' AS rounding_code \gset
SELECT public.admin_create_sponsorship_code('Actual sponsorship','Free collision programme','individual',NULL,1,ARRAY['learner21@example.edu'],NULL,
  NULL,100)->>'code' AS full_code \gset
SELECT public.test_expect_error($q$SELECT public.admin_create_sponsorship_code('Invalid','Invalid','general',NULL,1,NULL,NULL,NULL,0)$q$,'Discount percentage');
SELECT public.test_expect_error($q$SELECT public.admin_create_sponsorship_code('Invalid','Invalid','general',NULL,1,NULL,NULL,NULL,100.01)$q$,'Discount percentage');
SELECT public.test_expect_error($q$SELECT public.admin_create_sponsorship_code('Invalid','Invalid','general',NULL,1,NULL,NULL,NULL,1.001)$q$,'Discount percentage');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000019',false);
SELECT public.test_assert((public.quote_sponsorship_code(:'half_code','10000000-0000-0000-0000-000000000001')->>'discount_percent')::numeric=50
  AND (public.quote_sponsorship_code(:'half_code','10000000-0000-0000-0000-000000000001')->>'total')::numeric=999.50,'partial coupon shows remaining paid balance');
SELECT public.test_assert((public.quote_sponsorship_code(:'half_code','10000000-0000-0000-0000-000000000001','international')->>'total')::numeric=59.50
  AND public.quote_sponsorship_code(:'half_code','10000000-0000-0000-0000-000000000001','international')->>'currency'='EUR','international quote uses matching course currency');
SELECT public.test_expect_error(format('SELECT public.redeem_sponsorship_code(%L,%L,%L)',:'half_code','Student Nineteen','College'),'requires payment');
SELECT public.test_assert((SELECT count(*)=0 FROM public.sponsorship_redemptions),'partial free-redemption attempt consumes no seat');
SELECT public.reserve_coupon_checkout(:'half_code','10000000-0000-0000-0000-000000000001','india','Student Nineteen','Engineering College','IN','Maharashtra')->>'checkout_id' AS checkout_one \gset
SELECT public.test_assert((SELECT count(*)=1 AND min(discount_percent)=50 FROM public.sponsorship_redemptions),'paid checkout reserves one verified member seat');
SELECT public.test_assert((SELECT count(*)=0 FROM public.enrollments),'a reserved partial checkout grants no course access');
SELECT public.test_assert(NOT public.has_verified_course_access('10000000-0000-0000-0000-000000000001'),'a partial coupon never opens protected content before payment');
SELECT public.test_assert((public.reserve_coupon_checkout(:'half_code','10000000-0000-0000-0000-000000000001','international','Changed Name','Changed College')->>'checkout_id')=:'checkout_one','reservation retry reuses the original checkout and currency');
SELECT public.test_expect_error(format('SELECT public.record_coupon_gateway_order(%L,%L)',:'checkout_one','order_fake'),'permission denied');
SELECT public.test_expect_error(format('SELECT public.complete_coupon_checkout(%L,%L,%L,%L,999.50,%L)',:'checkout_one',auth.uid(),'pay_fake','order_fake','INR'),'permission denied');
RESET ROLE;
UPDATE public.courses SET price_india=3999 WHERE id='10000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000019',false);
SELECT public.test_assert((public.quote_sponsorship_code(:'half_code','10000000-0000-0000-0000-000000000001','international')->>'total')::numeric=999.50
  AND public.quote_sponsorship_code(:'half_code','10000000-0000-0000-0000-000000000001','international')->>'currency'='INR','quote returns the immutable pending price even after catalogue or requested region changes');
RESET ROLE;
UPDATE public.courses SET price_india=1999 WHERE id='10000000-0000-0000-0000-000000000001';
SET ROLE service_role;
SELECT public.record_coupon_gateway_order(:'checkout_one','order_half_one');
SELECT public.record_coupon_gateway_order(:'checkout_one','order_half_one');
SELECT public.test_expect_error(format('SELECT public.record_coupon_gateway_order(%L,%L)',:'checkout_one','order_replaced'),'another gateway order');
SELECT public.test_expect_error(format('SELECT public.complete_coupon_checkout(%L,%L,%L,%L,1,%L)',:'checkout_one','00000000-0000-0000-0000-000000000019','pay_wrong_amount','order_half_one','INR'),'does not match');
SELECT public.test_expect_error(format('SELECT public.complete_coupon_checkout(%L,%L,%L,%L,999.50,%L)',:'checkout_one','00000000-0000-0000-0000-000000000020','pay_wrong_user','order_half_one','INR'),'does not match');
SELECT public.test_expect_error(format('SELECT public.complete_coupon_checkout(%L,%L,%L,%L,999.50,%L)',:'checkout_one','00000000-0000-0000-0000-000000000019','pay_wrong_currency','order_half_one','EUR'),'does not match');
SELECT public.test_assert((public.complete_coupon_checkout(:'checkout_one','00000000-0000-0000-0000-000000000019','pay_half_one','order_half_one',999.50,'INR')->>'already_completed')::boolean=false,'exact verified gateway payment completes checkout');
SELECT public.test_assert((public.complete_coupon_checkout(:'checkout_one','00000000-0000-0000-0000-000000000019','pay_half_one','order_half_one',999.50,'INR')->>'already_completed')::boolean,'payment webhook replay is idempotent');
RESET ROLE;
SELECT public.test_assert((SELECT count(*)=1 AND min(amount)=999.50 AND min(list_price)=1999 AND min(discount_amount)=999.50 AND min(discount_percent)=50
  AND min(coupon_code)=:'half_code' AND min(document_type)='tax_invoice' AND min(tax_amount)=152.47
  AND min(place_of_supply)='Maharashtra' AND min(buyer_name)='Student Nineteen'
  FROM public.invoices WHERE user_id='00000000-0000-0000-0000-000000000019'),'paid invoice preserves original price, discount, buyer, location and paid-balance GST');
SELECT public.test_assert((SELECT count(*)=1 AND bool_and(payment_confirmed AND status='approved') AND min(amount_paid)=999.50
  FROM public.enrollments WHERE user_id='00000000-0000-0000-0000-000000000019'),'verified partial payment grants only the purchased course');
SELECT public.test_expect_error($q$UPDATE public.invoices SET discount_amount=0 WHERE user_id='00000000-0000-0000-0000-000000000019'$q$,'snapshots are immutable');
SELECT public.test_expect_error($q$DELETE FROM public.invoices WHERE user_id='00000000-0000-0000-0000-000000000019'$q$,'cannot be deleted');
SELECT public.test_expect_error($q$UPDATE public.coupon_checkouts SET total=1 WHERE user_id='00000000-0000-0000-0000-000000000019'$q$,'snapshots are immutable');

-- Two other participants demonstrate sponsored/paid collisions preserve both
-- the existing invoice and a separate audit of newly captured money.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000020',false);
SELECT public.reserve_coupon_checkout(:'half_code','10000000-0000-0000-0000-000000000002','international','Student Twenty','College','FR',NULL)->>'checkout_id' AS checkout_two \gset
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',false);
SELECT public.reserve_coupon_checkout(:'half_code','10000000-0000-0000-0000-000000000001','india','Student Twenty One','College')->>'checkout_id' AS sponsor_collision \gset
SELECT public.redeem_sponsorship_code(:'full_code','Student Twenty One','College');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000023',false);
SELECT public.reserve_coupon_checkout(:'half_code','10000000-0000-0000-0000-000000000001','india','Student Twenty Three','College')->>'checkout_id' AS paid_collision \gset
RESET ROLE;
INSERT INTO public.enrollments(user_id,course_id,status,payment_confirmed,payment_confirmed_at,amount_paid,currency,auto_approved)
VALUES('00000000-0000-0000-0000-000000000023','10000000-0000-0000-0000-000000000001','approved',true,now(),1999,'INR',false);
SET ROLE service_role;
SELECT public.record_coupon_gateway_order(:'checkout_two','order_half_two');
SELECT public.complete_coupon_checkout(:'checkout_two','00000000-0000-0000-0000-000000000020','pay_half_two','order_half_two',69.50,'EUR');
SELECT public.record_coupon_gateway_order(:'sponsor_collision','order_sponsor_collision');
SELECT public.test_assert((public.complete_coupon_checkout(:'sponsor_collision','00000000-0000-0000-0000-000000000021','pay_sponsor_collision','order_sponsor_collision',999.50,'INR')->>'payment_review_required')::boolean,'late partial payment after free activation is recorded for review');
SELECT public.record_coupon_gateway_order(:'paid_collision','order_paid_collision');
SELECT public.test_assert((public.complete_coupon_checkout(:'paid_collision','00000000-0000-0000-0000-000000000023','pay_paid_collision','order_paid_collision',999.50,'INR')->>'payment_review_required')::boolean,'duplicate actual paid payment is recorded for review');
SELECT public.test_assert((public.complete_coupon_checkout(:'paid_collision','00000000-0000-0000-0000-000000000023','pay_paid_collision','order_paid_collision',999.50,'INR')->>'already_completed')::boolean,'captured duplicate payment review is idempotent');
RESET ROLE;
SELECT public.test_assert((SELECT count(*)=2 AND min(amount)=999.50 FROM public.sponsorship_payment_reviews
  WHERE payment_reference IN('pay_sponsor_collision','pay_paid_collision')),'both genuine captured collisions have immutable payment audit records');
SELECT public.test_assert((SELECT amount=0 AND document_type='sponsorship_receipt' FROM public.invoices
  WHERE user_id='00000000-0000-0000-0000-000000000021' AND course_id='10000000-0000-0000-0000-000000000001'),'original free sponsorship receipt is preserved after a late real charge');
SELECT public.test_assert((SELECT amount=1999 FROM public.invoices WHERE user_id='00000000-0000-0000-0000-000000000023'),'original paid invoice is preserved after a duplicate real charge');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000024',false);
SELECT public.test_expect_error(format('SELECT public.reserve_coupon_checkout(%L,%L,%L,%L,%L)',:'half_code','10000000-0000-0000-0000-000000000001','india','Student Twenty Four','College'),'All seats');
SELECT public.test_assert((SELECT count(*)=0 FROM public.coupon_checkouts),'checkout rows are isolated from other members');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000022',false);
RESET ROLE;
UPDATE public.courses SET price_india=0.01 WHERE id='10000000-0000-0000-0000-000000000005';
SET ROLE authenticated;
SELECT public.test_assert((public.quote_sponsorship_code(:'rounding_code','10000000-0000-0000-0000-000000000005')->>'total')::numeric=0.01,'a partial percentage never rounds down to a free checkout');
SELECT public.reserve_coupon_checkout(:'rounding_code','10000000-0000-0000-0000-000000000005','india','Rounding Student','College');
RESET ROLE;
UPDATE public.courses SET price_india=5999 WHERE id='10000000-0000-0000-0000-000000000005';
SELECT public.test_assert((SELECT count(*)=0 FROM public.enrollments WHERE user_id='00000000-0000-0000-0000-000000000022'),'unpaid near-100-percent reservation never grants any courses');
\echo Percentage coupon security and accounting assertions passed.
