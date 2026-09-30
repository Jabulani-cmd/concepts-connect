-- ============================================
-- TEACHER COVER (SUBSTITUTES)
-- * timetable_cover: one row per lesson covered on a date, with the teacher who is
--   away and the teacher covering. Filled from the Cover Agent in the portal.
-- * School leaders, deputies, admin supervisors and HODs assign cover; each teacher
--   can see the cover they have been given and the cover arranged for their classes.
-- Idempotent: safe to run more than once.
-- ============================================

CREATE TABLE IF NOT EXISTS public.timetable_cover (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_date date NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  room text,
  absent_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  cover_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  reason text,
  note text,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'cancelled')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cover_date, class_id, start_time)
);

CREATE INDEX IF NOT EXISTS timetable_cover_date_idx ON public.timetable_cover (cover_date);
CREATE INDEX IF NOT EXISTS timetable_cover_cover_staff_idx ON public.timetable_cover (cover_staff_id, cover_date);

ALTER TABLE public.timetable_cover ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timetable_cover_manage ON public.timetable_cover;
CREATE POLICY timetable_cover_manage ON public.timetable_cover FOR ALL TO authenticated
  USING (public.is_school_admin(auth.uid()) OR public.has_role(auth.uid(), 'hod'::public.app_role))
  WITH CHECK (public.is_school_admin(auth.uid()) OR public.has_role(auth.uid(), 'hod'::public.app_role));

DROP POLICY IF EXISTS timetable_cover_own_read ON public.timetable_cover;
CREATE POLICY timetable_cover_own_read ON public.timetable_cover FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.user_id = auth.uid() AND s.id IN (timetable_cover.cover_staff_id, timetable_cover.absent_staff_id)
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_cover TO authenticated;

-- Open screens update as soon as cover is assigned.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'timetable_cover') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.timetable_cover;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Realtime not enabled for timetable_cover (%)', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
