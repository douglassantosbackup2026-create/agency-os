-- P0 resiliência: lock de sync, upsert metrics_daily, índices.

-- sync_runs: status running + lock por client/provider
ALTER TABLE public.sync_runs DROP CONSTRAINT IF EXISTS sync_runs_status_check;
ALTER TABLE public.sync_runs
  ADD CONSTRAINT sync_runs_status_check
  CHECK (status IN ('ok', 'warning', 'error', 'running'));

CREATE UNIQUE INDEX IF NOT EXISTS sync_runs_one_running_per_client_provider
  ON public.sync_runs (client_id, provider)
  WHERE status = 'running' AND client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sync_runs_client_provider_created
  ON public.sync_runs (client_id, provider, created_at DESC);

-- metrics_daily: dedupe antes do unique
DELETE FROM public.metrics_daily a
USING public.metrics_daily b
WHERE a.id > b.id
  AND a.client_id = b.client_id
  AND a.date = b.date
  AND (a.campaign_id IS NOT DISTINCT FROM b.campaign_id);

-- PG14-safe: índices parciais (NULLS NOT DISTINCT exige PG15+)
CREATE UNIQUE INDEX IF NOT EXISTS metrics_daily_client_date_account_uidx
  ON public.metrics_daily (client_id, date)
  WHERE campaign_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS metrics_daily_client_date_campaign_uidx
  ON public.metrics_daily (client_id, date, campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_metrics_client_campaign_date
  ON public.metrics_daily (client_id, campaign_id, date DESC);

CREATE OR REPLACE FUNCTION public.upsert_metrics_daily_batch(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN;
  END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    IF (r->>'campaign_id') IS NULL OR (r->>'campaign_id') = '' THEN
      INSERT INTO public.metrics_daily (
        agency_id, client_id, campaign_id, date,
        spend, revenue, conversions, impressions, clicks, roas, cpa, ctr
      ) VALUES (
        (r->>'agency_id')::uuid,
        (r->>'client_id')::uuid,
        NULL,
        (r->>'date')::date,
        COALESCE((r->>'spend')::numeric, 0),
        COALESCE((r->>'revenue')::numeric, 0),
        COALESCE((r->>'conversions')::bigint, 0),
        COALESCE((r->>'impressions')::bigint, 0),
        COALESCE((r->>'clicks')::bigint, 0),
        COALESCE((r->>'roas')::numeric, 0),
        COALESCE((r->>'cpa')::numeric, 0),
        COALESCE((r->>'ctr')::numeric, 0)
      )
      ON CONFLICT (client_id, date) WHERE campaign_id IS NULL
      DO UPDATE SET
        agency_id = EXCLUDED.agency_id,
        spend = EXCLUDED.spend,
        revenue = EXCLUDED.revenue,
        conversions = EXCLUDED.conversions,
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        roas = EXCLUDED.roas,
        cpa = EXCLUDED.cpa,
        ctr = EXCLUDED.ctr;
    ELSE
      INSERT INTO public.metrics_daily (
        agency_id, client_id, campaign_id, date,
        spend, revenue, conversions, impressions, clicks, roas, cpa, ctr
      ) VALUES (
        (r->>'agency_id')::uuid,
        (r->>'client_id')::uuid,
        (r->>'campaign_id')::uuid,
        (r->>'date')::date,
        COALESCE((r->>'spend')::numeric, 0),
        COALESCE((r->>'revenue')::numeric, 0),
        COALESCE((r->>'conversions')::bigint, 0),
        COALESCE((r->>'impressions')::bigint, 0),
        COALESCE((r->>'clicks')::bigint, 0),
        COALESCE((r->>'roas')::numeric, 0),
        COALESCE((r->>'cpa')::numeric, 0),
        COALESCE((r->>'ctr')::numeric, 0)
      )
      ON CONFLICT (client_id, date, campaign_id) WHERE campaign_id IS NOT NULL
      DO UPDATE SET
        agency_id = EXCLUDED.agency_id,
        spend = EXCLUDED.spend,
        revenue = EXCLUDED.revenue,
        conversions = EXCLUDED.conversions,
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        roas = EXCLUDED.roas,
        cpa = EXCLUDED.cpa,
        ctr = EXCLUDED.ctr;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_metrics_daily_batch(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_metrics_daily_batch(jsonb) TO service_role;

-- Webhook idempotência (P0.6)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  idempotency_key text PRIMARY KEY,
  branch text,
  payload_hash text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhook_events_deny_all ON public.webhook_events
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.webhook_events IS
  'Idempotência de webhooks (Mercado Pago, etc.); apenas service_role.';

-- Última auditoria por cliente (evita scan completo em compute-health-scores)
CREATE OR REPLACE FUNCTION public.get_latest_campaign_audits_for_clients(
  p_client_ids uuid[]
)
RETURNS TABLE (
  client_id uuid,
  created_at timestamptz,
  result_json jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (a.client_id)
    a.client_id,
    a.created_at,
    a.result_json
  FROM public.campaign_ai_audits a
  WHERE a.client_id = ANY (p_client_ids)
  ORDER BY a.client_id, a.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_latest_campaign_audits_for_clients(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_campaign_audits_for_clients(uuid[]) TO service_role;
