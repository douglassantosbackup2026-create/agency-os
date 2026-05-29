-- P1: fila IA, orçamento; P2: MV métricas, retenção, dashboard RPC

CREATE TYPE public.ai_job_type AS ENUM ('report', 'campaign_audit', 'diagnosis');
CREATE TYPE public.ai_job_status AS ENUM (
  'pending',
  'processing',
  'done',
  'failed'
);

CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  job_type public.ai_job_type NOT NULL,
  status public.ai_job_status NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_ref uuid,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_pending
  ON public.ai_jobs (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_jobs_agency_created
  ON public.ai_jobs (agency_id, created_at DESC);

ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_jobs_select ON public.ai_jobs
  FOR SELECT
  USING (public.is_member_of(agency_id));

CREATE POLICY ai_jobs_insert_deny ON public.ai_jobs
  FOR INSERT
  WITH CHECK (false);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS max_ai_tokens_per_day integer NOT NULL DEFAULT 500000,
  ADD COLUMN IF NOT EXISTS max_ai_jobs_per_day integer NOT NULL DEFAULT 50;

CREATE OR REPLACE FUNCTION public.check_ai_budget(
  p_agency_id uuid,
  p_estimated_tokens integer DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'utc')::date;
  v_max_tokens integer;
  v_max_jobs integer;
  v_used_tokens bigint;
  v_pending_jobs bigint;
BEGIN
  SELECT
    COALESCE(s.max_ai_tokens_per_day, 500000),
    COALESCE(s.max_ai_jobs_per_day, 50)
  INTO v_max_tokens, v_max_jobs
  FROM public.subscriptions s
  WHERE s.agency_id = p_agency_id
  LIMIT 1;

  IF v_max_tokens IS NULL THEN
    v_max_tokens := 500000;
    v_max_jobs := 50;
  END IF;

  SELECT COALESCE(SUM(e.prompt_tokens + e.completion_tokens), 0)
  INTO v_used_tokens
  FROM public.ai_usage_events e
  WHERE e.agency_id = p_agency_id
    AND e.day = v_day;

  SELECT COUNT(*)
  INTO v_pending_jobs
  FROM public.ai_jobs j
  WHERE j.agency_id = p_agency_id
    AND j.created_at::date = v_day
    AND j.status IN ('pending', 'processing');

  IF v_used_tokens + GREATEST(p_estimated_tokens, 0) > v_max_tokens THEN
    RETURN true;
  END IF;

  IF v_pending_jobs >= v_max_jobs THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.check_ai_budget(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ai_budget(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_ai_jobs(p_limit integer DEFAULT 5)
RETURNS SETOF public.ai_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.ai_jobs j
  SET
    status = 'processing',
    started_at = now(),
    attempts = j.attempts + 1
  WHERE j.id IN (
    SELECT id
    FROM public.ai_jobs
    WHERE status = 'pending'
    ORDER BY created_at
    LIMIT GREATEST(1, LEAST(p_limit, 20))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ai_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_jobs(integer) TO service_role;

-- MV métricas 28d (nível conta, campaign_id null)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.client_metrics_28d AS
SELECT
  m.client_id,
  m.agency_id,
  COUNT(*) FILTER (WHERE m.date >= (CURRENT_DATE - 27)) AS days_with_data,
  COALESCE(SUM(m.spend), 0) AS spend_28d,
  COALESCE(SUM(m.revenue), 0) AS revenue_28d,
  COALESCE(SUM(m.conversions), 0) AS conversions_28d,
  CASE
    WHEN COALESCE(SUM(m.spend), 0) > 0
    THEN COALESCE(SUM(m.revenue), 0) / SUM(m.spend)
    ELSE 0
  END AS roas_28d,
  MAX(m.date) AS last_metric_date
FROM public.metrics_daily m
WHERE m.campaign_id IS NULL
  AND m.date >= (CURRENT_DATE - 27)
GROUP BY m.client_id, m.agency_id;

CREATE UNIQUE INDEX IF NOT EXISTS client_metrics_28d_client_uidx
  ON public.client_metrics_28d (client_id);

CREATE OR REPLACE FUNCTION public.refresh_client_metrics_28d(p_client_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_client_id IS NULL THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_metrics_28d;
  ELSE
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_metrics_28d;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_client_metrics_28d(uuid) TO service_role;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.campaign_audit_summary_by_client_mv AS
SELECT
  a.agency_id,
  a.client_id,
  c.name AS client_name,
  COUNT(*) AS total_audits,
  MAX(a.created_at) AS last_audit_at,
  ROUND(AVG((a.result_json->>'overall_score')::numeric), 1) AS avg_score,
  SUM(
    CASE WHEN a.result_json->>'overall_status' = 'critical' THEN 1 ELSE 0 END
  ) AS critical_count,
  COUNT(*) FILTER (WHERE s.user_action = 'task_created') AS tasks_created,
  COUNT(*) FILTER (WHERE s.user_action = 'dismissed') AS dismissed_count
FROM public.campaign_ai_audits a
JOIN public.clients c ON c.id = a.client_id
LEFT JOIN public.campaign_ai_audit_recommendation_status s ON s.audit_id = a.id
GROUP BY a.agency_id, a.client_id, c.name;

CREATE UNIQUE INDEX IF NOT EXISTS campaign_audit_summary_mv_uidx
  ON public.campaign_audit_summary_by_client_mv (agency_id, client_id);

CREATE OR REPLACE FUNCTION public.get_agency_dashboard_snapshot(p_agency_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'open_alerts_count',
    (SELECT COUNT(*) FROM public.alerts al WHERE al.agency_id = p_agency_id AND al.status = 'open'),
    'clients_active',
    (SELECT COUNT(*) FROM public.clients cl WHERE cl.agency_id = p_agency_id AND cl.status = 'active'),
    'pending_ai_jobs',
    (SELECT COUNT(*) FROM public.ai_jobs j WHERE j.agency_id = p_agency_id AND j.status = 'pending'),
    'metrics_clients_28d',
    (SELECT COUNT(*) FROM public.client_metrics_28d mv WHERE mv.agency_id = p_agency_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_agency_dashboard_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_dashboard_snapshot(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_stale_sync_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.sync_runs
  SET status = 'error',
      error_message = COALESCE(error_message, 'stale running lock'),
      duration_ms = NULL
  WHERE status = 'running'
    AND created_at < now() - interval '30 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_stale_sync_runs() TO service_role;

CREATE OR REPLACE FUNCTION public.retention_cleanup_ops()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sync integer;
  v_ai integer;
BEGIN
  DELETE FROM public.sync_runs WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_sync = ROW_COUNT;
  DELETE FROM public.ai_usage_events WHERE day < (CURRENT_DATE - 180);
  GET DIAGNOSTICS v_ai = ROW_COUNT;
  PERFORM public.cleanup_stale_sync_runs();
  RETURN jsonb_build_object('sync_runs_deleted', v_sync, 'ai_usage_deleted', v_ai);
END;
$$;

GRANT EXECUTE ON FUNCTION public.retention_cleanup_ops() TO service_role;
