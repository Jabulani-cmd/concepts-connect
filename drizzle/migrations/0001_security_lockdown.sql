-- ============================================
-- SECURITY LOCKDOWN
-- Replaces "any signed-in user can read everything" rules with role- and
-- relationship-based access, removes anonymous write access, protects staff
-- personal data at column level and stops users overwriting each other's files.
--
-- Who may see what after this migration:
--   student records, marks, attendance, reports ... school staff, the student, their linked parents
--   health visits .................................. school administrators, the student, their linked parents
--   invoices ....................................... office staff (finance, admin, HOD, registration), the student, their parents
--   expenses, petty cash, suppliers, bank details .. finance staff
--   staff records .................................. school staff (not students/parents); ID, bank,
--                                                    NSSA/PAYE, address and emergency contact only via
--                                                    get_staff_private() for administrators and the staff member
--   messages / conversations ....................... participants (and administrators)
--   notifications .................................. the recipient (and administrators)
--   profiles ....................................... self, family, conversation partners; staff see everyone,
--                                                    everyone sees staff
-- Idempotent: safe to run more than once.
-- ============================================

-- --------------------------------------------
-- Helper functions (SECURITY DEFINER so policies can use them without recursion)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.is_school_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role NOT IN ('student'::app_role, 'parent'::app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_finance_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_finance_admin(_uid) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('finance'::app_role, 'finance_clerk'::app_role)
  );
$$;

-- Finance plus the offices that clear students for registration.
CREATE OR REPLACE FUNCTION public.is_office_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_finance_staff(_uid) OR public.is_school_admin(_uid) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('hod'::app_role, 'registration'::app_role)
  );
$$;

-- The student themself or one of their linked parents. `_student_id` may be the
-- students.id or the student's login id (older rows use either).
CREATE OR REPLACE FUNCTION public.is_student_or_parent(_uid uuid, _student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND _student_id IS NOT NULL AND (
    _student_id = _uid
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = _student_id AND s.user_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.parent_students ps
      WHERE ps.parent_id = _uid
        AND (ps.student_id = _student_id
             OR ps.student_id = (SELECT s.user_id FROM public.students s WHERE s.id = _student_id)
             OR (SELECT s.user_id FROM public.students s WHERE s.id = ps.student_id) = _student_id)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_student(_uid uuid, _student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_school_staff(_uid) OR public.is_student_or_parent(_uid, _student_id);
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer = _target
    OR public.is_school_staff(_viewer)
    OR public.is_school_staff(_target)
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants a
      JOIN public.conversation_participants b ON b.conversation_id = a.conversation_id
      WHERE a.user_id = _viewer AND b.user_id = _target
    )
    OR EXISTS (
      SELECT 1 FROM public.parent_students ps
      LEFT JOIN public.students s ON s.id = ps.student_id
      WHERE (ps.parent_id = _viewer AND (ps.student_id = _target OR s.user_id = _target))
         OR (ps.parent_id = _target AND (ps.student_id = _viewer OR s.user_id = _viewer))
    );
$$;

REVOKE ALL ON FUNCTION public.is_school_staff(uuid), public.is_finance_staff(uuid), public.is_office_staff(uuid),
  public.is_student_or_parent(uuid, uuid), public.can_view_student(uuid, uuid),
  public.is_conversation_member(uuid, uuid), public.can_view_profile(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_school_staff(uuid), public.is_finance_staff(uuid), public.is_office_staff(uuid),
  public.is_student_or_parent(uuid, uuid), public.can_view_student(uuid, uuid),
  public.is_conversation_member(uuid, uuid), public.can_view_profile(uuid, uuid) TO authenticated, service_role;

-- --------------------------------------------
-- Remove the blanket read rules. Any SELECT rule on these tables that lets
-- everyone (or every signed-in user) read every row is dropped, whatever it is named.
-- --------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'SELECT'
      AND replace(coalesce(qual, ''), ' ', '') IN ('true', '(auth.uid()ISNOTNULL)', '(auth.role()=''authenticated''::text)')
      AND tablename IN (
        'students', 'attendance', 'marks', 'exam_results', 'assessment_results', 'assessment_submissions',
        'term_reports', 'term_registrations', 'enrollments', 'bed_allocations', 'textbook_issues',
        'student_classes', 'homework_submissions', 'health_visits',
        'invoices', 'invoice_items', 'expenses', 'petty_cash', 'supplier_invoices', 'supplier_payments',
        'finance_approval_requests', 'school_bank_details', 'audit_logs',
        'staff', 'leave_requests', 'profiles',
        'messages', 'conversations', 'conversation_participants', 'notifications',
        'communication_logs', 'sms_templates', 'parent_communication_logs',
        'parent_students', 'parent_student_links', 'personal_timetables',
        'user_blocks', 'user_reports', 'appointments', 'lesson_plans', 'teacher_resources',
        'inventory_categories', 'inventory_items', 'inventory_transactions'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Helper to (re)create a SELECT policy idempotently.
CREATE OR REPLACE FUNCTION pg_temp.read_policy(_table text, _name text, _using text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _name, _table);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', _name, _table, _using);
END $$;

-- --------------------------------------------
-- Student records: staff, the student and their parents
-- --------------------------------------------
SELECT pg_temp.read_policy('students', 'students_read_scoped', 'public.can_view_student(auth.uid(), id)');
SELECT pg_temp.read_policy(t, t || '_read_scoped', 'public.can_view_student(auth.uid(), student_id)')
FROM unnest(ARRAY[
  'attendance', 'marks', 'exam_results', 'assessment_results', 'assessment_submissions',
  'term_reports', 'term_registrations', 'enrollments', 'bed_allocations', 'textbook_issues',
  'student_classes', 'homework_submissions'
]) AS t
WHERE to_regclass('public.' || t) IS NOT NULL;

-- Medical: administrators, the student and their parents only.
SELECT pg_temp.read_policy('health_visits', 'health_visits_read_scoped',
  'public.is_school_admin(auth.uid()) OR public.is_student_or_parent(auth.uid(), student_id)');

-- Homework submissions were writable by anyone signed in.
DROP POLICY IF EXISTS hw_sub_write ON public.homework_submissions;
DROP POLICY IF EXISTS homework_submissions_staff_write ON public.homework_submissions;
CREATE POLICY homework_submissions_staff_write ON public.homework_submissions FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid())) WITH CHECK (public.is_school_staff(auth.uid()));
DROP POLICY IF EXISTS homework_submissions_student_write ON public.homework_submissions;
-- Students manage their own submissions (parents can read them, not change them).
CREATE POLICY homework_submissions_student_write ON public.homework_submissions FOR ALL TO authenticated
  USING (student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()))
  WITH CHECK (student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));

-- Family links: staff, the student and the parent.
SELECT pg_temp.read_policy('parent_students', 'parent_students_read_scoped',
  'parent_id = auth.uid() OR public.can_view_student(auth.uid(), student_id)');
SELECT pg_temp.read_policy('parent_student_links', 'parent_student_links_read_scoped',
  'parent_id = auth.uid() OR public.can_view_student(auth.uid(), student_id)');

-- --------------------------------------------
-- Finance
-- --------------------------------------------
SELECT pg_temp.read_policy('invoices', 'invoices_read_scoped',
  'public.is_office_staff(auth.uid()) OR public.is_student_or_parent(auth.uid(), student_id)');
SELECT pg_temp.read_policy('invoice_items', 'invoice_items_read_scoped',
  'EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id
           AND (public.is_office_staff(auth.uid()) OR public.is_student_or_parent(auth.uid(), i.student_id)))');
SELECT pg_temp.read_policy(t, t || '_read_finance', 'public.is_finance_staff(auth.uid())')
FROM unnest(ARRAY['expenses', 'petty_cash', 'supplier_invoices', 'supplier_payments', 'school_bank_details']) AS t;
SELECT pg_temp.read_policy('finance_approval_requests', 'finance_approval_requests_read_scoped',
  'public.is_finance_staff(auth.uid()) OR requested_by = auth.uid()');
SELECT pg_temp.read_policy('audit_logs', 'audit_logs_read_scoped',
  'public.is_school_admin(auth.uid()) OR public.is_finance_staff(auth.uid())');

-- Payers need the school's receiving account, but not the whole row.
CREATE OR REPLACE FUNCTION public.get_school_bank_details()
RETURNS TABLE (bank_name text, account_name text, account_number text, branch text, swift_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.bank_name, b.account_name, b.account_number, b.branch, b.swift_code
  FROM public.school_bank_details b
  WHERE b.is_active
  ORDER BY b.updated_at DESC NULLS LAST
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_school_bank_details() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_school_bank_details() TO authenticated, service_role;

-- --------------------------------------------
-- Staff: staff can see colleagues; personal columns are admin/self only
-- --------------------------------------------
DROP POLICY IF EXISTS staff_public_read ON public.staff;
SELECT pg_temp.read_policy('staff', 'staff_read_scoped', 'public.is_school_staff(auth.uid()) OR user_id = auth.uid()');

REVOKE SELECT ON public.staff FROM anon, authenticated;
GRANT SELECT (
  id, staff_number, user_id, full_name, title, department, category, email, phone, bio, photo_url,
  qualifications, date_joined, status, created_at, updated_at, role, employment_date, subjects_taught
) ON public.staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO service_role;

CREATE OR REPLACE FUNCTION public.get_staff_private(_staff_ids uuid[])
RETURNS TABLE (id uuid, national_id text, nssa_number text, paye_number text, bank_details text, address text, emergency_contact text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.national_id, s.nssa_number, s.paye_number, s.bank_details, s.address, s.emergency_contact
  FROM public.staff s
  WHERE s.id = ANY (_staff_ids)
    AND (public.is_school_admin(auth.uid()) OR s.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.get_staff_private(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_private(uuid[]) TO authenticated, service_role;

-- Public staff directory for the website and for students/parents (names and bios only).
DROP VIEW IF EXISTS public.staff_public;
CREATE VIEW public.staff_public WITH (security_invoker = false) AS
  SELECT id, full_name, title, department, category, bio, photo_url, qualifications
  FROM public.staff
  WHERE coalesce(status, 'active') = 'active';
GRANT SELECT ON public.staff_public TO anon, authenticated, service_role;

-- Leave requests: own, HOD and administrators. (The old self rule compared the
-- staff record id with the login id, so teachers could never see their own.)
DROP POLICY IF EXISTS leave_self_manage ON public.leave_requests;
CREATE POLICY leave_self_manage ON public.leave_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND s.user_id = auth.uid()));
SELECT pg_temp.read_policy('leave_requests', 'leave_requests_read_scoped',
  'public.is_school_admin(auth.uid()) OR public.has_role(auth.uid(), ''hod''::app_role)');

-- --------------------------------------------
-- Messaging, notifications, profiles
-- --------------------------------------------
SELECT pg_temp.read_policy('conversations', 'conversations_read_members',
  'public.is_conversation_member(id, auth.uid()) OR created_by = auth.uid()');
SELECT pg_temp.read_policy('conversation_participants', 'conversation_participants_read_members',
  'user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid())');
SELECT pg_temp.read_policy('notifications', 'notifications_read_own', 'user_id = auth.uid()');
SELECT pg_temp.read_policy('profiles', 'profiles_read_directory', 'public.can_view_profile(auth.uid(), id)');
SELECT pg_temp.read_policy('user_roles', 'user_roles_read_directory',
  'public.is_school_staff(auth.uid()) OR role NOT IN (''student''::app_role, ''parent''::app_role)');
SELECT pg_temp.read_policy('user_blocks', 'user_blocks_read_own', 'blocked_by = auth.uid() OR public.is_school_admin(auth.uid())');
SELECT pg_temp.read_policy('user_reports', 'user_reports_read_own', 'reporter_id = auth.uid() OR public.is_school_admin(auth.uid())');
SELECT pg_temp.read_policy('personal_timetables', 'personal_timetables_read_own',
  'user_id = auth.uid() OR public.is_school_staff(auth.uid())');

-- Staff-only working data.
SELECT pg_temp.read_policy(t, t || '_read_staff', 'public.is_school_staff(auth.uid())')
FROM unnest(ARRAY[
  'communication_logs', 'sms_templates', 'parent_communication_logs', 'lesson_plans', 'teacher_resources',
  'inventory_categories', 'inventory_items', 'inventory_transactions'
]) AS t
WHERE to_regclass('public.' || t) IS NOT NULL;
SELECT pg_temp.read_policy('appointments', 'appointments_read_scoped',
  'public.is_school_staff(auth.uid()) OR parent_id = auth.uid() OR public.is_student_or_parent(auth.uid(), student_id)');

-- --------------------------------------------
-- Timetables: anyone could edit or delete them without signing in
-- --------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tt_definitions', 'tt_slots', 'tt_conflicts', 'tt_exam_slots', 'ai_timetable_logs'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS tt_def_public ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tt_slots_public ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tt_conf_public ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tt_exam_public ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ai_tt_public ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_read_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_school_staff(auth.uid())) WITH CHECK (public.is_school_staff(auth.uid()))', t || '_staff_write', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- --------------------------------------------
-- File storage: only the uploader (or an administrator) may replace or delete a file
-- --------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd IN ('UPDATE', 'DELETE', 'ALL')
      AND (coalesce(qual, '') ~ '(school-media|profile-photos)' OR coalesce(with_check, '') ~ '(school-media|profile-photos)')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS school_files_owner_update ON storage.objects;
CREATE POLICY school_files_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('school-media', 'profile-photos') AND (
    owner_id = (auth.uid())::text OR public.is_school_admin(auth.uid())
    OR (bucket_id = 'school-media' AND (storage.foldername(name))[1] = 'receipts' AND public.is_finance_staff(auth.uid()))))
  WITH CHECK (bucket_id IN ('school-media', 'profile-photos') AND (
    owner_id = (auth.uid())::text OR public.is_school_admin(auth.uid())
    OR (bucket_id = 'school-media' AND (storage.foldername(name))[1] = 'receipts' AND public.is_finance_staff(auth.uid()))));

DROP POLICY IF EXISTS school_files_owner_delete ON storage.objects;
CREATE POLICY school_files_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('school-media', 'profile-photos') AND (owner_id = (auth.uid())::text OR public.is_school_admin(auth.uid())));

NOTIFY pgrst, 'reload schema';
