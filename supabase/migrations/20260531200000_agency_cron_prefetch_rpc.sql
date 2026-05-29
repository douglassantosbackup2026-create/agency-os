-- RPC única para prefetch dos crons (≤3 queries totais: clients + esta RPC + audits opcional).

CREATE OR REPLACE FUNCTION public.get_agency_cron_prefetch(
  p_agency_id uuid,
  p_client_ids uuid[],
  p_since date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'metrics_daily',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'client_id', m.client_id,
            'date', m.date,
            'spend', m.spend,
            'revenue', m.revenue,
            'roas', m.roas,
            'cpa', m.cpa,
            'ctr', m.ctr,
            'conversions', m.conversions
          )
          ORDER BY m.client_id, m.date
        )
        FROM public.metrics_daily m
        WHERE m.client_id = ANY (p_client_ids)
          AND m.campaign_id IS NULL
          AND m.date >= p_since
      ),
      '[]'::jsonb
    ),
    'ga4_daily',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'client_id', g.client_id,
            'date', g.date,
            'sessions', g.sessions,
            'conversions', g.conversions,
            'revenue', g.revenue
          )
          ORDER BY g.client_id, g.date
        )
        FROM public.ga4_daily g
        WHERE g.client_id = ANY (p_client_ids)
          AND g.date >= p_since
      ),
      '[]'::jsonb
    ),
    'ga4_funnel',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'client_id', f.client_id,
            'date', f.date,
            'add_to_cart', f.add_to_cart,
            'begin_checkout', f.begin_checkout,
            'purchase', f.purchase,
            'add_to_cart_rate', f.add_to_cart_rate,
            'checkout_rate', f.checkout_rate,
            'purchase_rate', f.purchase_rate
          )
          ORDER BY f.client_id, f.date
        )
        FROM public.ga4_funnel_daily f
        WHERE f.client_id = ANY (p_client_ids)
          AND f.date >= p_since
      ),
      '[]'::jsonb
    ),
    'open_alerts',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('client_id', a.client_id, 'type', a.type)
        )
        FROM public.alerts a
        WHERE a.client_id = ANY (p_client_ids)
          AND a.status = 'open'
      ),
      '[]'::jsonb
    ),
    'notes',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('client_id', n.client_id, 'created_at', n.created_at)
          ORDER BY n.client_id, n.created_at DESC
        )
        FROM (
          SELECT DISTINCT ON (n2.client_id)
            n2.client_id,
            n2.created_at
          FROM public.notes n2
          WHERE n2.client_id = ANY (p_client_ids)
          ORDER BY n2.client_id, n2.created_at DESC
        ) n
      ),
      '[]'::jsonb
    ),
    'tracking',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'client_id', t.client_id,
            'status', t.status,
            'notes', t.notes
          )
        )
        FROM (
          SELECT DISTINCT ON (t2.client_id)
            t2.client_id,
            t2.status,
            t2.notes
          FROM public.ga4_tracking_health_daily t2
          WHERE t2.client_id = ANY (p_client_ids)
          ORDER BY t2.client_id, t2.date DESC
        ) t
      ),
      '[]'::jsonb
    ),
    'metrics_28d',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'client_id', mv.client_id,
            'days_with_data', mv.days_with_data,
            'spend_28d', mv.spend_28d,
            'roas_28d', mv.roas_28d
          )
        )
        FROM public.client_metrics_28d mv
        WHERE mv.client_id = ANY (p_client_ids)
          AND (p_agency_id IS NULL OR mv.agency_id = p_agency_id)
      ),
      '[]'::jsonb
    ),
    'activities',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('client_id', act.client_id, 'created_at', act.created_at)
        )
        FROM (
          SELECT DISTINCT ON (a2.client_id)
            a2.client_id,
            a2.created_at
          FROM public.activities a2
          WHERE a2.client_id = ANY (p_client_ids)
          ORDER BY a2.client_id, a2.created_at DESC
        ) act
      ),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_agency_cron_prefetch(uuid, uuid[], date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agency_cron_prefetch(uuid, uuid[], date) TO service_role;

COMMENT ON FUNCTION public.get_agency_cron_prefetch(uuid, uuid[], date) IS
  'Bundle de prefetch para evaluate-alerts / compute-health-scores (1 RPC).';
