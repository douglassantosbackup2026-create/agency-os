-- Removes pg_cron jobs that shipped with hardcoded project URLs and JWT anon keys.
-- After this migration, recreate schedules in the Dashboard or via SQL using vault secrets
-- and Authorization: Bearer <CRON_SECRET> (see README.md).

DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'compute-health-scores-daily',
      'evaluate-alerts-hourly',
      'whatsapp-summary-daily',
      'whatsapp-summary-weekly'
    )
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;
