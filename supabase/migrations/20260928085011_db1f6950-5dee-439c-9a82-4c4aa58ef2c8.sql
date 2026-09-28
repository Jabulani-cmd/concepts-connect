CREATE TABLE public.exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  form_level TEXT,
  term TEXT,
  academic_year TEXT,
  subject_ids UUID[],
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view exams" ON public.exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage exams" ON public.exams FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor']::app_role[]));

CREATE TABLE public.exam_timetable_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  exam_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  venue TEXT,
  invigilators TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_timetable_entries TO authenticated;
GRANT ALL ON public.exam_timetable_entries TO service_role;
ALTER TABLE public.exam_timetable_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view exam entries" ON public.exam_timetable_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage exam entries" ON public.exam_timetable_entries FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor']::app_role[]));