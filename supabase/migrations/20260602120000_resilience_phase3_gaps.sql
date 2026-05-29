-- Fase 3 resiliência: Realtime em ai_jobs + métricas/health para dashboard

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.metrics_daily;
ALTER PUBLICATION supabase_realtime ADD TABLE public.health_scores;
