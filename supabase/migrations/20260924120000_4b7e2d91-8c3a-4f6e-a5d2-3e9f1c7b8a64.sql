-- ============================================
-- LIMIT WHO CAN READ CLASSES, ASSESSMENTS, EXAMS, FEE STRUCTURES AND HOSTELS
-- Until now any signed-in user could read every row of these tables.
-- * classes, class_subjects: staff see all; students and parents see only
--   the classes the student is in.
-- * assessments: staff see all; students and parents see published
--   assessments for the student's classes (or school-wide ones), plus any
--   assessment the student already has a result or submission for.
-- * exams: staff see all; students and parents see published exams.
-- * fee_structures: office staff (admin, finance, HOD, registration) only.
-- * hostels (contact phone numbers): staff only.
-- Idempotent: safe to run more than once.
-- ============================================

-- True when the user is a student in the class, or the parent of one.
CREATE OR REPLACE FUNCTION public.in_class(_uid uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND _class_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.student_classes sc
    WHERE sc.class_id = _class_id AND public.is_student_or_parent(_uid, sc.student_id)
  );
$$;
REVOKE ALL ON FUNCTION public.in_class(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.in_class(uuid, uuid) TO authenticated, service_role;

-- ---------- classes ----------
DROP POLICY IF EXISTS classes_auth_read ON public.classes;
DROP POLICY IF EXISTS classes_read_scoped ON public.classes;
CREATE POLICY classes_read_scoped ON public.classes FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid()) OR public.in_class(auth.uid(), id));

-- ---------- class_subjects ----------
DROP POLICY IF EXISTS class_subjects_auth_read ON public.class_subjects;
DROP POLICY IF EXISTS class_subjects_read_scoped ON public.class_subjects;
CREATE POLICY class_subjects_read_scoped ON public.class_subjects FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid()) OR public.in_class(auth.uid(), class_id));

-- ---------- assessments ----------
DROP POLICY IF EXISTS assessments_auth_read ON public.assessments;
DROP POLICY IF EXISTS assessments_read_scoped ON public.assessments;
CREATE POLICY assessments_read_scoped ON public.assessments FOR SELECT TO authenticated
  USING (
    public.is_school_staff(auth.uid())
    OR (is_published
        AND public.has_any_role(auth.uid(), ARRAY['student'::app_role, 'parent'::app_role])
        AND (class_id IS NULL OR public.in_class(auth.uid(), class_id)))
    OR EXISTS (SELECT 1 FROM public.assessment_results r
               WHERE r.assessment_id = assessments.id AND public.is_student_or_parent(auth.uid(), r.student_id))
    OR EXISTS (SELECT 1 FROM public.assessment_submissions s
               WHERE s.assessment_id = assessments.id AND public.is_student_or_parent(auth.uid(), s.student_id))
  );

-- ---------- exams ----------
DROP POLICY IF EXISTS exams_auth_read ON public.exams;
DROP POLICY IF EXISTS exams_read_scoped ON public.exams;
CREATE POLICY exams_read_scoped ON public.exams FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid())
         OR (is_published AND public.has_any_role(auth.uid(), ARRAY['student'::app_role, 'parent'::app_role])));

-- ---------- fee_structures ----------
DROP POLICY IF EXISTS fee_structures_auth_read ON public.fee_structures;
DROP POLICY IF EXISTS fee_structures_office_read ON public.fee_structures;
CREATE POLICY fee_structures_office_read ON public.fee_structures FOR SELECT TO authenticated
  USING (public.is_office_staff(auth.uid()));

-- ---------- hostels ----------
DROP POLICY IF EXISTS hostels_auth_read ON public.hostels;
DROP POLICY IF EXISTS hostels_staff_read ON public.hostels;
CREATE POLICY hostels_staff_read ON public.hostels FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid()));

NOTIFY pgrst, 'reload schema';
