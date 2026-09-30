-- ============================================
-- STUDENT NUMBERS: CLA PREFIX
-- New students get CLA00001-style numbers (Concepts Learning Academy), and their
-- login is <student number>@concepts-academy.co.zw. Existing students keep their
-- numbers and logins. The running count carries on, so numbers never repeat.
-- Demo learners use the same format in a reserved block, CLA90001 and up, so
-- "Load demo activity" now recognises them by that address as well.
-- Idempotent: safe to run more than once.
-- ============================================

CREATE SEQUENCE IF NOT EXISTS public.student_number_seq;

CREATE OR REPLACE FUNCTION public.gen_admission_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.admission_number IS NULL OR NEW.admission_number = '' THEN
    NEW.admission_number := 'CLA' || LPAD(nextval('public.student_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_students_admission_number ON public.students;
CREATE TRIGGER trg_students_admission_number BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.gen_admission_number();

-- Older databases may also carry the first version of the numbering trigger; retire it
-- so there is only one source of student numbers.
DROP TRIGGER IF EXISTS trg_generate_admission_number ON public.students;

-- ---------- Demo activity: recognise demo learners in the CLA90001 block ----------
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
     OR lower(s.email) ~ '^cla9[0-9]{4}@concepts-academy\.co\.zw$'
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
