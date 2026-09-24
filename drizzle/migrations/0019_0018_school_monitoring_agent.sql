-- ============================================
-- SCHOOL MONITORING AGENT
-- An agent (edge function "school-agent") checks the school's records and
-- raises findings for staff to review:
--   * at_risk               learners whose attendance, marks or homework have slipped
--   * attendance_not_taken  class registers not recorded today
--   * marks_overdue         assessments past due with most marks not entered
--   * fee_arrears           weekly summary of invoices unpaid 30+ days after due
-- Rules decide who is flagged; AI only writes the plain-language explanation.
-- Staff review every finding (acknowledge, action, or dismiss with a reason);
-- nothing is decided or sent automatically, and no disciplinary action is taken.
-- Idempotent: safe to run more than once.
-- ============================================

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL DEFAULT 'school-monitor',
  trigger text NOT NULL DEFAULT 'manual',          -- manual | auto | schedule
  triggered_by uuid,
  status text NOT NULL DEFAULT 'running',          -- running | completed | failed
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  model text,                                       -- AI model used for explanations, if any
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);

CREATE TABLE IF NOT EXISTS public.agent_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('at_risk', 'attendance_not_taken', 'marks_overdue', 'fee_arrears')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  title text NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE CASCADE,
  assigned_to uuid,                                 -- the staff user asked to review it
  score integer,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,       -- the numbers behind the finding
  explanation text,
  suggested_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation_source text NOT NULL DEFAULT 'rules', -- 'rules' or 'ai:<model>'
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'actioned', 'dismissed')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_findings_open_idx ON public.agent_findings (dedupe_key) WHERE status IN ('open', 'acknowledged');
CREATE INDEX IF NOT EXISTS agent_findings_assigned_idx ON public.agent_findings (assigned_to, status);
CREATE INDEX IF NOT EXISTS agent_findings_student_idx ON public.agent_findings (student_id);

-- Who may see a finding: school leaders and HODs; the assigned staff member; teachers of the
-- learner concerned; office staff for fee summaries. Learners and parents never see findings.
CREATE OR REPLACE FUNCTION public.can_see_agent_finding(_uid uuid, _assigned uuid, _kind text, _student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(_uid IS NOT NULL AND (
    public.is_school_admin(_uid)
    OR public.has_role(_uid, 'hod'::app_role)
    OR _assigned = _uid
    OR (_kind = 'fee_arrears' AND public.is_office_staff(_uid))
    OR (_student IS NOT NULL AND public.has_role(_uid, 'teacher'::app_role) AND public.can_teach_student(_uid, _student))
  ), false);
$$;

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_runs_read ON public.agent_runs;
CREATE POLICY agent_runs_read ON public.agent_runs FOR SELECT TO authenticated
  USING (public.is_school_admin(auth.uid()) OR public.has_role(auth.uid(), 'hod'::app_role));

DROP POLICY IF EXISTS agent_findings_read ON public.agent_findings;
CREATE POLICY agent_findings_read ON public.agent_findings FOR SELECT TO authenticated
  USING (public.can_see_agent_finding(auth.uid(), assigned_to, kind, student_id));

-- Only the agent (service role) writes; staff review through review_agent_finding().
REVOKE ALL ON public.agent_runs, public.agent_findings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.agent_runs, public.agent_findings FROM authenticated;
GRANT SELECT ON public.agent_runs, public.agent_findings TO authenticated;
GRANT ALL ON public.agent_runs, public.agent_findings TO service_role;

-- Staff review a finding. Dismissing needs a reason (the route to challenge a wrong result).
CREATE OR REPLACE FUNCTION public.review_agent_finding(_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.agent_findings%ROWTYPE;
BEGIN
  IF _status NOT IN ('open', 'acknowledged', 'actioned', 'dismissed') THEN
    RAISE EXCEPTION 'Unknown status %', _status;
  END IF;
  SELECT * INTO f FROM public.agent_findings WHERE id = _id;
  IF f.id IS NULL OR public.can_see_agent_finding(auth.uid(), f.assigned_to, f.kind, f.student_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Finding not found' USING ERRCODE = '42501';
  END IF;
  IF _status = 'dismissed' AND coalesce(trim(_note), '') = '' THEN
    RAISE EXCEPTION 'Please give a reason for dismissing this finding';
  END IF;
  UPDATE public.agent_findings
  SET status = _status, reviewed_by = auth.uid(), reviewed_at = now(),
      review_note = coalesce(nullif(trim(_note), ''), review_note), updated_at = now()
  WHERE id = _id;
END $$;

REVOKE ALL ON FUNCTION public.can_see_agent_finding(uuid, uuid, text, uuid), public.review_agent_finding(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_agent_finding(uuid, uuid, text, uuid), public.review_agent_finding(uuid, text, text) TO authenticated, service_role;

-- ---------- Learner signals (used by the agent only) ----------
-- Attendance and marks in the last _recent_days compared with the rest of the term
-- (up to _term_days back), plus homework missed. Scores come from marks, exam results
-- and assessment results, as percentages.
CREATE OR REPLACE FUNCTION public.agent_student_signals(_recent_days integer DEFAULT 28, _term_days integer DEFAULT 120)
RETURNS TABLE (
  student_id uuid, class_id uuid, class_name text, form text,
  attendance_before numeric, attendance_recent numeric,
  subjects jsonb, assignments_due integer, assignments_missed integer
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH params AS (
    SELECT current_date - _recent_days AS recent_from, current_date - _term_days AS term_from
  ),
  learners AS (
    SELECT DISTINCT ON (s.id) s.id AS student_id, sc.class_id, c.name AS class_name, s.form
    FROM public.students s
    JOIN public.student_classes sc ON sc.student_id = s.id
    JOIN public.classes c ON c.id = sc.class_id
    WHERE coalesce(s.status, 'active') = 'active'
    ORDER BY s.id, sc.created_at DESC
  ),
  att AS (
    SELECT a.student_id,
      round(100.0 * count(*) FILTER (WHERE a.date < p.recent_from AND lower(a.status) IN ('present', 'late'))
            / nullif(count(*) FILTER (WHERE a.date < p.recent_from), 0), 1) AS before_pct,
      round(100.0 * count(*) FILTER (WHERE a.date >= p.recent_from AND lower(a.status) IN ('present', 'late'))
            / nullif(count(*) FILTER (WHERE a.date >= p.recent_from), 0), 1) AS recent_pct,
      count(*) FILTER (WHERE a.date < p.recent_from) AS before_n,
      count(*) FILTER (WHERE a.date >= p.recent_from) AS recent_n
    FROM public.attendance a, params p
    WHERE a.date >= p.term_from AND a.date <= current_date
    GROUP BY a.student_id
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
    SELECT sc.student_id, sub.name AS subject,
      round(avg(sc.pct) FILTER (WHERE sc.d < p.recent_from), 1) AS before_avg,
      round(avg(sc.pct) FILTER (WHERE sc.d >= p.recent_from), 1) AS recent_avg
    FROM scores sc JOIN public.subjects sub ON sub.id = sc.subject_id, params p
    WHERE sc.d >= p.term_from
    GROUP BY sc.student_id, sub.name
  ),
  subj_json AS (
    SELECT student_id, jsonb_agg(jsonb_build_object('subject', subject, 'before', before_avg, 'recent', recent_avg) ORDER BY subject) AS subjects
    FROM subj WHERE before_avg IS NOT NULL AND recent_avg IS NOT NULL
    GROUP BY student_id
  ),
  hw AS (
    SELECT l.student_id,
      count(*)::int AS due,
      count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.assessment_submissions s WHERE s.assessment_id = a.id AND s.student_id = l.student_id)
                         AND NOT EXISTS (SELECT 1 FROM public.assessment_results r WHERE r.assessment_id = a.id AND r.student_id = l.student_id))::int AS missed
    FROM learners l
    JOIN public.assessments a ON a.class_id = l.class_id AND a.is_published, params p
    WHERE a.due_date >= p.term_from AND a.due_date < current_date
    GROUP BY l.student_id
  )
  SELECT l.student_id, l.class_id, l.class_name, l.form,
    CASE WHEN att.before_n >= 5 AND att.recent_n >= 3 THEN att.before_pct END,
    CASE WHEN att.before_n >= 5 AND att.recent_n >= 3 THEN att.recent_pct END,
    coalesce(sj.subjects, '[]'::jsonb),
    coalesce(hw.due, 0), coalesce(hw.missed, 0)
  FROM learners l
  LEFT JOIN att ON att.student_id = l.student_id
  LEFT JOIN subj_json sj ON sj.student_id = l.student_id
  LEFT JOIN hw ON hw.student_id = l.student_id;
$$;
REVOKE ALL ON FUNCTION public.agent_student_signals(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_student_signals(integer, integer) TO service_role;

-- ---------- Demo activity (demo school only) ----------
-- Eight weeks of attendance, class-test marks and homework for the demo learners
-- (e-mail on the demo domain), so the agent has realistic records to check. A small,
-- fixed group of learners slips in the last four weeks. Replaces earlier demo activity.
CREATE OR REPLACE FUNCTION public.seed_demo_activity()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_att integer; n_marks integer; n_hw integer; n_subs integer;
BEGIN
  IF NOT public.is_school_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only a school administrator can load demo activity' USING ERRCODE = '42501';
  END IF;

  CREATE TEMP TABLE demo_learners ON COMMIT DROP AS
  SELECT DISTINCT ON (s.id) s.id AS student_id, sc.class_id,
    ('x' || substr(md5(s.id::text || 'att'), 1, 7))::bit(28)::int % 100 AS h_att,
    ('x' || substr(md5(s.id::text || 'mark'), 1, 7))::bit(28)::int % 100 AS h_mark,
    ('x' || substr(md5(s.id::text || 'hw'), 1, 7))::bit(28)::int % 100 AS h_hw
  FROM public.students s JOIN public.student_classes sc ON sc.student_id = s.id
  WHERE lower(s.email) LIKE '%schooldemo.com'
  ORDER BY s.id, sc.created_at DESC;

  -- Remove earlier demo activity.
  DELETE FROM public.attendance a USING demo_learners d WHERE a.student_id = d.student_id AND a.notes = 'demo-activity';
  DELETE FROM public.marks m USING demo_learners d WHERE m.student_id = d.student_id AND m.comment = 'demo-activity';
  DELETE FROM public.assessments WHERE description = 'demo-activity';

  -- Attendance: school days in the last 8 weeks (not today). About 4% absent normally;
  -- learners in the attendance group (5%) miss about 45% of days in the last 4 weeks.
  INSERT INTO public.attendance (student_id, class_id, date, status, notes)
  SELECT d.student_id, d.class_id, day::date,
    CASE WHEN ('x' || substr(md5(d.student_id::text || day::text), 1, 7))::bit(28)::int % 100
              < CASE WHEN d.h_att < 5 AND day >= current_date - 28 THEN 45 ELSE 4 END
         THEN 'absent' ELSE 'present' END,
    'demo-activity'
  FROM demo_learners d, generate_series(current_date - 56, current_date - 1, interval '1 day') AS day
  WHERE extract(isodow FROM day) < 6;
  GET DIAGNOSTICS n_att = ROW_COUNT;

  -- Class tests 7, 21, 35 and 49 days ago in every subject the class takes. Learners in
  -- the marks group (5%) drop about 20 points in the two most recent tests.
  INSERT INTO public.marks (student_id, subject_id, class_id, teacher_id, assessment_type, mark, out_of, term, academic_year, comment, created_at)
  SELECT d.student_id, cs.subject_id, d.class_id, st.user_id, 'Class test',
    greatest(5, least(98,
      45 + ('x' || substr(md5(d.student_id::text || cs.subject_id::text), 1, 7))::bit(28)::int % 40
      + ('x' || substr(md5(d.student_id::text || cs.subject_id::text || ago::text), 1, 7))::bit(28)::int % 9 - 4
      - CASE WHEN d.h_mark < 5 AND ago <= 21 THEN 20 ELSE 0 END)),
    100, 'Term 3', extract(year FROM current_date)::text, 'demo-activity', now() - make_interval(days => ago)
  FROM demo_learners d
  JOIN public.class_subjects cs ON cs.class_id = d.class_id
  LEFT JOIN public.staff st ON st.id = cs.teacher_id
  CROSS JOIN unnest(ARRAY[49, 35, 21, 7]) AS ago;
  GET DIAGNOSTICS n_marks = ROW_COUNT;

  -- Homework: three pieces per class, due 30, 20 and 10 days ago. The most recent one
  -- has no marks entered yet, so the agent can flag it to the teacher.
  CREATE TEMP TABLE demo_hw ON COMMIT DROP AS
  SELECT gen_random_uuid() AS id, c.id AS class_id, cs.subject_id, st.user_id AS teacher_id, n,
    (current_date - (40 - n * 10))::date AS due
  FROM public.classes c
  JOIN LATERAL (SELECT * FROM public.class_subjects x WHERE x.class_id = c.id ORDER BY x.created_at, x.id LIMIT 1) cs ON true
  LEFT JOIN public.staff st ON st.id = cs.teacher_id
  CROSS JOIN generate_series(1, 3) AS n
  WHERE EXISTS (SELECT 1 FROM demo_learners d WHERE d.class_id = c.id);

  INSERT INTO public.assessments (id, title, description, class_id, subject_id, teacher_id, assessment_type, due_date, total_marks, max_marks, is_published)
  SELECT id, 'Homework ' || n, 'demo-activity', class_id, subject_id, teacher_id, 'assignment', due, 20, 20, true FROM demo_hw;
  GET DIAGNOSTICS n_hw = ROW_COUNT;

  -- Hand-ins: learners in the homework group (8%) miss two of three; others miss 3%.
  INSERT INTO public.assessment_submissions (assessment_id, student_id, status, notes, submitted_at, submission_date)
  SELECT h.id, d.student_id, 'submitted', 'demo-activity', h.due - 1, h.due - 1
  FROM demo_hw h JOIN demo_learners d ON d.class_id = h.class_id
  WHERE NOT (d.h_hw < 8 AND h.n >= 2)
    AND ('x' || substr(md5(d.student_id::text || h.id::text), 1, 7))::bit(28)::int % 100 >= 3;
  GET DIAGNOSTICS n_subs = ROW_COUNT;

  -- Marks for the two older pieces of homework.
  INSERT INTO public.assessment_results (assessment_id, student_id, mark, percentage, is_published, graded_date)
  SELECT s.assessment_id, s.student_id, m, round(m * 5.0, 1), true, h.due + 3
  FROM public.assessment_submissions s JOIN demo_hw h ON h.id = s.assessment_id AND h.n < 3,
  LATERAL (SELECT 8 + ('x' || substr(md5(s.student_id::text || s.assessment_id::text), 1, 7))::bit(28)::int % 12 AS m) mk;

  RETURN jsonb_build_object('attendance', n_att, 'marks', n_marks, 'homework', n_hw, 'hand_ins', n_subs);
END $$;
REVOKE ALL ON FUNCTION public.seed_demo_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_demo_activity() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';