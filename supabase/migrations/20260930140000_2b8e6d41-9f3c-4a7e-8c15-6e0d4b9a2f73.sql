-- ============================================
-- SCHOOL AGENT: REPORTS AND FAMILY ALERTS
-- * New findings: learners performing poorly (not only those slipping) and
--   teachers away with lessons still to cover.
-- * Alert settings (parents and learners on/off, pass and excellence marks),
--   changed by school leaders through set_agent_alert_settings().
-- * agent_alert_log: one row per alert sent, so no family gets the same alert twice.
-- * agent_reports: the daily school report for the principal and administrators.
-- * agent_student_performance(): each learner's recent marks and attendance.
-- Idempotent: safe to run more than once.
-- ============================================

-- ---------- New kinds of finding ----------
ALTER TABLE public.agent_findings DROP CONSTRAINT IF EXISTS agent_findings_kind_check;
ALTER TABLE public.agent_findings ADD CONSTRAINT agent_findings_kind_check
  CHECK (kind IN ('at_risk', 'attendance_not_taken', 'marks_overdue', 'fee_arrears', 'low_performance', 'teacher_absent'));

-- ---------- Alert settings ----------
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS notify_parents boolean NOT NULL DEFAULT true;
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS notify_students boolean NOT NULL DEFAULT true;
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS low_mark numeric NOT NULL DEFAULT 45;
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS excellent_mark numeric NOT NULL DEFAULT 75;
INSERT INTO public.agent_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_agent_alert_settings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  IF NOT (public.is_school_admin(auth.uid()) OR public.has_role(auth.uid(), 'hod'::app_role)) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT notify_parents, notify_students, low_mark, excellent_mark INTO s FROM public.agent_settings WHERE id = 1;
  RETURN jsonb_build_object('notify_parents', s.notify_parents, 'notify_students', s.notify_students,
                            'low_mark', s.low_mark, 'excellent_mark', s.excellent_mark);
END $$;

CREATE OR REPLACE FUNCTION public.set_agent_alert_settings(_notify_parents boolean, _notify_students boolean, _low_mark numeric, _excellent_mark numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_school_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only school leaders can change alert settings' USING ERRCODE = '42501';
  END IF;
  IF _low_mark < 0 OR _low_mark > 100 OR _excellent_mark < 0 OR _excellent_mark > 100 OR _low_mark >= _excellent_mark THEN
    RAISE EXCEPTION 'Marks must be between 0 and 100, with the support mark below the excellence mark';
  END IF;
  UPDATE public.agent_settings
     SET notify_parents = _notify_parents, notify_students = _notify_students,
         low_mark = _low_mark, excellent_mark = _excellent_mark, updated_at = now()
   WHERE id = 1;
END $$;

REVOKE ALL ON FUNCTION public.get_agent_alert_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_agent_alert_settings(boolean, boolean, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agent_alert_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_agent_alert_settings(boolean, boolean, numeric, numeric) TO authenticated, service_role;

-- ---------- Alerts already sent ----------
CREATE TABLE IF NOT EXISTS public.agent_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  kind text NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  recipients integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_alert_log_student_idx ON public.agent_alert_log (student_id, created_at);
ALTER TABLE public.agent_alert_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_alert_log FROM anon, authenticated;
DROP POLICY IF EXISTS agent_alert_log_read ON public.agent_alert_log;
CREATE POLICY agent_alert_log_read ON public.agent_alert_log FOR SELECT TO authenticated
  USING (public.is_school_admin(auth.uid()));
GRANT SELECT ON public.agent_alert_log TO authenticated;
GRANT ALL ON public.agent_alert_log TO service_role;

-- ---------- Daily school report ----------
CREATE TABLE IF NOT EXISTS public.agent_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  summary_source text NOT NULL DEFAULT 'rules',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_reports FROM anon;
DROP POLICY IF EXISTS agent_reports_read ON public.agent_reports;
CREATE POLICY agent_reports_read ON public.agent_reports FOR SELECT TO authenticated
  USING (public.is_school_admin(auth.uid()));
GRANT SELECT ON public.agent_reports TO authenticated;
GRANT ALL ON public.agent_reports TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'agent_reports') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_reports;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Realtime not enabled for agent_reports (%)', SQLERRM;
END $$;

-- ---------- Learners' recent marks and attendance ----------
CREATE OR REPLACE FUNCTION public.agent_student_performance(_days integer DEFAULT 28)
RETURNS TABLE (
  student_id uuid, full_name text, class_id uuid, class_name text, form text,
  recent_avg numeric, subjects jsonb, marks_count integer,
  attendance_pct numeric, days_absent integer, absent_today boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH learners AS (
    SELECT DISTINCT ON (s.id) s.id AS student_id, s.full_name, sc.class_id, c.name AS class_name, s.form
    FROM public.students s
    JOIN public.student_classes sc ON sc.student_id = s.id
    JOIN public.classes c ON c.id = sc.class_id
    WHERE coalesce(s.status, 'active') = 'active'
    ORDER BY s.id, sc.created_at DESC
  ),
  scores AS (
    SELECT m.student_id, m.subject_id,
      CASE WHEN coalesce(m.out_of, 0) > 0 THEN m.mark * 100.0 / m.out_of ELSE m.mark END AS pct,
      m.created_at::date AS d
    FROM public.marks m WHERE m.mark IS NOT NULL
    UNION ALL
    SELECT er.student_id, er.subject_id, er.mark, coalesce(e.end_date, e.start_date, er.created_at::date)
    FROM public.exam_results er LEFT JOIN public.exams e ON e.id = er.exam_id WHERE er.mark IS NOT NULL
    UNION ALL
    SELECT ar.student_id, a.subject_id, ar.percentage, coalesce(ar.graded_date, ar.created_at)::date
    FROM public.assessment_results ar JOIN public.assessments a ON a.id = ar.assessment_id
    WHERE ar.percentage IS NOT NULL AND a.subject_id IS NOT NULL
  ),
  subj AS (
    SELECT sc.student_id, sub.name AS subject, round(avg(sc.pct), 1) AS avg, count(*)::int AS n
    FROM scores sc JOIN public.subjects sub ON sub.id = sc.subject_id
    WHERE sc.d >= current_date - _days AND sc.d <= current_date AND sc.pct BETWEEN 0 AND 100
    GROUP BY sc.student_id, sub.name
  ),
  subj_json AS (
    SELECT student_id, jsonb_agg(jsonb_build_object('subject', subject, 'avg', avg, 'n', n) ORDER BY avg) AS subjects,
      round(avg(avg), 1) AS recent_avg, sum(n)::int AS marks_count
    FROM subj GROUP BY student_id
  ),
  att AS (
    SELECT a.student_id,
      round(100.0 * count(*) FILTER (WHERE lower(a.status) IN ('present', 'late')) / nullif(count(*), 0), 1) AS pct,
      count(*) FILTER (WHERE lower(a.status) = 'absent')::int AS absent,
      bool_or(a.date = current_date AND lower(a.status) = 'absent') AS absent_today
    FROM public.attendance a
    WHERE a.date >= current_date - _days AND a.date <= current_date
    GROUP BY a.student_id
  )
  SELECT l.student_id, l.full_name, l.class_id, l.class_name, l.form,
    sj.recent_avg, coalesce(sj.subjects, '[]'::jsonb), coalesce(sj.marks_count, 0),
    at.pct, coalesce(at.absent, 0), coalesce(at.absent_today, false)
  FROM learners l
  LEFT JOIN subj_json sj ON sj.student_id = l.student_id
  LEFT JOIN att at ON at.student_id = l.student_id;
$$;
REVOKE ALL ON FUNCTION public.agent_student_performance(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_student_performance(integer) TO service_role;

NOTIFY pgrst, 'reload schema';
