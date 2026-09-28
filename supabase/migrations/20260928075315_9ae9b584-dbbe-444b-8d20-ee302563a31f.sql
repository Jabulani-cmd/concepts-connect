ALTER TABLE public.students ADD COLUMN IF NOT EXISTS full_name TEXT GENERATED ALWAYS AS (trim(both ' ' from coalesce(first_name,'') || ' ' || coalesce(last_name,''))) STORED;

CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','excused')),
  notes TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage attendance" ON public.attendance FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor']::app_role[]));
CREATE POLICY "Students view own attendance" ON public.attendance FOR SELECT TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
CREATE POLICY "Parents view linked children attendance" ON public.attendance FOR SELECT TO authenticated USING (student_id IN (SELECT sg.student_id FROM public.student_guardians sg JOIN public.guardians g ON g.id = sg.guardian_id WHERE g.user_id = auth.uid()));
CREATE INDEX idx_attendance_class_date ON public.attendance(class_id, date);
CREATE INDEX idx_attendance_student ON public.attendance(student_id, date);

CREATE TABLE public.personal_timetables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_timetables TO authenticated;
GRANT ALL ON public.personal_timetables TO service_role;
ALTER TABLE public.personal_timetables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own timetable" ON public.personal_timetables FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());