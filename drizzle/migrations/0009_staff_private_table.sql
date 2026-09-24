-- ============================================
-- STAFF HR DETAILS IN THEIR OWN TABLE
-- National ID, NSSA and PAYE numbers, bank details, home address and emergency
-- contact move out of `staff` (which every staff member can read) into
-- `staff_private`, readable only by school administrators and by the staff
-- member themself. Existing values are copied across, then the columns are
-- dropped from `staff`.
-- Idempotent: safe to run more than once.
-- ============================================
CREATE TABLE IF NOT EXISTS public.staff_private (
  staff_id uuid PRIMARY KEY REFERENCES public.staff(id) ON DELETE CASCADE,
  national_id text,
  nssa_number text,
  paye_number text,
  bank_details text,
  address text,
  emergency_contact text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_private_admin_all ON public.staff_private;
CREATE POLICY staff_private_admin_all ON public.staff_private FOR ALL TO authenticated
  USING (public.is_school_admin(auth.uid())) WITH CHECK (public.is_school_admin(auth.uid()));
DROP POLICY IF EXISTS staff_private_self_read ON public.staff_private;
CREATE POLICY staff_private_self_read ON public.staff_private FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND s.user_id = auth.uid()));

REVOKE ALL ON public.staff_private FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_private TO authenticated;
GRANT ALL ON public.staff_private TO service_role;

-- Copy existing values, then drop the columns from staff.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'national_id') THEN
    INSERT INTO public.staff_private (staff_id, national_id, nssa_number, paye_number, bank_details, address, emergency_contact)
    SELECT id, national_id, nssa_number, paye_number, bank_details, address, emergency_contact
    FROM public.staff
    WHERE coalesce(national_id, nssa_number, paye_number, bank_details, address, emergency_contact) IS NOT NULL
    ON CONFLICT (staff_id) DO UPDATE SET
      national_id = coalesce(EXCLUDED.national_id, staff_private.national_id),
      nssa_number = coalesce(EXCLUDED.nssa_number, staff_private.nssa_number),
      paye_number = coalesce(EXCLUDED.paye_number, staff_private.paye_number),
      bank_details = coalesce(EXCLUDED.bank_details, staff_private.bank_details),
      address = coalesce(EXCLUDED.address, staff_private.address),
      emergency_contact = coalesce(EXCLUDED.emergency_contact, staff_private.emergency_contact),
      updated_at = now();

    ALTER TABLE public.staff
      DROP COLUMN IF EXISTS national_id,
      DROP COLUMN IF EXISTS nssa_number,
      DROP COLUMN IF EXISTS paye_number,
      DROP COLUMN IF EXISTS bank_details,
      DROP COLUMN IF EXISTS address,
      DROP COLUMN IF EXISTS emergency_contact;
  END IF;
END $$;

-- Nothing sensitive is left in staff, so staff may read it normally again.
GRANT SELECT ON public.staff TO authenticated;

CREATE OR REPLACE FUNCTION public.get_staff_private(_staff_ids uuid[])
RETURNS TABLE (id uuid, national_id text, nssa_number text, paye_number text, bank_details text, address text, emergency_contact text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, p.national_id, p.nssa_number, p.paye_number, p.bank_details, p.address, p.emergency_contact
  FROM public.staff s
  LEFT JOIN public.staff_private p ON p.staff_id = s.id
  WHERE s.id = ANY (_staff_ids)
    AND (public.is_school_admin(auth.uid()) OR s.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.get_staff_private(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_private(uuid[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
