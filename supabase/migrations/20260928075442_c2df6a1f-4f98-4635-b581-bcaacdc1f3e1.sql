CREATE TABLE public.awards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient TEXT NOT NULL,
  title TEXT NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.awards TO authenticated;
GRANT ALL ON public.awards TO service_role;
ALTER TABLE public.awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view awards" ON public.awards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage awards" ON public.awards FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.award_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.award_photos TO authenticated;
GRANT ALL ON public.award_photos TO service_role;
ALTER TABLE public.award_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view award photos" ON public.award_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage award photos" ON public.award_photos FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference_number TEXT,
  bank_name TEXT,
  transaction_type TEXT NOT NULL DEFAULT 'credit' CHECK (transaction_type IN ('credit','debit')),
  amount_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  reconciliation_status TEXT NOT NULL DEFAULT 'unmatched',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff manage bank transactions" ON public.bank_transactions FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','bursar','finance_clerk','admin_supervisor']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','bursar','finance_clerk','admin_supervisor']::app_role[]));