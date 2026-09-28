ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_method TEXT;

CREATE TABLE public.school_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_projects TO authenticated;
GRANT ALL ON public.school_projects TO service_role;
ALTER TABLE public.school_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view school projects" ON public.school_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage school projects" ON public.school_projects FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','admin_supervisor']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','admin_supervisor']::app_role[]));