-- Schedule daily WhatsApp summaries at 09:00 UTC
select cron.schedule(
  'whatsapp-summary-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url:='https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/whatsapp-summary?period=daily',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dW90YXhpa3V4ZWpmZWl0bGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzk4MjcsImV4cCI6MjA5Mzg1NTgyN30.32xOultMJNFLQ98Nw3VxQR5t5wyEH1NxTyg6K_bMl_s"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Schedule weekly summaries Mondays at 09:00 UTC
select cron.schedule(
  'whatsapp-summary-weekly',
  '0 9 * * 1',
  $$
  select net.http_post(
    url:='https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/whatsapp-summary?period=weekly',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dW90YXhpa3V4ZWpmZWl0bGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzk4MjcsImV4cCI6MjA5Mzg1NTgyN30.32xOultMJNFLQ98Nw3VxQR5t5wyEH1NxTyg6K_bMl_s"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);