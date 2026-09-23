CREATE OR REPLACE FUNCTION public.can_access_private_file(_uid uuid, _path text, _write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id uuid;
BEGIN
  IF _uid IS NULL OR _path IS NULL THEN RETURN false; END IF;

  IF _path ~* '^receipts/' THEN
    IF public.is_finance_staff(_uid) THEN RETURN true; END IF;
    _id := substring(_path FROM '^receipts/([0-9a-fA-F-]{36})\.pdf$')::uuid;
    IF _id IS NULL THEN RETURN false; END IF;
    RETURN EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = _id
        AND (p.parent_id = _uid OR p.recorded_by = _uid OR public.is_student_or_parent(_uid, p.student_id))
    );
  END IF;

  IF _path ~* '^submissions/' THEN
    _id := substring(_path FROM '^submissions/([0-9a-fA-F-]{36})/')::uuid;
    IF _id IS NULL THEN RETURN public.is_school_admin(_uid); END IF;
    IF _write THEN
      RETURN public.is_school_staff(_uid)
        OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = _id AND s.user_id = _uid);
    END IF;
    RETURN public.can_view_student(_uid, _id);
  END IF;

  RETURN public.is_school_admin(_uid);
END $$;
REVOKE ALL ON FUNCTION public.can_access_private_file(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_private_file(uuid, text, boolean) TO authenticated, service_role;

DROP POLICY IF EXISTS school_private_read ON storage.objects;
CREATE POLICY school_private_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'school-private' AND public.can_access_private_file(auth.uid(), objects.name, false));

DROP POLICY IF EXISTS school_private_insert ON storage.objects;
CREATE POLICY school_private_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'school-private' AND public.can_access_private_file(auth.uid(), objects.name, true));

DROP POLICY IF EXISTS school_private_update ON storage.objects;
CREATE POLICY school_private_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'school-private' AND public.can_access_private_file(auth.uid(), objects.name, true))
  WITH CHECK (bucket_id = 'school-private' AND public.can_access_private_file(auth.uid(), objects.name, true));

DROP POLICY IF EXISTS school_private_delete ON storage.objects;
CREATE POLICY school_private_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'school-private' AND (owner_id = (auth.uid())::text OR public.is_school_admin(auth.uid())));

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'skipped %', r.sig;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';