-- Dashboard detail RPC, dispatch cursor, MV audit refresh, orphan metrics cleanup

ALTER TABLE public.retentio_ops_config
  ADD COLUMN IF NOT EXISTS dispatch_state jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.get_cron_dispatch_agency_batch(
  p_job_key text,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state jsonb;
  v_after uuid;
  v_ids uuid[];
  v_last uuid;
  v_done boolean := false;
BEGIN
  p_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  p_job_key := COALESCE(NULLIF(trim(p_job_key), ''), 'default');

  SELECT dispatch_state INTO v_state FROM public.retentio_ops_config WHERE id = 1;
  IF v_state IS NULL THEN
    v_state := '{}'::jsonb;
  END IF;

  BEGIN
    v_after := (v_state -> p_job_key ->> 'after_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_after := NULL;
  END;

  SELECT array_agg(id ORDER BY id)
  INTO v_ids
  FROM (
    SELECT id
    FROM public.agencies
    WHERE v_after IS NULL OR id > v_after
    ORDER BY id
    LIMIT p_limit
  ) sub;

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    SELECT array_agg(id ORDER BY id)
    INTO v_ids
    FROM (
      SELECT id FROM public.agencies ORDER BY id LIMIT p_limit
    ) wrap;
    v_done := true;
  ELSIF (
    SELECT COUNT(*) FROM public.agencies a WHERE a.id > v_ids[cardinality(v_ids)]
  ) = 0 THEN
    v_done := true;
  END IF;

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object(
      'agency_ids', '[]'::jsonb,
      'count', 0,
      'wrapped', true,
      'after_id', null
    );
  END IF;

  v_last := v_ids[cardinality(v_ids)];

  UPDATE public.retentio_ops_config
  SET
    dispatch_state = COALESCE(dispatch_state, '{}'::jsonb)
      || jsonb_build_object(
        p_job_key,
        jsonb_build_object(
          'after_id', v_last::text,
          'wrapped', v_done,
          'updated_at', now()
        )
      ),
    updated_at = now()
  WHERE id = 1;

  RETURN jsonb_build_object(
    'agency_ids', to_jsonb(v_ids),
    'count', COALESCE(cardinality(v_ids), 0),
    'wrapped', v_done,
    'after_id', v_last
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_cron_dispatch_agency_batch(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cron_dispatch_agency_batch(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_campaign_audit_summary_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.campaign_audit_summary_by_client_mv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_campaign_audit_summary_mv() TO service_role;

CREATE OR REPLACE FUNCTION public.delete_orphan_metrics_daily_for_sync(
  p_client_id uuid,
  p_dates text[],
  p_campaign_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_client_id IS NULL OR p_dates IS NULL OR cardinality(p_dates) = 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM public.metrics_daily m
  WHERE m.client_id = p_client_id
    AND m.date = ANY(p_dates::date[])
    AND (
      m.campaign_id IS NULL
      OR NOT (m.campaign_id = ANY(COALESCE(p_campaign_ids, ARRAY[]::uuid[])))
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_orphan_metrics_daily_for_sync(uuid, text[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_orphan_metrics_daily_for_sync(uuid, text[], uuid[]) TO service_role;

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

REVOKE ALL ON FUNCTION public.get_agency_dashboard_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agency_dashboard_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_dashboard_detail(uuid) TO service_role;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT jobid FROM cron.job WHERE jobname = 'refresh-campaign-audit-mv-nightly'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'refresh-campaign-audit-mv-nightly',
  '30 3 * * *',
  'SELECT public.refresh_campaign_audit_summary_mv();'
);
