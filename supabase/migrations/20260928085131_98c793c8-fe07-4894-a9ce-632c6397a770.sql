CREATE TABLE public.facility_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  caption TEXT,
  facility_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facility_images TO authenticated;
GRANT ALL ON public.facility_images TO service_role;
ALTER TABLE public.facility_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view facility images" ON public.facility_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage facility images" ON public.facility_images FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','admin_supervisor']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','admin_supervisor']::app_role[]));