-- ============================================
-- QUIZ ANSWER KEYS, SERVER-SIDE MARKING AND TEACHER SCOPE
-- * Correct answers move out of assessments.questions (readable by students)
--   into assessment_answer_keys (staff only). A trigger does this whenever a
--   quiz is saved, so the teacher screens keep working unchanged.
-- * submit_quiz() marks a quiz on the server and records the submission and
--   result; students can no longer see the answer key or choose their own score.
-- * Students may hand in their own work (assessment_submissions); they could not
--   save any submission before.
-- * Teachers may change marks, exam results, assessment results and attendance
--   only for students in classes they teach (as class or subject teacher), and
--   only their own quizzes. HODs and administrators keep school-wide access.
-- Idempotent: safe to run more than once.
-- ============================================

-- ---------- Teacher scope helpers ----------
CREATE OR REPLACE FUNCTION public.teaches_class(_uid uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND _class_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.user_id = _uid
      AND (EXISTS (SELECT 1 FROM public.class_subjects cs WHERE cs.class_id = _class_id AND cs.teacher_id = s.id)
           OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = _class_id AND c.class_teacher_id = s.id))
  );
$$;

-- HODs and administrators: any student. Teachers: students in a class they teach.
CREATE OR REPLACE FUNCTION public.can_teach_student(_uid uuid, _student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_school_admin(_uid)
    OR public.has_role(_uid, 'hod'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.student_classes sc
      WHERE (sc.student_id = _student_id
             OR sc.student_id = (SELECT st.id FROM public.students st WHERE st.user_id = _student_id))
        AND public.teaches_class(_uid, sc.class_id)
    );
$$;

REVOKE ALL ON FUNCTION public.teaches_class(uuid, uuid), public.can_teach_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teaches_class(uuid, uuid), public.can_teach_student(uuid, uuid) TO authenticated, service_role;

-- ---------- Teacher write rules ----------
DROP POLICY IF EXISTS marks_teacher_write ON public.marks;
CREATE POLICY marks_teacher_write ON public.marks FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'hod'::app_role]) AND public.can_teach_student(auth.uid(), student_id))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'hod'::app_role]) AND public.can_teach_student(auth.uid(), student_id));

DROP POLICY IF EXISTS exam_results_teacher_write ON public.exam_results;
CREATE POLICY exam_results_teacher_write ON public.exam_results FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'hod'::app_role]) AND public.can_teach_student(auth.uid(), student_id))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'hod'::app_role]) AND public.can_teach_student(auth.uid(), student_id));

DROP POLICY IF EXISTS assessment_results_teacher_write ON public.assessment_results;
CREATE POLICY assessment_results_teacher_write ON public.assessment_results FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'hod'::app_role]) AND public.can_teach_student(auth.uid(), student_id))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'hod'::app_role]) AND public.can_teach_student(auth.uid(), student_id));

DROP POLICY IF EXISTS attendance_teacher_write ON public.attendance;
CREATE POLICY attendance_teacher_write ON public.attendance FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'hod'::app_role])
         AND (public.can_teach_student(auth.uid(), student_id) OR public.teaches_class(auth.uid(), class_id)))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'hod'::app_role])
              AND (public.can_teach_student(auth.uid(), student_id) OR public.teaches_class(auth.uid(), class_id)));

-- Teachers manage their own quizzes/assessments for classes they teach; HODs any.
DROP POLICY IF EXISTS assessments_teacher_write ON public.assessments;
CREATE POLICY assessments_teacher_write ON public.assessments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'hod'::app_role)
         OR (public.has_role(auth.uid(), 'teacher'::app_role) AND teacher_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'hod'::app_role)
              OR (public.has_role(auth.uid(), 'teacher'::app_role) AND teacher_id = auth.uid()
                  AND (class_id IS NULL OR public.teaches_class(auth.uid(), class_id))));

-- ---------- Students hand in their own work ----------
DROP POLICY IF EXISTS assessment_submissions_student_insert ON public.assessment_submissions;
CREATE POLICY assessment_submissions_student_insert ON public.assessment_submissions FOR INSERT TO authenticated
  WITH CHECK (coalesce(auto_marked, false) = false
              AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS assessment_submissions_teacher_manage ON public.assessment_submissions;
CREATE POLICY assessment_submissions_teacher_manage ON public.assessment_submissions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'hod'::app_role]) AND public.can_teach_student(auth.uid(), student_id))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'hod'::app_role]) AND public.can_teach_student(auth.uid(), student_id));

-- ---------- Answer keys ----------
CREATE TABLE IF NOT EXISTS public.assessment_answer_keys (
  assessment_id uuid PRIMARY KEY
    REFERENCES public.assessments(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb, -- { "<question id>": { "correct_index": n, "explanation": "..." } }
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assessment_answer_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assessment_answer_keys_staff_read ON public.assessment_answer_keys;
CREATE POLICY assessment_answer_keys_staff_read ON public.assessment_answer_keys FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid()));
REVOKE ALL ON public.assessment_answer_keys FROM anon;
GRANT SELECT ON public.assessment_answer_keys TO authenticated;
GRANT ALL ON public.assessment_answer_keys TO service_role;

-- Strips correct answers and explanations from saved questions into the key table.
CREATE OR REPLACE FUNCTION public.split_assessment_answers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  q jsonb;
  qid text;
  n int := 0;
  keys jsonb := '{}'::jsonb;
  cleaned jsonb := '[]'::jsonb;
BEGIN
  IF NEW.questions IS NULL OR jsonb_typeof(NEW.questions) <> 'array' THEN
    RETURN NEW;
  END IF;
  FOR q IN SELECT value FROM jsonb_array_elements(NEW.questions) LOOP
    n := n + 1;
    qid := coalesce(q->>'id', 'q' || n);
    q := q || jsonb_build_object('id', qid);
    IF q ? 'correct_index' OR q ? 'explanation' THEN
      keys := keys || jsonb_build_object(qid, jsonb_strip_nulls(jsonb_build_object(
        'correct_index', q->'correct_index', 'explanation', q->'explanation')));
    END IF;
    cleaned := cleaned || jsonb_build_array(q - 'correct_index' - 'explanation');
  END LOOP;
  NEW.questions := cleaned;
  IF keys <> '{}'::jsonb THEN
    INSERT INTO public.assessment_answer_keys (assessment_id, answers)
    VALUES (NEW.id, keys)
    ON CONFLICT (assessment_id) DO UPDATE
      SET answers = public.assessment_answer_keys.answers || EXCLUDED.answers, updated_at = now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_split_assessment_answers ON public.assessments;
CREATE TRIGGER trg_split_assessment_answers
  BEFORE INSERT OR UPDATE OF questions ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.split_assessment_answers();

-- Move the answers out of quizzes that already exist.
UPDATE public.assessments SET questions = questions
WHERE questions IS NOT NULL AND (questions::text LIKE '%"correct_index"%' OR questions::text LIKE '%"explanation"%');

-- ---------- Server-side quiz marking ----------
CREATE OR REPLACE FUNCTION public.submit_quiz(_assessment_id uuid, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_student uuid;
  a public.assessments%ROWTYPE;
  keys jsonb;
  q jsonb;
  qid text;
  n int := 0;
  q_marks numeric;
  obtained numeric := 0;
  total numeric := 0;
  pct numeric;
  v_grade text;
  chosen int;
  correct int;
  feedback text := '';
BEGIN
  SELECT id INTO v_student FROM public.students WHERE user_id = auth.uid() LIMIT 1;
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Only students can submit quizzes' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.assessments WHERE id = _assessment_id AND coalesce(is_published, false);
  IF a.id IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;
  IF a.class_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.student_classes WHERE student_id = v_student AND class_id = a.class_id) THEN
    RAISE EXCEPTION 'This quiz is not for your class' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.assessment_results WHERE assessment_id = a.id AND student_id = v_student) THEN
    RAISE EXCEPTION 'You have already submitted this quiz';
  END IF;

  SELECT answers INTO keys FROM public.assessment_answer_keys WHERE assessment_id = a.id;
  keys := coalesce(keys, '{}'::jsonb);

  FOR q IN SELECT value FROM jsonb_array_elements(coalesce(a.questions, '[]'::jsonb)) LOOP
    n := n + 1;
    qid := coalesce(q->>'id', 'q' || n);
    q_marks := coalesce(nullif(q->>'marks', '')::numeric, 1);
    total := total + q_marks;
    chosen := CASE WHEN (_answers->>qid) ~ '^\d+$' THEN (_answers->>qid)::int END;
    correct := CASE WHEN (keys->qid->>'correct_index') ~ '^\d+$' THEN (keys->qid->>'correct_index')::int END;
    IF chosen IS NOT NULL AND chosen = correct THEN
      obtained := obtained + q_marks;
      feedback := feedback || format('Q%s: ✓ Correct', n);
    ELSE
      feedback := feedback || format('Q%s: ✗ Your answer: %s | Correct: %s', n,
        coalesce(q->'options'->>chosen, '—'), coalesce(q->'options'->>correct, '—'));
    END IF;
    IF keys->qid->>'explanation' IS NOT NULL AND keys->qid->>'explanation' <> '' THEN
      feedback := feedback || ' — ' || (keys->qid->>'explanation');
    END IF;
    feedback := feedback || E'\n';
  END LOOP;

  IF coalesce(a.max_marks, 0) > 0 THEN total := a.max_marks; END IF;
  pct := CASE WHEN total > 0 THEN round(obtained / total * 100, 2) ELSE 0 END;
  -- ZIMSEC bands, as in src/lib/grading.ts.
  v_grade := CASE WHEN pct >= 75 THEN 'A' WHEN pct >= 65 THEN 'B' WHEN pct >= 50 THEN 'C'
                  WHEN pct >= 45 THEN 'D' WHEN pct >= 40 THEN 'E' ELSE 'U' END;

  INSERT INTO public.assessment_submissions (assessment_id, student_id, answers, auto_marked, status, submission_date)
  VALUES (a.id, v_student, _answers, true, 'submitted', now());
  INSERT INTO public.assessment_results (assessment_id, student_id, mark, percentage, grade, feedback, is_published, graded_by, graded_date)
  VALUES (a.id, v_student, obtained, pct, v_grade, rtrim(feedback, E'\n'), true, auth.uid(), now());

  RETURN jsonb_build_object('mark', obtained, 'total', total, 'percentage', pct, 'grade', v_grade,
                            'passed', pct >= coalesce(a.pass_mark, 50));
END $$;

REVOKE ALL ON FUNCTION public.submit_quiz(uuid, jsonb), public.split_assessment_answers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz(uuid, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';