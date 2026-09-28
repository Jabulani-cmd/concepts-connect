-- =====================================================================
-- BRIDGE: columns the live database had (from the March setup files) that
-- the 22 May catch-up files do not create. The September security files
-- and the website rely on them. Definitions follow the original files.
-- =====================================================================
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'broadcast'));
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'alert', 'system'));
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS enrollment_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS has_medical_alert boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS medical_conditions text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS sports text[],
  ADD COLUMN IF NOT EXISTS student_number text,
  ADD COLUMN IF NOT EXISTS subject_combination text;
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS is_examinable boolean DEFAULT true;
