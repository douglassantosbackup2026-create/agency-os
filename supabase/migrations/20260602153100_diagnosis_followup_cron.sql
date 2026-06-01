-- Cron diário: reavaliação de métricas 30d (diagnosis-followup)

CREATE OR REPLACE FUNCTION public.setup_retentio_cron_jobs(p_cron_bearer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $func$
DECLARE
  v_base text := 'https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1';
  v_bearer text;
  v_scheduled text[] := ARRAY[]::text[];
  r RECORD;
  v_names text[] := ARRAY[
    'cron-dispatch-health-daily',
    'cron-dispatch-alerts-hourly',
    'cron-dispatch-ai-jobs',
    'whatsapp-summary-daily',
    'whatsapp-summary-weekly',
    'refresh-client-metrics-28d-nightly',
    'retention-cleanup-weekly',
    'cleanup-stale-sync-runs-hourly',
    'process-diagnosis-batch',
    'diagnosis-followup-daily',
    'evaluate-alerts-hourly',
    'compute-health-scores-daily',
    'compute-health-scores',
    'evaluate-alerts'
  ];
  v_name text;
BEGIN
  IF p_cron_bearer IS NULL OR length(trim(p_cron_bearer)) < 8 THEN
    RAISE EXCEPTION 'p_cron_bearer inválido (use o CRON_SECRET das Edge Functions)';
  END IF;

  v_bearer := 'Bearer ' || trim(p_cron_bearer);

  FOREACH v_name IN ARRAY v_names LOOP
    FOR r IN SELECT jobid FROM cron.job WHERE jobname = v_name LOOP
      PERFORM cron.unschedule(r.jobid);
    END LOOP;
  END LOOP;

  PERFORM cron.schedule(
    'cron-dispatch-health-daily',
    '0 4 * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body := '{"jobs":"compute-health-scores"}'::jsonb
      );
      $cmd$,
      v_base || '/cron-dispatch-agency-jobs',
      v_bearer
    )
  );
  v_scheduled := array_append(v_scheduled, 'cron-dispatch-health-daily');

  PERFORM cron.schedule(
    'cron-dispatch-alerts-hourly',
    '0 * * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body := '{"jobs":"evaluate-alerts"}'::jsonb
      );
      $cmd$,
      v_base || '/cron-dispatch-agency-jobs',
      v_bearer
    )
  );
  v_scheduled := array_append(v_scheduled, 'cron-dispatch-alerts-hourly');

  PERFORM cron.schedule(
    'cron-dispatch-ai-jobs',
    '*/2 * * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body := '{"jobs":"process-ai-jobs"}'::jsonb
      );
      $cmd$,
      v_base || '/cron-dispatch-agency-jobs',
      v_bearer
    )
  );
  v_scheduled := array_append(v_scheduled, 'cron-dispatch-ai-jobs');

  PERFORM cron.schedule(
    'whatsapp-summary-daily',
    '0 9 * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body := '{}'::jsonb
      );
      $cmd$,
      v_base || '/whatsapp-summary?period=daily',
      v_bearer
    )
  );
  v_scheduled := array_append(v_scheduled, 'whatsapp-summary-daily');

  PERFORM cron.schedule(
    'whatsapp-summary-weekly',
    '0 9 * * 1',
    format(
      $cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body := '{}'::jsonb
      );
      $cmd$,
      v_base || '/whatsapp-summary?period=weekly',
      v_bearer
    )
  );
  v_scheduled := array_append(v_scheduled, 'whatsapp-summary-weekly');

  PERFORM cron.schedule(
    'refresh-client-metrics-28d-nightly',
    '15 3 * * *',
    'SELECT public.refresh_client_metrics_28d(NULL);'
  );
  v_scheduled := array_append(v_scheduled, 'refresh-client-metrics-28d-nightly');

  PERFORM cron.schedule(
    'retention-cleanup-weekly',
    '0 3 * * 0',
    'SELECT public.retention_cleanup_ops();'
  );
  v_scheduled := array_append(v_scheduled, 'retention-cleanup-weekly');

  PERFORM cron.schedule(
    'cleanup-stale-sync-runs-hourly',
    '15 * * * *',
    'SELECT public.cleanup_stale_sync_runs();'
  );
  v_scheduled := array_append(v_scheduled, 'cleanup-stale-sync-runs-hourly');

  PERFORM cron.schedule(
    'process-diagnosis-batch',
    '*/5 * * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body := '{}'::jsonb
      );
      $cmd$,
      v_base || '/process-diagnosis',
      v_bearer
    )
  );
  v_scheduled := array_append(v_scheduled, 'process-diagnosis-batch');

  PERFORM cron.schedule(
    'diagnosis-followup-daily',
    '0 6 * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body := '{}'::jsonb
      );
      $cmd$,
      v_base || '/diagnosis-followup',
      v_bearer
    )
  );
  v_scheduled := array_append(v_scheduled, 'diagnosis-followup-daily');

  RETURN jsonb_build_object(
    'ok', true,
    'scheduled', to_jsonb(v_scheduled),
    'scheduled_at', now()
  );
END;
$func$;
