-- Template: agendar Edge Functions com pg_cron + pg_net após definir CRON_SECRET nas secrets das functions.
-- Substitua <PROJECT_REF>, <CRON_SECRET> e ajuste horários.
-- Requer extensões: pg_cron, pg_net (já habituais em projetos Supabase).
--
-- Depois de aplicar:
--   SELECT * FROM cron.job;
--   Ver logs das Edge Functions e do pg_net para confirmar chamadas bem-sucedidas.
-- Produção relacionada:
--   - PORTAL_ALLOWED_ORIGINS (CORS estrito para portal público).
--   - Rotação de CRON_SECRET e chaves JWT se já expostas histórico.
-- Para remover antes de criar novo job com o mesmo nome:
-- SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'compute-health-scores-daily';

SELECT cron.schedule(
  'compute-health-scores-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/compute-health-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'evaluate-alerts-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/evaluate-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
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
  'whatsapp-summary-weekly',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-summary?period=weekly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
