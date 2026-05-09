-- Projeto ligado (Trafego): só substituir **todas** as ocorrências de __CRON_SECRET_HERE__
-- pelo valor igual ao secret CRON_SECRET nas Edge Functions (Dashboard → Secrets).
-- Executar no SQL Editor do Supabase para este projeto.
--
-- Estado atual (após migrations): cron.job pode estar vazio até correr este script.

SELECT cron.schedule(
  'compute-health-scores-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/compute-health-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __CRON_SECRET_HERE__'
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
    url := 'https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/evaluate-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __CRON_SECRET_HERE__'
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
