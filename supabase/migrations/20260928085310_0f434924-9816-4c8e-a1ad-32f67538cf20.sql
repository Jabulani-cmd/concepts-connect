ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_date TEXT, ADD COLUMN IF NOT EXISTS payment_method TEXT, ADD COLUMN IF NOT EXISTS amount_zig NUMERIC;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS amount_zig NUMERIC;

CREATE TABLE public.supplier_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  supplier_contact TEXT,
  invoice_number TEXT,
  invoice_date TEXT,
  due_date TEXT,
  description TEXT,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  amount_zig NUMERIC,
  paid_usd NUMERIC NOT NULL DEFAULT 0,
  paid_zig NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invoices TO authenticated;
GRANT ALL ON public.supplier_invoices TO service_role;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff view supplier invoices" ON public.supplier_invoices FOR SELECT TO authenticated USING (private.is_finance_staff(auth.uid()) OR private.has_any_role(auth.uid(), ARRAY['admin','principal']::app_role[]));
CREATE POLICY "Finance staff manage supplier invoices" ON public.supplier_invoices FOR ALL TO authenticated USING (private.is_finance_staff(auth.uid())) WITH CHECK (private.is_finance_staff(auth.uid()));

CREATE TABLE public.supplier_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  payment_date TEXT,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  amount_zig NUMERIC,
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff view supplier payments" ON public.supplier_payments FOR SELECT TO authenticated USING (private.is_finance_staff(auth.uid()) OR private.has_any_role(auth.uid(), ARRAY['admin','principal']::app_role[]));
CREATE POLICY "Finance staff manage supplier payments" ON public.supplier_payments FOR ALL TO authenticated USING (private.is_finance_staff(auth.uid())) WITH CHECK (private.is_finance_staff(auth.uid()));

CREATE TABLE public.petty_cash (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date TEXT,
  transaction_type TEXT NOT NULL DEFAULT 'deposit',
  description TEXT,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  amount_zig NUMERIC,
  reference_number TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.petty_cash TO authenticated;
GRANT ALL ON public.petty_cash TO service_role;
ALTER TABLE public.petty_cash ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff view petty cash" ON public.petty_cash FOR SELECT TO authenticated USING (private.is_finance_staff(auth.uid()) OR private.has_any_role(auth.uid(), ARRAY['admin','principal']::app_role[]));
CREATE POLICY "Finance staff manage petty cash" ON public.petty_cash FOR ALL TO authenticated USING (private.is_finance_staff(auth.uid())) WITH CHECK (private.is_finance_staff(auth.uid()));

CREATE TABLE public.finance_approval_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requested_by UUID,
  request_type TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_approval_requests TO authenticated;
GRANT ALL ON public.finance_approval_requests TO service_role;
ALTER TABLE public.finance_approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clerks view own requests, supervisors view all" ON public.finance_approval_requests FOR SELECT TO authenticated USING (requested_by = auth.uid() OR private.has_any_role(auth.uid(), ARRAY['admin','admin_supervisor','bursar','principal']::app_role[]));
CREATE POLICY "Finance staff create requests" ON public.finance_approval_requests FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());
CREATE POLICY "Supervisors review requests" ON public.finance_approval_requests FOR UPDATE TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','admin_supervisor','bursar']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','admin_supervisor','bursar']::app_role[]));