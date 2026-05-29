-- Pós-fase 3: dashboard alerts/activities na RPC, batch de clientes por agência, snapshot ops

ALTER TYPE public.ai_job_type ADD VALUE IF NOT EXISTS 'meeting_report';

-- Batch de clientes intra-agência (cursor em retentio_ops_config.dispatch_state.agency_clients)
CREATE OR REPLACE FUNCTION public.get_agency_client_batch(
  p_agency_id uuid,
  p_job_key text,
  p_limit integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state jsonb;
  v_agency_clients jsonb;
  v_job_state jsonb;
  v_after uuid;
  v_ids uuid[];
  v_last uuid;
  v_done boolean := false;
  v_key text;
BEGIN
  p_limit := GREATEST(1, LEAST(COALESCE(p_limit, 25), 100));
  p_job_key := COALESCE(NULLIF(trim(p_job_key), ''), 'default');
  v_key := p_agency_id::text || ':' || p_job_key;

  SELECT dispatch_state INTO v_state FROM public.retentio_ops_config WHERE id = 1;
  v_agency_clients := COALESCE(v_state -> 'agency_clients', '{}'::jsonb);
  v_job_state := COALESCE(v_agency_clients -> v_key, '{}'::jsonb);

  BEGIN
    v_after := (v_job_state ->> 'after_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_after := NULL;
  END;

  SELECT array_agg(id ORDER BY id)
  INTO v_ids
  FROM (
    SELECT id
    FROM public.clients
    WHERE agency_id = p_agency_id
      AND (v_after IS NULL OR id > v_after)
    ORDER BY id
    LIMIT p_limit
  ) sub;

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    SELECT array_agg(id ORDER BY id)
    INTO v_ids
    FROM (
      SELECT id FROM public.clients
      WHERE agency_id = p_agency_id
      ORDER BY id
      LIMIT p_limit
    ) wrap;
    v_done := true;
  ELSIF (
    SELECT COUNT(*) FROM public.clients c
    WHERE c.agency_id = p_agency_id AND c.id > v_ids[cardinality(v_ids)]
  ) = 0 THEN
    v_done := true;
  END IF;

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object(
      'client_ids', '[]'::jsonb,
      'count', 0,
      'wrapped', true,
      'after_id', null
    );
  END IF;

  v_last := v_ids[cardinality(v_ids)];

  UPDATE public.retentio_ops_config
  SET
    dispatch_state = jsonb_set(
      COALESCE(dispatch_state, '{}'::jsonb),
      '{agency_clients}',
      COALESCE(dispatch_state -> 'agency_clients', '{}'::jsonb)
        || jsonb_build_object(
          v_key,
          jsonb_build_object(
            'after_id', v_last::text,
            'wrapped', v_done,
            'updated_at', now()
          )
        ),
      true
    ),
    updated_at = now()
  WHERE id = 1;

  RETURN jsonb_build_object(
    'client_ids', to_jsonb(v_ids),
    'count', COALESCE(cardinality(v_ids), 0),
    'wrapped', v_done,
    'after_id', v_last
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_agency_client_batch(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agency_client_batch(uuid, text, integer) TO service_role;

-- Snapshot operacional (locks, fila IA, MV, agências grandes)
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

  SELECT last_refresh INTO v_mv_last
  FROM pg_matviews
  WHERE schemaname = 'public' AND matviewname = 'client_metrics_28d';

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

REVOKE ALL ON FUNCTION public.get_resilience_ops_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_resilience_ops_snapshot() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_resilience_ops_snapshot() TO authenticated;

-- Estender dashboard RPC com alerts + activities (1 round-trip no client)
CREATE OR REPLACE FUNCTION public.get_agency_dashboard_detail(p_agency_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_since60 date := CURRENT_DATE - 60;
  v_since14 date := CURRENT_DATE - 14;
  v_focus uuid[];
  v_result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_member_of(p_agency_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT array_agg(client_id)
  INTO v_focus
  FROM (
    SELECT client_id
    FROM public.campaign_audit_summary_by_client_mv
    WHERE agency_id = p_agency_id
      AND critical_count > 0
    ORDER BY last_audit_at DESC NULLS LAST
    LIMIT 12
  ) f;

  v_result := jsonb_build_object(
    'ops_snapshot', public.get_agency_dashboard_snapshot(p_agency_id),
    'audit_mv', COALESCE((
      SELECT jsonb_agg(to_jsonb(t))
      FROM (
        SELECT client_id, critical_count, last_audit_at, client_name
        FROM public.campaign_audit_summary_by_client_mv
        WHERE agency_id = p_agency_id
        ORDER BY last_audit_at DESC NULLS LAST
      ) t
    ), '[]'::jsonb),
    'clients', COALESCE((
      SELECT jsonb_agg(to_jsonb(c))
      FROM (
        SELECT id, name, status, mrr, monthly_budget, started_at
        FROM public.clients
        WHERE agency_id = p_agency_id
      ) c
    ), '[]'::jsonb),
    'metrics', COALESCE((
      SELECT jsonb_agg(to_jsonb(m))
      FROM (
        SELECT date, spend, revenue, roas
        FROM public.metrics_daily
        WHERE agency_id = p_agency_id
          AND campaign_id IS NULL
          AND date >= v_since60
      ) m
    ), '[]'::jsonb),
    'health', COALESCE((
      SELECT jsonb_agg(to_jsonb(h))
      FROM (
        SELECT DISTINCT ON (client_id)
          client_id, score, risk, recorded_at
        FROM public.health_scores
        WHERE agency_id = p_agency_id
        ORDER BY client_id, recorded_at DESC
      ) h
    ), '[]'::jsonb),
    'campaign_metrics', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'campaign_id', md.campaign_id,
          'date', md.date,
          'roas', md.roas,
          'campaigns', jsonb_build_object('name', cp.name)
        )
      )
      FROM public.metrics_daily md
      JOIN public.campaigns cp ON cp.id = md.campaign_id
      WHERE md.agency_id = p_agency_id
        AND md.campaign_id IS NOT NULL
        AND md.date >= v_since14
    ), '[]'::jsonb),
    'ga4_daily', COALESCE((
      SELECT jsonb_agg(to_jsonb(g))
      FROM (
        SELECT date, sessions, conversions, revenue, conversion_rate, avg_ticket
        FROM public.ga4_daily
        WHERE agency_id = p_agency_id
          AND date >= v_since60
      ) g
    ), '[]'::jsonb),
    'ga4_tracking', COALESCE((
      SELECT jsonb_agg(to_jsonb(t))
      FROM (
        SELECT status
        FROM public.ga4_tracking_health_daily
        WHERE agency_id = p_agency_id
          AND date >= v_since14
      ) t
    ), '[]'::jsonb),
    'action_center', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ac.id,
          'title', ac.title,
          'priority', ac.priority,
          'due_date', ac.due_date,
          'status', ac.status,
          'client_id', ac.client_id,
          'clients', jsonb_build_object('name', cl.name)
        )
      )
      FROM (
        SELECT id, title, priority, due_date, status, client_id
        FROM public.action_center
        WHERE agency_id = p_agency_id
          AND status IN (
            'pendente', 'revisar_depois', 'adiado', 'anotacao', 'enviado_cliente'
          )
        ORDER BY priority DESC, created_at DESC
        LIMIT 48
      ) ac
      LEFT JOIN public.clients cl ON cl.id = ac.client_id
    ), '[]'::jsonb),
    'reports_review', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'created_at', r.created_at,
          'confianca', r.confianca,
          'requer_revisao_humana', r.requer_revisao_humana,
          'clients', jsonb_build_object('name', cl.name)
        )
      )
      FROM (
        SELECT id, created_at, confianca, requer_revisao_humana, client_id
        FROM public.reports
        WHERE agency_id = p_agency_id
          AND requer_revisao_humana = true
        ORDER BY created_at DESC
        LIMIT 8
      ) r
      LEFT JOIN public.clients cl ON cl.id = r.client_id
    ), '[]'::jsonb),
    'open_alerts', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', al.id,
          'title', al.title,
          'priority', al.priority,
          'created_at', al.created_at,
          'type', al.type,
          'recommended_action', al.recommended_action,
          'client_id', al.client_id,
          'clients', jsonb_build_object('name', cl.name)
        )
      )
      FROM (
        SELECT id, title, priority, created_at, type, recommended_action, client_id
        FROM public.alerts
        WHERE agency_id = p_agency_id
          AND status = 'open'
        ORDER BY priority DESC, created_at DESC
        LIMIT 48
      ) al
      LEFT JOIN public.clients cl ON cl.id = al.client_id
    ), '[]'::jsonb),
    'activities', COALESCE((
      SELECT jsonb_agg(to_jsonb(act))
      FROM (
        SELECT id, title, description, created_at, type
        FROM public.activities
        WHERE agency_id = p_agency_id
        ORDER BY created_at DESC
        LIMIT 10
      ) act
    ), '[]'::jsonb),
    'agency_briefing', (
      SELECT to_jsonb(ab)
      FROM (
        SELECT buckets, computed_at
        FROM public.agency_briefings
        WHERE agency_id = p_agency_id
        LIMIT 1
      ) ab
    ),
    'campaign_audits', COALESCE((
      SELECT jsonb_agg(to_jsonb(a))
      FROM (
        SELECT id, client_id, created_at, ga4_tracking_health,
               executive_summary_markdown, result_json
        FROM public.campaign_ai_audits
        WHERE agency_id = p_agency_id
          AND (
            v_focus IS NULL
            OR cardinality(v_focus) = 0
            OR client_id = ANY(v_focus)
          )
        ORDER BY created_at DESC
        LIMIT CASE WHEN v_focus IS NOT NULL AND cardinality(v_focus) > 0 THEN 72 ELSE 32 END
      ) a
    ), '[]'::jsonb),
    'checklist_items', COALESCE((
      SELECT jsonb_agg(to_jsonb(i))
      FROM (
        SELECT client_id, step_key, status
        FROM public.onboarding_checklist_items
        WHERE agency_id = p_agency_id
      ) i
    ), '[]'::jsonb),
    'overdue_actions_count', (
      SELECT COUNT(*)::integer
      FROM public.action_center
      WHERE agency_id = p_agency_id
        AND status IN (
          'pendente', 'revisar_depois', 'adiado', 'anotacao', 'enviado_cliente'
        )
        AND due_date IS NOT NULL
        AND due_date < v_today
    )
  );

  RETURN v_result;
END;
$$;
