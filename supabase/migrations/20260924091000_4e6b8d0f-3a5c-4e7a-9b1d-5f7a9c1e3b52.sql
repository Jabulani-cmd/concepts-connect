-- ============================================
-- FUNCTION PERMISSIONS AND CONTACT DIRECTORY
-- * delete_student_cascade could be called by anyone, even without signing in,
--   and deleted any student. It now requires a school administrator.
-- * get_exam_rankings answers only for staff, the student and their parents.
-- * Privileged (SECURITY DEFINER) functions are no longer callable by visitors
--   who aren't signed in, except the two the public website uses:
--   get_staff_directory and lookup_student_for_payment.
-- * Role assignments are readable only by staff and by each user for themself;
--   the messaging contact list comes from get_contact_directory() instead.
-- Idempotent: safe to run more than once.
-- ============================================
CREATE OR REPLACE FUNCTION public.delete_student_cascade(_student_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_school_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only a school administrator can delete students' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.parent_students WHERE student_id = _student_id;
  DELETE FROM public.parent_student_links WHERE student_id = _student_id;
  DELETE FROM public.student_classes WHERE student_id = _student_id;
  DELETE FROM public.students WHERE id = _student_id;
END $$;

CREATE OR REPLACE FUNCTION public.get_exam_rankings(p_exam_id uuid, p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  -- Only staff, the student and their parents may see a student's rankings.
  IF NOT public.can_view_student(auth.uid(), p_student_id) THEN
    RETURN '{}'::jsonb;
  END IF;
  WITH student_totals AS (
    SELECT student_id, SUM(mark) AS total_mark
    FROM exam_results
    WHERE exam_id = p_exam_id
    GROUP BY student_id
  ),
  ranked_totals AS (
    SELECT student_id,
           RANK() OVER (ORDER BY total_mark DESC) AS overall_rank,
           COUNT(*) OVER () AS total_students
    FROM student_totals
  ),
  subject_ranks AS (
    SELECT student_id, subject_id,
           RANK() OVER (PARTITION BY subject_id ORDER BY mark DESC) AS subject_rank,
           COUNT(*) OVER (PARTITION BY subject_id) AS subject_total
    FROM exam_results
    WHERE exam_id = p_exam_id AND subject_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'overall_rank', rt.overall_rank,
    'total_students', rt.total_students,
    'subject_rankings', (
      SELECT jsonb_object_agg(sr.subject_id::text, jsonb_build_object('rank', sr.subject_rank, 'total', sr.subject_total))
      FROM subject_ranks sr
      WHERE sr.student_id = p_student_id
    )
  ) INTO result
  FROM ranked_totals rt
  WHERE rt.student_id = p_student_id;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$function$;

-- Messaging contacts: people the signed-in user may see, with their role.
CREATE OR REPLACE FUNCTION public.get_contact_directory(_search text DEFAULT NULL, _limit int DEFAULT 100)
RETURNS TABLE (id uuid, full_name text, email text, avatar_url text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email, p.avatar_url,
         (SELECT r.role::text FROM public.user_roles r WHERE r.user_id = p.id
          ORDER BY CASE WHEN r.role::text IN ('student', 'parent') THEN 1 ELSE 0 END LIMIT 1) AS role
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id)
    AND public.can_view_profile(auth.uid(), p.id)
    AND (_search IS NULL OR length(_search) < 2 OR p.full_name ILIKE '%' || _search || '%')
  ORDER BY p.full_name
  LIMIT least(greatest(coalesce(_limit, 100), 1), 200);
$$;

DROP POLICY IF EXISTS user_roles_read_directory ON public.user_roles;
DROP POLICY IF EXISTS user_roles_read_staff ON public.user_roles;
CREATE POLICY user_roles_read_staff ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid()));

-- Signed-out visitors may call only the functions the public website needs.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
      IF r.proname IN ('get_staff_directory', 'lookup_student_for_payment') THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.sig);
      END IF;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'skipped %', r.sig;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
