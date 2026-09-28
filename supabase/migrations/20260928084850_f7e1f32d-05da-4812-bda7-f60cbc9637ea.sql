ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email TEXT, ADD COLUMN IF NOT EXISTS form TEXT, ADD COLUMN IF NOT EXISTS stream TEXT, ADD COLUMN IF NOT EXISTS class TEXT, ADD COLUMN IF NOT EXISTS boarding_status TEXT, ADD COLUMN IF NOT EXISTS status TEXT, ADD COLUMN IF NOT EXISTS enrollment_date TEXT, ADD COLUMN IF NOT EXISTS guardian_name TEXT, ADD COLUMN IF NOT EXISTS guardian_phone TEXT, ADD COLUMN IF NOT EXISTS guardian_email TEXT, ADD COLUMN IF NOT EXISTS province TEXT, ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE public.parent_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_students TO authenticated;
GRANT ALL ON public.parent_students TO service_role;
ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents view own links" ON public.parent_students FOR SELECT TO authenticated USING (parent_id = auth.uid() OR private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor','registration_officer']::app_role[]));
CREATE POLICY "Staff manage parent links" ON public.parent_students FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','admin_supervisor','registration_officer']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','admin_supervisor','registration_officer']::app_role[]));

CREATE TABLE public.parent_student_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_student_links TO authenticated;
GRANT ALL ON public.parent_student_links TO service_role;
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents view own student links" ON public.parent_student_links FOR SELECT TO authenticated USING (parent_id = auth.uid() OR private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor','registration_officer']::app_role[]));
CREATE POLICY "Staff manage parent student links" ON public.parent_student_links FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','admin_supervisor','registration_officer']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','admin_supervisor','registration_officer']::app_role[]));

CREATE TABLE public.student_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  academic_year TEXT,
  term TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_classes TO authenticated;
GRANT ALL ON public.student_classes TO service_role;
ALTER TABLE public.student_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students and parents view own class" ON public.student_classes FOR SELECT TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()) OR student_id IN (SELECT ps.student_id FROM public.parent_students ps WHERE ps.parent_id = auth.uid()) OR private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','teacher','hod','admin_supervisor','registration_officer']::app_role[]));
CREATE POLICY "Staff manage student classes" ON public.student_classes FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','admin_supervisor','registration_officer']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','principal','deputy_principal','admin_supervisor','registration_officer']::app_role[]));

CREATE TABLE public.access_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  student_id UUID,
  reason TEXT,
  term TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_grants TO authenticated;
GRANT ALL ON public.access_grants TO service_role;
ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own access grants" ON public.access_grants FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.has_any_role(auth.uid(), ARRAY['admin','principal','bursar','admin_supervisor']::app_role[]));
CREATE POLICY "Staff manage access grants" ON public.access_grants FOR ALL TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin','principal','bursar','admin_supervisor']::app_role[])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','principal','bursar','admin_supervisor']::app_role[]));