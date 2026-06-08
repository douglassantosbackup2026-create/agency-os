-- Security P1: RPC tenant guards, client scope helper, clients_insert fix, core RLS enable, realtime ai-job policy.

-- ---------------------------------------------------------------------------
-- Helper: member can access a client row (mirrors Edge membership.ts logic)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_can_access_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_client_id IS NULL THEN true
    WHEN auth.uid() IS NULL THEN true
    WHEN NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = p_client_id) THEN false
    ELSE (
      public.is_owner_or_admin(
        (SELECT c.agency_id FROM public.clients c WHERE c.id = p_client_id)
      )
      OR (
        public.is_member_of(
          (SELECT c.agency_id FROM public.clients c WHERE c.id = p_client_id)
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM public.client_member_scopes s
            WHERE s.user_id = auth.uid()
              AND s.agency_id = (
                SELECT c.agency_id FROM public.clients c WHERE c.id = p_client_id
              )
          )
          OR EXISTS (
            SELECT 1 FROM public.client_member_scopes s
            WHERE s.user_id = auth.uid() AND s.client_id = p_client_id
          )
        )
      )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.user_can_access_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_client(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- clients_insert: count via SECURITY DEFINER (not RLS-filtered subquery)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_agency_clients(p_agency_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.clients WHERE agency_id = p_agency_id;
$$;

REVOKE ALL ON FUNCTION public.count_agency_clients(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_agency_clients(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_agency_clients(uuid) TO service_role;

DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of(agency_id)
    AND public.count_agency_clients(agency_id) < COALESCE(
      (SELECT s.max_clients FROM public.subscriptions s WHERE s.agency_id = clients.agency_id LIMIT 1),
      5
    )
  );

-- ---------------------------------------------------------------------------
-- get_agency_dashboard_snapshot: require agency membership
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_dashboard_snapshot(p_agency_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_member_of(p_agency_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'open_alerts_count',
    (SELECT COUNT(*) FROM public.alerts al
     WHERE al.agency_id = p_agency_id AND al.status = 'open'
       AND (al.client_id IS NULL OR public.user_can_access_client(al.client_id))),
    'clients_active',
    (SELECT COUNT(*) FROM public.clients cl
     WHERE cl.agency_id = p_agency_id AND cl.status = 'active'
       AND public.user_can_access_client(cl.id)),
    'pending_ai_jobs',
    (SELECT COUNT(*) FROM public.ai_jobs j
     WHERE j.agency_id = p_agency_id AND j.status = 'pending'
       AND (j.client_id IS NULL OR public.user_can_access_client(j.client_id))),
    'metrics_clients_28d',
    (SELECT COUNT(*) FROM public.client_metrics_28d mv
     WHERE mv.agency_id = p_agency_id
       AND public.user_can_access_client(mv.client_id))
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- get_resilience_ops_snapshot: platform admin only (authenticated)
-- ---------------------------------------------------------------------------
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
  IF auth.uid() IS NOT NULL AND NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

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

-- ---------------------------------------------------------------------------
-- get_agency_dashboard_detail: filter client-scoped rows for partial members
-- ---------------------------------------------------------------------------
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
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(client_id)
  INTO v_focus
  FROM (
    SELECT client_id
    FROM public.campaign_audit_summary_by_client_mv
    WHERE agency_id = p_agency_id
      AND critical_count > 0
      AND public.user_can_access_client(client_id)
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
          AND public.user_can_access_client(client_id)
        ORDER BY last_audit_at DESC NULLS LAST
      ) t
    ), '[]'::jsonb),
    'clients', COALESCE((
      SELECT jsonb_agg(to_jsonb(c))
      FROM (
        SELECT id, name, status, mrr, monthly_budget, started_at
        FROM public.clients
        WHERE agency_id = p_agency_id
          AND public.user_can_access_client(id)
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
          AND public.user_can_access_client(client_id)
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
        AND public.user_can_access_client(cp.client_id)
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
          AND (client_id IS NULL OR public.user_can_access_client(client_id))
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
          AND public.user_can_access_client(client_id)
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
          AND (client_id IS NULL OR public.user_can_access_client(client_id))
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
          AND public.user_can_access_client(client_id)
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
          AND public.user_can_access_client(client_id)
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
        AND (client_id IS NULL OR public.user_can_access_client(client_id))
    )
  );

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- Core tables: ensure RLS enabled (idempotent for fresh installs)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'agencies', 'profiles', 'user_roles', 'clients', 'campaigns',
    'metrics_daily', 'health_scores', 'alerts', 'activities', 'reports',
    'notes', 'tasks', 'integrations', 'whatsapp_logs', 'feature_flags',
    'notifications'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Realtime: ai-job topics require membership on the job's agency
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read agency topics" ON realtime.messages;
CREATE POLICY "Authenticated read agency topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    realtime.topic() LIKE 'ai-job:%'
    AND EXISTS (
      SELECT 1 FROM public.ai_jobs j
      WHERE j.id = (split_part(realtime.topic(), ':', 2))::uuid
        AND public.is_member_of(j.agency_id)
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND realtime.topic() LIKE '%:' || ur.agency_id::text
  )
);
