-- ============================================
-- NO EM DASHES IN TEXT THE DATABASE WRITES
-- Quiz feedback, mark notifications, leave notifications and invoice line
-- descriptions used em dashes. Each function is edited as it currently
-- exists (so any later changes to it are kept), then text already saved is
-- tidied the same way. Idempotent: safe to run more than once.
-- ============================================
DO $$
DECLARE
  f record;
  def text;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('submit_quiz', 'notify_on_assessment_result', 'notify_leave_status_change', 'build_invoice_for_student')
  LOOP
    def := pg_get_functiondef(f.oid);
    CONTINUE WHEN position(U&'\2014' IN def) = 0;
    IF f.proname = 'submit_quiz' THEN
      def := replace(def, U&''' \2014 ''', '''. ''');                     -- "... Correct. <explanation>"
    ELSIF f.proname = 'build_invoice_for_student' THEN
      def := replace(def, U&''' \2014 ''', ''': ''');                     -- "Term 1 2026: Form 1 (day) tuition"
    ELSIF f.proname = 'notify_leave_status_change' THEN
      def := replace(def, U&'discussion \2014 please', 'discussion. Please');
    END IF;
    def := replace(def, U&' \2014 ', ': ');
    def := replace(def, U&'\2014', '-');                                  -- "no mark" placeholders
    EXECUTE def;
  END LOOP;
END $$;

-- Text already saved.
UPDATE public.invoice_items SET description = replace(replace(description, U&' \2014 ', ': '), U&'\2014', '-')
WHERE description LIKE U&'%\2014%';
UPDATE public.assessment_results SET feedback = replace(replace(feedback, U&' \2014 ', '. '), U&'\2014', '-')
WHERE feedback LIKE U&'%\2014%';
UPDATE public.notifications
SET title = replace(replace(title, U&' \2014 ', ': '), U&'\2014', '-'),
    message = replace(replace(message, U&' \2014 ', '. '), U&'\2014', '-')
WHERE title LIKE U&'%\2014%' OR message LIKE U&'%\2014%';

NOTIFY pgrst, 'reload schema';
