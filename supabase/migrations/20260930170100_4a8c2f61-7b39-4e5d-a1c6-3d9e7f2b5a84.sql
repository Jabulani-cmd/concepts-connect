-- ============================================
-- SUBSCRIPTION PLANS AND DEMO BILLING
-- * Three starter portal plans (Monthly, Termly, Annual) when the school has none;
--   admins change prices in Payments.
-- * seed_demo_billing(): for the demo school only (learners CLA90001 and up), a
--   realistic billing picture so the whole payment journey can be shown:
--     - portal subscriptions: about three in four families have paid (a Termly plan
--       with a receipt in their payment history); the rest have NOT paid, so their
--       parent and child portals stay locked until the parent pays in the portal;
--     - school fees: this term's invoice for every demo learner, with payments by
--       EcoCash, OneMoney, InnBucks, ZIPIT, card, bank transfer or cash: about 45%
--       paid in full, 30% part-paid and 25% unpaid.
--   Running it again resets the demo billing (including demo payments made since).
-- Idempotent: safe to run more than once.
-- ============================================

INSERT INTO public.subscription_plans (name, plan_type, amount_usd, duration_days, description, features, is_active, is_recommended, sibling_discount_2, sibling_discount_3_plus)
SELECT * FROM (VALUES
  ('Monthly', 'monthly'::public.subscription_plan_type, 5::numeric, 30,
   'Full parent and student portal access for one month.',
   '["Timetables, marks and results","Attendance and school news","Study materials and assessments","Messages with teachers"]'::jsonb, true, false, 10::numeric, 15::numeric),
  ('Termly', 'term'::public.subscription_plan_type, 12::numeric, 120,
   'Full access for the whole term. Best value for most families.',
   '["Everything in Monthly","Term reports and exam timetable","AI progress alerts","Save 20% against monthly"]'::jsonb, true, true, 10::numeric, 15::numeric),
  ('Annual', 'custom'::public.subscription_plan_type, 30::numeric, 365,
   'Full access for the whole school year.',
   '["Everything in Termly","All three terms","Save 50% against monthly"]'::jsonb, true, false, 10::numeric, 15::numeric)
) AS v(name, plan_type, amount_usd, duration_days, description, features, is_active, is_recommended, sibling_discount_2, sibling_discount_3_plus)
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans);

CREATE OR REPLACE FUNCTION public.seed_demo_billing()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month int := extract(month FROM current_date)::int;
  v_year text := extract(year FROM current_date)::int::text;
  v_term text;
  v_term_start date;
  v_plan record;
  r record;
  v_n int;
  v_total numeric;
  v_inv uuid;
  v_sub uuid;
  v_method public.payment_method;
  v_methods public.payment_method[] := ARRAY['ecocash','onemoney','innbucks','eft','card','bank_transfer','cash']::public.payment_method[];
  n_paid int := 0; n_unpaid int := 0; n_inv int := 0; n_full int := 0; n_part int := 0;
BEGIN
  IF NOT public.is_school_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only a school administrator can load demo billing' USING ERRCODE = '42501';
  END IF;

  -- Zimbabwean school terms: January, May and September.
  IF v_month <= 4 THEN v_term := 'Term 1'; v_term_start := make_date(v_year::int, 1, 13);
  ELSIF v_month <= 8 THEN v_term := 'Term 2'; v_term_start := make_date(v_year::int, 5, 12);
  ELSE v_term := 'Term 3'; v_term_start := make_date(v_year::int, 9, 8);
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans
   WHERE is_active ORDER BY (plan_type = 'term') DESC, amount_usd LIMIT 1;

  CREATE TEMP TABLE demo_billing ON COMMIT DROP AS
  SELECT s.id, s.admission_number, s.form, coalesce(s.boarding_status, 'day') AS boarding,
         substring(s.admission_number FROM '[0-9]+')::int AS n,
         (SELECT ps.parent_id FROM public.parent_students ps WHERE ps.student_id = s.id ORDER BY ps.created_at LIMIT 1) AS parent_id
  FROM public.students s
  WHERE lower(coalesce(s.email, '')) ~ '^cla9[0-9]{4}@concepts-academy\.co\.zw$';

  -- ---------- Reset earlier demo billing ----------
  DELETE FROM public.payments p USING demo_billing d WHERE p.student_id = d.id;
  DELETE FROM public.invoice_items ii USING public.invoices i, demo_billing d WHERE ii.invoice_id = i.id AND i.student_id = d.id;
  DELETE FROM public.invoices i USING demo_billing d WHERE i.student_id = d.id;
  DELETE FROM public.access_grants g USING demo_billing d WHERE g.student_id = d.id;
  DELETE FROM public.payments p USING public.subscriptions su, demo_billing d WHERE p.subscription_id = su.id AND su.student_id = d.id;
  DELETE FROM public.subscriptions su USING demo_billing d WHERE su.student_id = d.id;

  FOR r IN SELECT * FROM demo_billing ORDER BY n LOOP
    v_n := coalesce(r.n, 0);
    v_method := v_methods[1 + (v_n % array_length(v_methods, 1))];

    -- ---------- Portal subscription: one family in four has not paid ----------
    IF r.parent_id IS NOT NULL AND v_plan.id IS NOT NULL THEN
      IF v_n % 4 = 3 THEN
        n_unpaid := n_unpaid + 1;
      ELSE
        INSERT INTO public.subscriptions (parent_id, student_id, plan_id, plan_type, amount_usd, currency_paid, payment_method,
                                          transaction_id, status, access_start, access_end, term, academic_year)
        VALUES (r.parent_id, r.id, v_plan.id, v_plan.plan_type, v_plan.amount_usd, 'USD',
                CASE WHEN v_method = 'cash' THEN 'ecocash'::public.payment_method ELSE v_method END,
                'DEMO-SUB-' || r.admission_number, 'active', v_term_start, v_term_start + v_plan.duration_days, v_term, v_year)
        RETURNING id INTO v_sub;
        INSERT INTO public.payments (subscription_id, parent_id, student_id, amount, amount_usd, amount_zig, currency, payment_method,
                                     payment_status, transaction_id, receipt_number, payment_date, notes)
        VALUES (v_sub, r.parent_id, r.id, v_plan.amount_usd, v_plan.amount_usd, 0, 'USD',
                CASE WHEN v_method = 'cash' THEN 'ecocash'::public.payment_method ELSE v_method END,
                'paid', 'DEMO-SUB-' || r.admission_number, 'CLA-S' || lpad(v_n::text, 6, '0'),
                v_term_start + (v_n % 10), 'Portal subscription (demo)');
        INSERT INTO public.access_grants (parent_id, student_id, grant_type, access_start, access_end, subscription_id, is_active, reason)
        VALUES (r.parent_id, r.id, 'paid', v_term_start, v_term_start + v_plan.duration_days, v_sub, true, 'Demo subscription');
        n_paid := n_paid + 1;
      END IF;
    END IF;

    -- ---------- School fees for this term ----------
    v_total := CASE WHEN r.form ~ '[56]' THEN 420 ELSE 380 END + CASE WHEN r.boarding = 'boarding' THEN 400 ELSE 0 END;
    INSERT INTO public.invoices (invoice_number, student_id, academic_year, term, total_usd, paid_usd, currency, status, due_date, notes)
    VALUES ('INV-' || v_year || '-D' || lpad(v_n::text, 5, '0'), r.id, v_year, v_term, v_total, 0, 'USD', 'unpaid',
            v_term_start + 7, 'demo-fees')
    RETURNING id INTO v_inv;
    INSERT INTO public.invoice_items (invoice_id, description, amount, amount_usd, amount_zig)
    VALUES (v_inv, CASE WHEN r.boarding = 'boarding' THEN 'Tuition, levies and boarding' ELSE 'Tuition and levies' END, v_total, v_total, 0);
    n_inv := n_inv + 1;

    IF v_n % 20 < 9 THEN
      -- Paid in full, in one or two instalments.
      IF v_n % 2 = 0 THEN
        INSERT INTO public.payments (invoice_id, student_id, amount, amount_usd, amount_zig, currency, payment_method, payment_status,
                                     reference_number, receipt_number, payment_date, notes)
        VALUES (v_inv, r.id, v_total, v_total, 0, 'USD', v_method, 'paid', 'DEMO-FEE-' || r.admission_number,
                'CLA-R' || lpad(v_n::text, 6, '0'), v_term_start + (v_n % 9), 'School fees (demo)');
      ELSE
        INSERT INTO public.payments (invoice_id, student_id, amount, amount_usd, amount_zig, currency, payment_method, payment_status,
                                     reference_number, receipt_number, payment_date, notes)
        VALUES (v_inv, r.id, round(v_total * 0.6), round(v_total * 0.6), 0, 'USD', v_method, 'paid', 'DEMO-FEE-' || r.admission_number || '-1',
                'CLA-R' || lpad(v_n::text, 6, '0') || 'A', v_term_start - 5, 'School fees (demo)'),
               (v_inv, r.id, v_total - round(v_total * 0.6), v_total - round(v_total * 0.6), 0, 'USD', v_methods[1 + ((v_n + 3) % 7)], 'paid',
                'DEMO-FEE-' || r.admission_number || '-2', 'CLA-R' || lpad(v_n::text, 6, '0') || 'B', v_term_start + 14, 'School fees (demo)');
      END IF;
      n_full := n_full + 1;
    ELSIF v_n % 20 < 15 THEN
      -- Part-paid: a deposit, with a balance for the parent to pay online.
      INSERT INTO public.payments (invoice_id, student_id, amount, amount_usd, amount_zig, currency, payment_method, payment_status,
                                   reference_number, receipt_number, payment_date, notes)
      VALUES (v_inv, r.id, round(v_total * 0.5), round(v_total * 0.5), 0, 'USD', v_method, 'paid', 'DEMO-FEE-' || r.admission_number,
              'CLA-R' || lpad(v_n::text, 6, '0'), v_term_start + (v_n % 12), 'School fees (demo)');
      n_part := n_part + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('learners', (SELECT count(*) FROM demo_billing), 'subscribed', n_paid, 'not_subscribed', n_unpaid,
                            'invoices', n_inv, 'fees_paid', n_full, 'fees_part_paid', n_part, 'fees_unpaid', n_inv - n_full - n_part,
                            'term', v_term || ' ' || v_year, 'plan', coalesce(v_plan.name, 'none'));
END $$;

REVOKE ALL ON FUNCTION public.seed_demo_billing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_demo_billing() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
