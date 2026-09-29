-- ============================================
-- SUPPORT STAFF ROLES
-- Portal roles for the school's support posts, each working in the part of the
-- system that already holds their records:
--   boarding ...... boarding master / housemaster and matron: hostels, rooms,
--                   bed allocations and sick-bay visits of boarders
--   nurse ......... sister-in-charge (school nurse): sick-bay visits
--   librarian ..... textbook loans and library stock
--   storekeeper ... stores clerk and laboratory technician: inventory
-- Like every other staff role they count as school staff for reading
-- (is_school_staff), so they can look up the students they look after.
-- Leadership, finance, admissions and heads of department use roles that
-- already exist (principal, deputy_principal, admin_supervisor, bursar,
-- finance_clerk, registration, hod).
-- Policies compare role names as text, so the new enum values are not used in
-- this transaction and the whole file can run at once. Idempotent.
-- ============================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'boarding';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'nurse';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'librarian';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'storekeeper';

-- True when the user holds any of the named roles.
CREATE OR REPLACE FUNCTION public.has_role_named(_uid uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role::text = ANY (_roles)
  );
$$;
REVOKE ALL ON FUNCTION public.has_role_named(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role_named(uuid, text[]) TO authenticated, service_role;

-- Full access to a table for the given roles.
CREATE OR REPLACE FUNCTION pg_temp.manage_policy(_table text, _name text, _roles text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF to_regclass('public.' || _table) IS NULL THEN RETURN; END IF;
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _name, _table);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role_named(auth.uid(), %L::text[])) WITH CHECK (public.has_role_named(auth.uid(), %L::text[]))',
    _name, _table, _roles, _roles);
END $$;

-- Boarding: hostels, rooms and who sleeps where.
SELECT pg_temp.manage_policy(t, t || '_boarding_manage', '{boarding}')
FROM unnest(ARRAY['hostels', 'rooms', 'bed_allocations']) AS t;

-- Sick bay: the nurse and boarding staff record and read visits.
SELECT pg_temp.manage_policy('health_visits', 'health_visits_sick_bay_manage', '{nurse,boarding}');

-- Library and stores: stock, stock movements and textbook loans.
SELECT pg_temp.manage_policy(t, t || '_stores_manage', '{storekeeper,librarian}')
FROM unnest(ARRAY['inventory_categories', 'inventory_items', 'inventory_transactions', 'textbook_issues']) AS t;

NOTIFY pgrst, 'reload schema';
