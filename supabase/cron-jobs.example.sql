-- Template: dispatcher por agência + worker IA + retenção.
-- Substitua <PROJECT_REF> e <CRON_SECRET>.

SELECT cron.schedule(
  'cron-dispatch-health-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cron-dispatch-agency-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{"jobs":"compute-health-scores"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'cron-dispatch-alerts-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cron-dispatch-agency-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{"jobs":"evaluate-alerts"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'cron-dispatch-ai-jobs',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cron-dispatch-agency-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{"jobs":"process-ai-jobs"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'whatsapp-summary-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-summary?period=daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'retention-cleanup-weekly',
  '0 3 * * 0',
  $$
  SELECT public.retention_cleanup_ops();
  $$
);
