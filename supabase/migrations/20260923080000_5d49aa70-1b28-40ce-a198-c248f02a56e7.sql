-- ============================================
-- SCHEMA ALIGNMENT
-- Adds columns and functions the application uses that are missing from the
-- catch-up schema (20260522141343). Idempotent: safe to run on any database.
-- ============================================

-- Facilities gallery: category tab and visibility
ALTER TABLE public.facility_images ADD COLUMN IF NOT EXISTS facility_type text NOT NULL DEFAULT 'general';
ALTER TABLE public.facility_images ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Awards gallery visibility
ALTER TABLE public.award_photos ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Exams: which Form sits the exam, which subjects, and whether results are released
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS exam_type text NOT NULL DEFAULT 'end_of_term';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS form_level text;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS subject_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Exam timetable: multiple invigilators and free-text notes
ALTER TABLE public.exam_timetable_entries ADD COLUMN IF NOT EXISTS invigilators text[];
ALTER TABLE public.exam_timetable_entries ADD COLUMN IF NOT EXISTS notes text;


-- Finance approvals: what the request acts on, and reviewer notes
ALTER TABLE public.finance_approval_requests ADD COLUMN IF NOT EXISTS target_table text;
ALTER TABLE public.finance_approval_requests ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE public.finance_approval_requests ADD COLUMN IF NOT EXISTS review_notes text;
ALTER TABLE public.finance_approval_requests ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Assessment results: percentage, grade, release to students, grading date
ALTER TABLE public.assessment_results ADD COLUMN IF NOT EXISTS percentage numeric;
ALTER TABLE public.assessment_results ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE public.assessment_results ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;
ALTER TABLE public.assessment_results ADD COLUMN IF NOT EXISTS graded_date timestamptz;

-- Term reports: generated summary per student per term
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS form_level text;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS assessment_data jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS exam_data jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS total_marks numeric NOT NULL DEFAULT 0;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS average_mark numeric NOT NULL DEFAULT 0;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS overall_grade text;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS class_rank integer;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS class_size integer;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS form_rank integer;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS form_size integer;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS class_teacher_comment text;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS head_comment text;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS generated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.term_reports ADD COLUMN IF NOT EXISTS generated_by uuid;

-- Classes: home room
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS room text;

-- Sports schedule: weekly recurring slots per class (fixtures keep using event_date)
ALTER TABLE public.sports_schedule ALTER COLUMN event_date DROP NOT NULL;
ALTER TABLE public.sports_schedule ADD COLUMN IF NOT EXISTS class_id uuid;
ALTER TABLE public.sports_schedule ADD COLUMN IF NOT EXISTS activity_name text;
ALTER TABLE public.sports_schedule ADD COLUMN IF NOT EXISTS activity_type text NOT NULL DEFAULT 'sport';
ALTER TABLE public.sports_schedule ADD COLUMN IF NOT EXISTS day_of_week integer;
ALTER TABLE public.sports_schedule ADD COLUMN IF NOT EXISTS start_time text;
ALTER TABLE public.sports_schedule ADD COLUMN IF NOT EXISTS end_time text;
ALTER TABLE public.sports_schedule ADD COLUMN IF NOT EXISTS coach_id uuid;

-- Boarding: hostel staffing/contact details, room details, allocation history, sick-bay records
ALTER TABLE public.hostels ADD COLUMN IF NOT EXISTS housemaster_id uuid;
ALTER TABLE public.hostels ADD COLUMN IF NOT EXISTS assistant_housemaster_id uuid;
ALTER TABLE public.hostels ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.hostels ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.hostels ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.hostels ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS room_type text NOT NULL DEFAULT 'dormitory';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS floor integer;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.bed_allocations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.bed_allocations ADD COLUMN IF NOT EXISTS allocation_start_date date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.bed_allocations ADD COLUMN IF NOT EXISTS allocation_end_date date;

ALTER TABLE public.health_visits ADD COLUMN IF NOT EXISTS diagnosis text;
ALTER TABLE public.health_visits ADD COLUMN IF NOT EXISTS medication_given text;
ALTER TABLE public.health_visits ADD COLUMN IF NOT EXISTS follow_up_date date;
ALTER TABLE public.health_visits ADD COLUMN IF NOT EXISTS visited_by text;
ALTER TABLE public.health_visits ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.health_visits ADD COLUMN IF NOT EXISTS parent_notified boolean NOT NULL DEFAULT false;

-- Students: home province (Zimbabwe)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS province text;

-- Message templates: placeholder names such as {{student_name}}
ALTER TABLE public.sms_templates ADD COLUMN IF NOT EXISTS variables text[] NOT NULL DEFAULT '{}'::text[];

-- Communication log: audience, delivery details and template used
ALTER TABLE public.communication_logs ADD COLUMN IF NOT EXISTS recipient_type text;
ALTER TABLE public.communication_logs ADD COLUMN IF NOT EXISTS recipient_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.communication_logs ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.communication_logs ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE public.communication_logs ADD COLUMN IF NOT EXISTS error_message text;

-- Finance: ZiG equivalents and references on every money movement (Zimbabwe dual currency)
ALTER TABLE public.petty_cash ADD COLUMN IF NOT EXISTS amount_zig numeric NOT NULL DEFAULT 0;
ALTER TABLE public.petty_cash ADD COLUMN IF NOT EXISTS reference_number text;

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS amount_zig numeric NOT NULL DEFAULT 0;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'Cash';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS reference_number text;

ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS supplier_contact text;
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS amount_zig numeric NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS paid_usd numeric NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS paid_zig numeric NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS recorded_by uuid;

ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS amount_zig numeric NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS notes text;

-- Pay Online (public website): fee payments and donations awaiting Paynow confirmation
CREATE TABLE IF NOT EXISTS public.online_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type text NOT NULL DEFAULT 'fees',
  student_number text,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.school_projects(id) ON DELETE SET NULL,
  payer_name text NOT NULL,
  payer_email text NOT NULL,
  payer_phone text,
  amount_usd numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  paynow_reference text,
  status text NOT NULL DEFAULT 'pending',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.online_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "online_payments_public_insert" ON public.online_payments;
CREATE POLICY "online_payments_public_insert" ON public.online_payments
  FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');
DROP POLICY IF EXISTS "online_payments_finance_manage" ON public.online_payments;
CREATE POLICY "online_payments_finance_manage" ON public.online_payments
  FOR ALL TO authenticated
  USING (public.is_finance_admin(auth.uid()) OR public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_finance_admin(auth.uid()) OR public.is_school_admin(auth.uid()));

-- Inventory: item codes/barcodes, suppliers and USD/ZiG purchase prices
ALTER TABLE public.inventory_categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS item_code text;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS supplier_contact text;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS purchase_price_usd numeric;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS purchase_price_zig numeric;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS reference text;

-- Textbook loans: which stock item, due date, return condition and fines
ALTER TABLE public.textbook_issues ADD COLUMN IF NOT EXISTS inventory_item_id uuid;
ALTER TABLE public.textbook_issues ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.textbook_issues ADD COLUMN IF NOT EXISTS condition_on_return text;
ALTER TABLE public.textbook_issues ADD COLUMN IF NOT EXISTS fine_amount_usd numeric;
ALTER TABLE public.textbook_issues ADD COLUMN IF NOT EXISTS fine_amount_zig numeric;
ALTER TABLE public.textbook_issues ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'issued';

-- Staff: Zimbabwean statutory numbers (NSSA, ZIMRA PAYE) and salary bank details
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS nssa_number text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS paye_number text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS bank_details text;

-- Lesson plans: structured lesson sections, date and draft/published status
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS date date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 40;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS objectives text;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS materials_needed text;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS introduction text;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS main_activity text;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS conclusion text;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS assessment_strategy text;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS homework_notes text;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS reflection text;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- Parent communication log: who was contacted and follow-up tracking
ALTER TABLE public.parent_communication_logs ADD COLUMN IF NOT EXISTS parent_name text;
ALTER TABLE public.parent_communication_logs ADD COLUMN IF NOT EXISTS follow_up_date date;
ALTER TABLE public.parent_communication_logs ADD COLUMN IF NOT EXISTS follow_up_completed boolean NOT NULL DEFAULT false;

-- Teacher resource library: subject, tags and favourites
ALTER TABLE public.teacher_resources ADD COLUMN IF NOT EXISTS subject_id uuid;
ALTER TABLE public.teacher_resources ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.teacher_resources ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

-- ============================================
-- FOREIGN KEYS
-- Needed for the related-table lookups the app performs (e.g. staff(full_name)).
-- Added NOT VALID so pre-existing orphan rows do not block the migration.
-- ============================================
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN SELECT * FROM (VALUES
    ('leave_requests', 'staff_id', 'staff', 'CASCADE'),
    ('class_subjects', 'teacher_id', 'staff', 'SET NULL'),
    ('parent_communication_logs', 'student_id', 'students', 'CASCADE'),
    ('sports_schedule', 'class_id', 'classes', 'CASCADE'),
    ('sports_schedule', 'coach_id', 'staff', 'SET NULL'),
    ('hostels', 'housemaster_id', 'staff', 'SET NULL'),
    ('hostels', 'assistant_housemaster_id', 'staff', 'SET NULL'),
    ('textbook_issues', 'inventory_item_id', 'inventory_items', 'SET NULL'),
    ('teacher_resources', 'subject_id', 'subjects', 'SET NULL')
  ) AS t(tbl, col, ref, on_delete)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = fk.tbl || '_' || fk.col || '_fkey'
        AND conrelid = ('public.' || fk.tbl)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE %s NOT VALID',
        fk.tbl, fk.tbl || '_' || fk.col || '_fkey', fk.col, fk.ref, fk.on_delete
      );
    END IF;
  END LOOP;
END $$;

-- ============================================
-- ZIMBABWE: CURRENCY
-- Payments and invoices were being stamped with South African rand (ZAR).
-- Zimbabwean school fees are billed in USD, with ZiG equivalents stored alongside.
-- ============================================
CREATE OR REPLACE FUNCTION public.prepare_payment_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_student_id uuid;
  v_invoice_total numeric := 0;
  v_existing_paid numeric := 0;
  v_payment_amount numeric := 0;
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT student_id, COALESCE(NULLIF(total_usd, 0), amount_usd, 0)
      INTO v_invoice_student_id, v_invoice_total
    FROM public.invoices
    WHERE id = NEW.invoice_id;

    IF v_invoice_student_id IS NOT NULL THEN
      NEW.student_id := v_invoice_student_id;
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.is_finance_admin(auth.uid()) THEN
    NEW.parent_id := auth.uid();
    NEW.recorded_by := auth.uid();

    IF NEW.payment_status IS NULL OR NEW.payment_status = 'pending'::payment_status THEN
      NEW.payment_status := 'paid'::payment_status;
    END IF;
  END IF;

  IF NEW.amount_usd IS NULL OR NEW.amount_usd = 0 THEN
    NEW.amount_usd := COALESCE(NEW.amount, 0);
  END IF;

  IF NEW.amount IS NULL OR NEW.amount = 0 THEN
    NEW.amount := COALESCE(NEW.amount_usd, 0);
  END IF;

  -- Zimbabwe: fees are billed in US dollars (ZiG equivalents are stored alongside).
  IF NEW.currency IS NULL OR NEW.currency = 'ZAR' THEN
    NEW.currency := 'USD';
  END IF;

  v_payment_amount := COALESCE(NULLIF(NEW.amount_usd, 0), NEW.amount, 0);

  IF NEW.invoice_id IS NOT NULL AND NEW.payment_status = 'paid'::payment_status THEN
    SELECT COALESCE(SUM(COALESCE(NULLIF(p.amount_usd, 0), p.amount, 0)), 0)
      INTO v_existing_paid
    FROM public.payments p
    WHERE p.invoice_id = NEW.invoice_id
      AND p.payment_status = 'paid'::payment_status
      AND (TG_OP = 'INSERT' OR p.id <> NEW.id);

    IF v_existing_paid + v_payment_amount > v_invoice_total + 0.001 THEN
      RAISE EXCEPTION 'Payment exceeds outstanding invoice balance'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.build_invoice_for_student(_student_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  s RECORD; v_fee RECORD;
  v_invoice_id uuid; v_invoice_number text; v_existing uuid;
  v_year text; v_term text; v_month int; v_boarding text; v_grade text; v_due date;
BEGIN
  SELECT * INTO s FROM public.students WHERE id=_student_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_grade := COALESCE(s.form, s.class);
  IF v_grade IS NULL OR v_grade='' THEN RETURN NULL; END IF;
  v_boarding := COALESCE(s.boarding_status, 'day');
  v_year := to_char(CURRENT_DATE,'YYYY');
  v_month := EXTRACT(MONTH FROM CURRENT_DATE)::int;
  v_term := CASE WHEN v_month BETWEEN 1 AND 4 THEN 'Term 1'
                 WHEN v_month BETWEEN 5 AND 8 THEN 'Term 2'
                 ELSE 'Term 3' END;
  v_due := CASE WHEN v_month BETWEEN 1 AND 4 THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int,2,28)
                WHEN v_month BETWEEN 5 AND 8 THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int,6,30)
                ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int,10,31) END;
  IF v_due < CURRENT_DATE THEN v_due := CURRENT_DATE + INTERVAL '30 days'; END IF;

  SELECT * INTO v_fee FROM public.fee_structures
   WHERE form=v_grade AND term=v_term AND academic_year=v_year AND boarding_status=v_boarding
   ORDER BY created_at DESC LIMIT 1;
  IF v_fee.id IS NULL THEN
    SELECT * INTO v_fee FROM public.fee_structures
     WHERE form=v_grade AND term=v_term AND academic_year=v_year
     ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_fee.id IS NULL THEN
    SELECT * INTO v_fee FROM public.fee_structures
     WHERE form=v_grade AND boarding_status=v_boarding
     ORDER BY academic_year DESC, created_at DESC LIMIT 1;
    v_term := COALESCE(v_fee.term, v_term); v_year := COALESCE(v_fee.academic_year, v_year);
  END IF;
  IF v_fee.id IS NULL THEN
    SELECT * INTO v_fee FROM public.fee_structures
     WHERE form=v_grade ORDER BY created_at DESC LIMIT 1;
    v_term := COALESCE(v_fee.term, v_term); v_year := COALESCE(v_fee.academic_year, v_year);
  END IF;
  IF v_fee.id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_existing FROM public.invoices
   WHERE student_id=_student_id
     AND COALESCE(academic_year,'')=COALESCE(v_year,'')
     AND COALESCE(term,'')=COALESCE(v_term,'')
   LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  v_invoice_number := 'INV-' || v_year || '-' || LPAD(nextval('public.invoice_number_seq')::text,6,'0');

  INSERT INTO public.invoices (
    invoice_number, student_id, fee_structure_id, academic_year, term,
    amount_usd, total_usd, amount_paid, paid_usd, currency, status, due_date, notes
  ) VALUES (
    v_invoice_number, _student_id, v_fee.id, v_year, v_term,
    v_fee.amount_usd, v_fee.amount_usd, 0, 0, 'USD', 'unpaid', v_due,
    'Auto-generated on student registration'
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_items (invoice_id, fee_structure_id, description, amount, amount_usd)
  VALUES (v_invoice_id, v_fee.id,
          v_term || ' ' || v_year || ' — ' || v_grade || ' (' || v_boarding || ') tuition',
          v_fee.amount_usd, v_fee.amount_usd);

  RETURN v_invoice_id;
END $fn$;

UPDATE public.payments SET currency = 'USD' WHERE currency = 'ZAR';
UPDATE public.invoices SET currency = 'USD' WHERE currency = 'ZAR';

-- Walk-in cash and bank payments recorded by the bursar are not tied to a parent account.
ALTER TABLE public.payments ALTER COLUMN parent_id DROP NOT NULL;

-- Cash (USD notes) is the most common way fees are paid at the school office.
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'cash';

-- ============================================
-- FUNCTIONS
-- ============================================

-- Overall and per-subject ranking of one student in one exam
CREATE OR REPLACE FUNCTION public.get_exam_rankings(p_exam_id uuid, p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH student_totals AS (
    SELECT student_id, SUM(mark) AS total_mark
    FROM exam_results
    WHERE exam_id = p_exam_id
    GROUP BY student_id
  ),
  ranked_totals AS (
    SELECT student_id,
           RANK() OVER (ORDER BY total_mark DESC) AS overall_rank,
           COUNT(*) OVER () AS total_students
    FROM student_totals
  ),
  subject_ranks AS (
    SELECT student_id, subject_id,
           RANK() OVER (PARTITION BY subject_id ORDER BY mark DESC) AS subject_rank,
           COUNT(*) OVER (PARTITION BY subject_id) AS subject_total
    FROM exam_results
    WHERE exam_id = p_exam_id AND subject_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'overall_rank', rt.overall_rank,
    'total_students', rt.total_students,
    'subject_rankings', (
      SELECT jsonb_object_agg(sr.subject_id::text, jsonb_build_object('rank', sr.subject_rank, 'total', sr.subject_total))
      FROM subject_ranks sr
      WHERE sr.student_id = p_student_id
    )
  ) INTO result
  FROM ranked_totals rt
  WHERE rt.student_id = p_student_id;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_exam_rankings(uuid, uuid) TO authenticated;

-- Delete a class and everything that depends on it (school admins only)
CREATE OR REPLACE FUNCTION public.delete_class_cascade(_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_school_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only school administrators can delete classes';
  END IF;

  DELETE FROM assessment_results WHERE assessment_id IN (SELECT id FROM assessments WHERE class_id = _class_id);
  DELETE FROM assessment_submissions WHERE assessment_id IN (SELECT id FROM assessments WHERE class_id = _class_id);
  DELETE FROM assessments WHERE class_id = _class_id;
  DELETE FROM study_materials WHERE class_id = _class_id;
  DELETE FROM homework WHERE class_id = _class_id;
  DELETE FROM timetable_entries WHERE class_id = _class_id;
  DELETE FROM exam_timetable_entries WHERE class_id = _class_id;
  DELETE FROM lesson_plans WHERE class_id = _class_id;
  DELETE FROM marks WHERE class_id = _class_id;
  DELETE FROM class_subjects WHERE class_id = _class_id;
  DELETE FROM student_classes WHERE class_id = _class_id;
  DELETE FROM enrollments WHERE class_id = _class_id;
  DELETE FROM attendance WHERE class_id = _class_id;
  DELETE FROM classes WHERE id = _class_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_class_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_class_cascade(uuid) TO authenticated;

-- Delete a staff member, clearing references to them (school admins only)
CREATE OR REPLACE FUNCTION public.delete_staff_cascade(_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_school_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only school administrators can delete staff';
  END IF;

  UPDATE classes SET class_teacher_id = NULL WHERE class_teacher_id = _staff_id;
  UPDATE class_subjects SET teacher_id = NULL WHERE teacher_id = _staff_id;
  UPDATE timetable_entries SET teacher_id = NULL WHERE teacher_id = _staff_id;
  UPDATE hostels SET housemaster_id = NULL WHERE housemaster_id = _staff_id;
  UPDATE hostels SET assistant_housemaster_id = NULL WHERE assistant_housemaster_id = _staff_id;
  DELETE FROM leave_requests WHERE staff_id = _staff_id;
  DELETE FROM staff WHERE id = _staff_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_staff_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_staff_cascade(uuid) TO authenticated;

-- Public fee lookup for the Pay Online page: reveals only name and Form for an exact admission number
CREATE OR REPLACE FUNCTION public.lookup_student_for_payment(_admission_number text)
RETURNS TABLE (id uuid, full_name text, admission_number text, form text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.full_name, s.admission_number, s.form
  FROM students s
  WHERE upper(s.admission_number) = upper(trim(_admission_number))
    AND COALESCE(s.status, 'active') = 'active'
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.lookup_student_for_payment(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
