ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS class_teacher_id UUID;
ALTER TABLE public.class_subjects ALTER COLUMN academic_year_id DROP NOT NULL;

CREATE TABLE public.timetable_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id UUID,
  day_of_week INT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  room TEXT,
  term TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_entries TO authenticated;
GRANT ALL ON public.timetable_entries TO service_role;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view timetable entries" ON public.timetable_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage timetable entries" ON public.timetable_entries FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor']::app_role[]));

CREATE TABLE public.tt_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'class',
  class_label TEXT,
  term TEXT,
  academic_year TEXT,
  school_days INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  period_minutes INT NOT NULL DEFAULT 45,
  periods_per_day INT NOT NULL DEFAULT 8,
  day_start_time TEXT NOT NULL DEFAULT '07:30',
  status TEXT NOT NULL DEFAULT 'draft',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tt_definitions TO authenticated;
GRANT ALL ON public.tt_definitions TO service_role;
ALTER TABLE public.tt_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view timetable definitions" ON public.tt_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage timetable definitions" ON public.tt_definitions FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor']::app_role[]));

CREATE TABLE public.tt_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  definition_id UUID NOT NULL REFERENCES public.tt_definitions(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  period_index INT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_break BOOLEAN NOT NULL DEFAULT false,
  break_label TEXT,
  subject_name TEXT,
  subject_color TEXT,
  teacher_name TEXT,
  room TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tt_slots TO authenticated;
GRANT ALL ON public.tt_slots TO service_role;
ALTER TABLE public.tt_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view timetable slots" ON public.tt_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage timetable slots" ON public.tt_slots FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor']::app_role[]));