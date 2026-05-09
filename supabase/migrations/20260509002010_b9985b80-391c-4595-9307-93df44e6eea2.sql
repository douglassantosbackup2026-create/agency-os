SELECT cron.schedule(
  'compute-health-scores-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url:='https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/compute-health-scores',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dW90YXhpa3V4ZWpmZWl0bGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzk4MjcsImV4cCI6MjA5Mzg1NTgyN30.32xOultMJNFLQ98Nw3VxQR5t5wyEH1NxTyg6K_bMl_s"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'evaluate-alerts-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/evaluate-alerts',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dW90YXhpa3V4ZWpmZWl0bGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzk4MjcsImV4cCI6MjA5Mzg1NTgyN30.32xOultMJNFLQ98Nw3VxQR5t5wyEH1NxTyg6K_bMl_s"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);