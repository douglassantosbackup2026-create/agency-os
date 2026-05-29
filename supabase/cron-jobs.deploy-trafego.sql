-- Projeto ligado (Trafego): substituir __CRON_SECRET_HERE__ pelo CRON_SECRET das Edge Functions.
-- 1) Correr primeiro: supabase/cron-jobs.unschedule-legacy.sql
-- 2) Depois este ficheiro (dispatcher por agência).

SELECT cron.schedule(
  'cron-dispatch-health-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/cron-dispatch-agency-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __CRON_SECRET_HERE__'
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
    url := 'https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/cron-dispatch-agency-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __CRON_SECRET_HERE__'
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
    url := 'https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/cron-dispatch-agency-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __CRON_SECRET_HERE__'
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
    url := 'https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/whatsapp-summary?period=daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __CRON_SECRET_HERE__'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'whatsapp-summary-weekly',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/whatsapp-summary?period=weekly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __CRON_SECRET_HERE__'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'refresh-client-metrics-28d-nightly',
  '15 3 * * *',
  $$
  SELECT public.refresh_client_metrics_28d(NULL);
  $$
);

SELECT cron.schedule(
  'retention-cleanup-weekly',
  '0 3 * * 0',
  $$
  SELECT public.retention_cleanup_ops();
  $$
);

SELECT cron.schedule(
  'process-diagnosis-batch',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/process-diagnosis',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __CRON_SECRET_HERE__'
    ),
    body := '{}'::jsonb
  );
  $$
);
