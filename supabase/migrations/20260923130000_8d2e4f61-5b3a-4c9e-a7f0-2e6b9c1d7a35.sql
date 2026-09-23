-- ============================================
-- STAFF DIRECTORY WITHOUT A SECURITY-DEFINER VIEW
-- The staff_public view bypassed row security (Supabase flags such views as a
-- critical finding). The public staff page and the student timetable now use
-- get_staff_directory(), which returns only names, titles, departments, bios,
-- photos and qualifications of active staff, and nothing else.
-- Idempotent: safe to run more than once.
-- ============================================
CREATE OR REPLACE FUNCTION public.get_staff_directory(_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  id uuid, full_name text, title text, department text, category text,
  bio text, photo_url text, qualifications text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.full_name, s.title, s.department, s.category, s.bio, s.photo_url, s.qualifications
  FROM public.staff s
  WHERE coalesce(s.status, 'active') = 'active'
    AND (_ids IS NULL OR s.id = ANY (_ids))
  ORDER BY s.full_name;
$$;
REVOKE ALL ON FUNCTION public.get_staff_directory(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_directory(uuid[]) TO anon, authenticated, service_role;

DROP VIEW IF EXISTS public.staff_public;

NOTIFY pgrst, 'reload schema';
