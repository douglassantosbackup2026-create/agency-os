-- pg_matviews.last_refresh não existe em todas as versões PG do Supabase; gravar no ops config.

CREATE OR REPLACE FUNCTION public.refresh_client_metrics_28d(p_client_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_metrics_28d;
  UPDATE public.retentio_ops_config
  SET
    dispatch_state = jsonb_set(
      COALESCE(dispatch_state, '{}'::jsonb),
      '{mv_client_metrics_28d_last_refresh}',
      to_jsonb(now()::text),
      true
    ),
    updated_at = now()
  WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_resilience_ops_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stale_running bigint;
  v_total_runs_24h bigint;
  v_pending_ai bigint;
  v_mv_last timestamptz;
  v_large_agencies jsonb;
  v_dispatch jsonb;
BEGIN
  SELECT COUNT(*) INTO v_stale_running
  FROM public.sync_runs
  WHERE status = 'running'
    AND created_at < now() - interval '30 minutes';

  SELECT COUNT(*) INTO v_total_runs_24h
  FROM public.sync_runs
  WHERE created_at > now() - interval '24 hours';

  SELECT COUNT(*) INTO v_pending_ai
  FROM public.ai_jobs
  WHERE status = 'pending';

  SELECT dispatch_state INTO v_dispatch
  FROM public.retentio_ops_config
  WHERE id = 1;

  BEGIN
    v_mv_last := (v_dispatch ->> 'mv_client_metrics_28d_last_refresh')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    v_mv_last := NULL;
  END;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  INTO v_large_agencies
  FROM (
    SELECT a.id, a.name, COUNT(c.id)::integer AS client_count
    FROM public.agencies a
    JOIN public.clients c ON c.agency_id = a.id
    GROUP BY a.id, a.name
    HAVING COUNT(c.id) > 100
    ORDER BY COUNT(c.id) DESC
    LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'stale_sync_running', v_stale_running,
    'sync_runs_24h', v_total_runs_24h,
    'stale_running_pct',
      CASE WHEN v_total_runs_24h > 0
        THEN round((v_stale_running::numeric / v_total_runs_24h) * 100, 4)
        ELSE 0
      END,
    'ai_jobs_pending', v_pending_ai,
    'mv_client_metrics_28d_last_refresh', v_mv_last,
    'agencies_over_100_clients', v_large_agencies,
    'checked_at', now()
  );
END;
$$;
