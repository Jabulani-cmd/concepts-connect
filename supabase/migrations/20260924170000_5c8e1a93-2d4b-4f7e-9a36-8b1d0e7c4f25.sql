-- ============================================
-- RUN THE SCHOOL MONITORING AGENT ALL THE TIME
-- * A database job (pg_cron + pg_net) calls the school-agent function every
--   15 minutes, day and night, with no one signed in.
-- * The job proves itself with a random key generated here and kept in
--   agent_settings (readable only by the database and the agent), so no secret
--   is stored in the code.
-- * Agent findings and runs are published to Realtime so open screens update
--   as soon as the agent finds or closes something.
-- Idempotent: safe to run more than once. If scheduling isn't available the
-- rest still applies, and the admin page keeps the agent running while open.
-- ============================================

CREATE TABLE IF NOT EXISTS public.agent_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cron_secret text NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text),
  schedule text NOT NULL DEFAULT '*/15 * * * *',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.agent_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.agent_settings TO service_role;

-- Schedule the agent. The function URL is this project's public address.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'school-agent') THEN
    PERFORM cron.unschedule('school-agent');
  END IF;

  PERFORM cron.schedule(
    'school-agent',
    (SELECT schedule FROM public.agent_settings WHERE id = 1),
    $job$
      SELECT net.http_post(
        url := 'https://oymqqsvabbzognjgbxtl.supabase.co/functions/v1/school-agent',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-agent-secret', (SELECT cron_secret FROM public.agent_settings WHERE id = 1)
        ),
        body := '{"trigger":"schedule"}'::jsonb,
        timeout_milliseconds := 120000
      );
    $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'School agent schedule not created (%). The admin page will keep the agent running instead.', SQLERRM;
END $$;

-- Whether the schedule is active, for the admin page.
CREATE OR REPLACE FUNCTION public.agent_schedule_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_schedule text;
  v_active boolean := false;
BEGIN
  IF NOT (public.is_school_admin(auth.uid()) OR public.has_role(auth.uid(), 'hod'::app_role)) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  BEGIN
    EXECUTE 'SELECT schedule, active FROM cron.job WHERE jobname = $1' INTO v_schedule, v_active USING 'school-agent';
  EXCEPTION WHEN OTHERS THEN
    v_schedule := NULL; v_active := false;
  END;
  RETURN jsonb_build_object('scheduled', coalesce(v_active, false), 'schedule', v_schedule);
END $$;
REVOKE ALL ON FUNCTION public.agent_schedule_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_schedule_status() TO authenticated, service_role;

-- Live updates on open screens.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'agent_findings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_findings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'agent_runs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Realtime not enabled for agent tables (%)', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
