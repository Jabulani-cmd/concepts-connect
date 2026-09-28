-- =====================================================================
-- STEP 1: clear out the tables, functions and policies the new Lovable
-- project created, which do not match the website's code.
-- Logins (auth.users) and uploaded files are kept.
-- =====================================================================
BEGIN;
DO $reset$
DECLARE r record;
BEGIN
  -- storage policies (Supabase ships none by default; the website recreates its own)
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'storage' AND tablename IN ('objects','buckets') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.%I', r.policyname, r.tablename);
  END LOOP;
  -- custom triggers on the login table (e.g. "create a profile on sign-up")
  FOR r IN SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', r.tgname);
  END LOOP;
  -- views, tables, sequences, functions and types in the public schema
  FOR r IN SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('v','m')
             AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e') LOOP
    EXECUTE format(CASE r.relkind WHEN 'm' THEN 'DROP MATERIALIZED VIEW IF EXISTS public.%I CASCADE' ELSE 'DROP VIEW IF EXISTS public.%I CASCADE' END, r.relname);
  END LOOP;
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
             AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e') LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.relname);
  END LOOP;
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'S'
             AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e') LOOP
    EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE', r.relname);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS sig, p.prokind FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public'
             AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') LOOP
    EXECUTE format(CASE r.prokind WHEN 'p' THEN 'DROP PROCEDURE IF EXISTS %s CASCADE' WHEN 'a' THEN 'DROP AGGREGATE IF EXISTS %s CASCADE' ELSE 'DROP FUNCTION IF EXISTS %s CASCADE' END, r.sig);
  END LOOP;
  FOR r IN SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname = 'public' AND t.typtype IN ('e','d','c') AND (t.typtype <> 'c' OR (SELECT relkind FROM pg_class WHERE oid = t.typrelid) = 'c')
             AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = t.oid AND d.deptype = 'e') LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname);
  END LOOP;
END
$reset$;
DROP SCHEMA IF EXISTS private CASCADE;
COMMIT;

