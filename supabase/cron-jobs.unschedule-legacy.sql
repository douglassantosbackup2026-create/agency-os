-- Executar ANTES de cron-jobs.deploy-trafego.sql (ou após, para limpar duplicados).
-- Remove crons globais que disparam evaluate-alerts / compute-health-scores em todo o tenant.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE jobname IN (
      'evaluate-alerts-hourly',
      'compute-health-scores-daily',
      'compute-health-scores',
      'evaluate-alerts'
    )
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'Unscheduled legacy cron: % (id %)', r.jobname, r.jobid;
  END LOOP;
END $$;
