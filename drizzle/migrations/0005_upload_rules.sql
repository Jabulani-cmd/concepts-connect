-- ============================================
-- UPLOAD RULES
-- Signed-in users could add files anywhere in the school-media and
-- profile-photos buckets, including other people's photo folders. Uploads are
-- now limited to the folders each kind of user legitimately writes to:
--   staff ............................. anywhere (photos, site images, materials, announcements)
--   the student ....................... submissions/<their students.id>/...
--   anyone signed in .................. receipts/... (online fee payments)
--   profile-photos bucket ............. staff, or a user in their own <user id>/ folder
-- Replacing or deleting files is already limited to the uploader and administrators.
-- Idempotent: safe to run more than once.
-- ============================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd = 'INSERT'
      AND coalesce(with_check, '') ~ '(school-media|profile-photos)'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY school_media_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'school-media' AND (
      public.is_school_staff(auth.uid())
      OR (storage.foldername(name))[1] = 'receipts'
      -- objects.name is qualified: students also has a "name" column.
      OR ((storage.foldername(objects.name))[1] = 'submissions' AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id::text = (storage.foldername(objects.name))[2] AND s.user_id = auth.uid()))
    )
  );

CREATE POLICY profile_photos_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos' AND (
      public.is_school_staff(auth.uid())
      OR (storage.foldername(name))[1] = (auth.uid())::text
    )
  );
