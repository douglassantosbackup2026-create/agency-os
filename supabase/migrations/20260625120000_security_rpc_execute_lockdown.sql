-- P1–P3: lockdown EXECUTE em RPCs SECURITY DEFINER, guards auth.uid(), deny_all em tabelas diagnosis_*.

-- ---------------------------------------------------------------------------
-- Helpers de autorização (fail-closed para anon)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.require_authenticated_agency_member(p_agency_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_member_of(p_agency_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_platform_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- user_can_access_client: anon não passa
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
    WHEN auth.uid() IS NULL THEN false
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

-- ---------------------------------------------------------------------------
-- Dashboard / ops: guards fail-closed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_dashboard_snapshot(p_agency_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_authenticated_agency_member(p_agency_id);

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
  PERFORM public.require_platform_admin();

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

-- get_agency_dashboard_detail: só patch do guard (corpo inalterado via replace da função inteira)
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
  PERFORM public.require_authenticated_agency_member(p_agency_id);

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

-- Platform RPCs: exigir sessão autenticada + platform admin
CREATE OR REPLACE FUNCTION public.auth_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE(
      (SELECT p.is_platform_admin FROM public.profiles p WHERE p.id = auth.uid()),
      false
    );
$$;

CREATE OR REPLACE FUNCTION public.platform_list_agencies_minimal()
RETURNS TABLE (id uuid, name text, slug text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_platform_admin();
  RETURN QUERY
  SELECT a.id, a.name, a.slug, a.created_at
  FROM public.agencies a
  ORDER BY a.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_overview_counts()
RETURNS TABLE (
  agencies_count bigint,
  profiles_with_agency_count bigint,
  clients_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_platform_admin();
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::bigint FROM public.agencies),
    (SELECT COUNT(*)::bigint FROM public.profiles WHERE agency_id IS NOT NULL),
    (SELECT COUNT(*)::bigint FROM public.clients);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_diagnosis_ops_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processing bigint;
  v_stale_processing bigint;
  v_awaiting_payment bigint;
  v_awaiting_connection bigint;
  v_awaiting_account bigint;
  v_completed_24h bigint;
  v_failed_24h bigint;
  v_management_paid_24h bigint;
  v_total bigint;
BEGIN
  PERFORM public.require_platform_admin();

  SELECT COUNT(*) INTO v_total FROM public.diagnoses;
  SELECT COUNT(*) INTO v_processing FROM public.diagnoses WHERE status = 'processing';
  SELECT COUNT(*) INTO v_stale_processing
  FROM public.diagnoses
  WHERE status = 'processing' AND updated_at < now() - interval '30 minutes';
  SELECT COUNT(*) INTO v_awaiting_payment FROM public.diagnoses WHERE status = 'awaiting_payment';
  SELECT COUNT(*) INTO v_awaiting_connection FROM public.diagnoses WHERE status = 'awaiting_connection';
  SELECT COUNT(*) INTO v_awaiting_account FROM public.diagnoses WHERE status = 'awaiting_account_selection';
  SELECT COUNT(*) INTO v_completed_24h
  FROM public.diagnoses WHERE status = 'completed' AND completed_at > now() - interval '24 hours';
  SELECT COUNT(*) INTO v_failed_24h
  FROM public.diagnoses WHERE status = 'failed' AND updated_at > now() - interval '24 hours';
  SELECT COUNT(*) INTO v_management_paid_24h
  FROM public.diagnoses
  WHERE management_status = 'paid' AND management_paid_at > now() - interval '24 hours';

  RETURN jsonb_build_object(
    'total_all_time', v_total,
    'processing', v_processing,
    'stale_processing', v_stale_processing,
    'awaiting_payment', v_awaiting_payment,
    'awaiting_connection', v_awaiting_connection,
    'awaiting_account_selection', v_awaiting_account,
    'completed_24h', v_completed_24h,
    'failed_24h', v_failed_24h,
    'management_paid_24h', v_management_paid_24h,
    'captured_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_diagnosis_funnel_counts(p_days integer DEFAULT 7)
RETURNS TABLE (status text, cnt bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_platform_admin();
  p_days := GREATEST(1, LEAST(COALESCE(p_days, 7), 90));
  RETURN QUERY
  SELECT d.status::text, COUNT(*)::bigint
  FROM public.diagnoses d
  WHERE d.created_at > now() - (p_days || ' days')::interval
  GROUP BY d.status
  ORDER BY cnt DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_diagnosis_list_recent(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_status text DEFAULT NULL,
  p_failed_only_24h boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  secret_slug text,
  status text,
  management_status text,
  created_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz,
  payment_method text,
  amount_cents integer,
  management_amount_cents integer,
  payer_email_masked text,
  prompt_version text,
  failed_reason_short text,
  meta_connected boolean,
  cta_clicked boolean,
  funnel_age_minutes numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_platform_admin();

  p_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
  p_offset := GREATEST(0, COALESCE(p_offset, 0));

  RETURN QUERY
  SELECT
    d.id,
    d.secret_slug,
    d.status::text,
    d.management_status::text,
    d.created_at,
    d.completed_at,
    d.updated_at,
    d.payment_method,
    d.amount_cents,
    d.management_amount_cents,
    CASE
      WHEN d.payer_email IS NULL OR position('@' in d.payer_email) < 2 THEN NULL
      ELSE left(split_part(d.payer_email, '@', 1), 1)
        || '***@'
        || split_part(d.payer_email, '@', 2)
    END AS payer_email_masked,
    r.prompt_version,
    left(d.failed_reason, 120) AS failed_reason_short,
    (d.meta_ad_account_id IS NOT NULL) AS meta_connected,
    (d.cta_clicked_at IS NOT NULL) AS cta_clicked,
    round(extract(epoch FROM (now() - d.created_at)) / 60.0, 1) AS funnel_age_minutes
  FROM public.diagnoses d
  LEFT JOIN public.diagnosis_reports r ON r.diagnosis_id = d.id
  WHERE (p_status IS NULL OR d.status = p_status)
    AND (
      NOT p_failed_only_24h
      OR (d.status = 'failed' AND d.updated_at > now() - interval '24 hours')
    )
  ORDER BY d.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_diagnosis_revenue_summary(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer;
  v_checkout_started bigint;
  v_diagnosis_paid bigint;
  v_diagnosis_revenue bigint;
  v_management_paid bigint;
  v_management_revenue bigint;
  v_completed bigint;
  v_conv numeric;
BEGIN
  PERFORM public.require_platform_admin();

  v_days := GREATEST(1, LEAST(COALESCE(p_days, 7), 90));

  SELECT COUNT(*) INTO v_checkout_started
  FROM public.diagnoses
  WHERE created_at > now() - (v_days || ' days')::interval;

  SELECT COUNT(*), COALESCE(SUM(amount_cents), 0)
  INTO v_diagnosis_paid, v_diagnosis_revenue
  FROM public.diagnoses
  WHERE created_at > now() - (v_days || ' days')::interval
    AND status <> 'awaiting_payment'
    AND mp_payment_id IS NOT NULL;

  SELECT COUNT(*), COALESCE(SUM(management_amount_cents), 0)
  INTO v_management_paid, v_management_revenue
  FROM public.diagnoses
  WHERE management_paid_at > now() - (v_days || ' days')::interval
    AND management_status = 'paid';

  SELECT COUNT(*) INTO v_completed
  FROM public.diagnoses
  WHERE completed_at > now() - (v_days || ' days')::interval
    AND status = 'completed';

  v_conv := CASE
    WHEN v_checkout_started > 0
    THEN round((v_diagnosis_paid::numeric / v_checkout_started::numeric) * 100, 1)
    ELSE 0
  END;

  RETURN jsonb_build_object(
    'days', v_days,
    'checkout_started_count', v_checkout_started,
    'diagnosis_paid_count', v_diagnosis_paid,
    'diagnosis_revenue_cents', v_diagnosis_revenue,
    'management_paid_count', v_management_paid,
    'management_revenue_cents', v_management_revenue,
    'completed_count', v_completed,
    'conversion_checkout_to_paid_pct', v_conv,
    'conversion_paid_to_completed_pct', CASE
      WHEN v_diagnosis_paid > 0
      THEN round((v_completed::numeric / v_diagnosis_paid::numeric) * 100, 1)
      ELSE 0
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_diagnosis_failures_summary(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer;
  v_result jsonb;
BEGIN
  PERFORM public.require_platform_admin();
  v_days := GREATEST(1, LEAST(COALESCE(p_days, 7), 90));
  SELECT COALESCE(jsonb_agg(t.row ORDER BY (t.row->>'count')::bigint DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'category', x.cat, 'count', COUNT(*)::bigint,
      'sample', left(min(x.failed_reason), 100)
    ) AS row
    FROM (
      SELECT d.failed_reason,
        CASE
          WHEN d.failed_reason ~* 'token meta|reconect' THEN 'meta_token'
          WHEN d.failed_reason ~* 'noadaccounts|conta meta|ad account' THEN 'meta_no_accounts'
          WHEN d.failed_reason ~* 'providers ia falharam|orçamento diário de ia|configuração de ia' THEN 'ai_providers'
          WHEN d.failed_reason ~* 'processamento expirou|timeout operacional' THEN 'operational_timeout'
          WHEN d.failed_reason ~* 'pagamento|mercado pago|mp_' THEN 'payment'
          ELSE 'other'
        END AS cat
      FROM public.diagnoses d
      WHERE d.status = 'failed'
        AND d.updated_at > now() - (v_days || ' days')::interval
        AND d.failed_reason IS NOT NULL
    ) x
    GROUP BY x.cat
  ) t;
  RETURN jsonb_build_object(
    'days', v_days, 'categories', v_result,
    'total_failed', (
      SELECT COUNT(*)::bigint FROM public.diagnoses
      WHERE status = 'failed' AND updated_at > now() - (v_days || ' days')::interval
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_diagnosis_buyers_list(
  p_limit int DEFAULT 50, p_offset int DEFAULT 0,
  p_search text DEFAULT NULL, p_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid, created_at timestamptz, status text, secret_slug text,
  payer_name text, payer_email text, payer_phone text, payer_cpf text,
  payment_method text, amount_cents int,
  management_status text, management_paid_at timestamptz, completed_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_platform_admin();
  RETURN QUERY
  SELECT d.id, d.created_at, d.status, d.secret_slug,
         d.payer_name, d.payer_email, d.payer_phone, d.payer_cpf,
         d.payment_method, d.amount_cents,
         d.management_status, d.management_paid_at, d.completed_at
  FROM public.diagnoses d
  WHERE d.payer_email IS NOT NULL
    AND (p_since IS NULL OR d.created_at >= p_since)
    AND (
      p_search IS NULL OR p_search = '' OR
      d.payer_email ILIKE '%'||p_search||'%' OR
      d.payer_name ILIKE '%'||p_search||'%' OR
      d.payer_cpf ILIKE '%'||p_search||'%'
    )
  ORDER BY d.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200))
  OFFSET GREATEST(0, p_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_management_subscribers_list(
  p_limit int DEFAULT 50, p_offset int DEFAULT 0,
  p_search text DEFAULT NULL, p_status text DEFAULT NULL
)
RETURNS TABLE (
  diagnosis_id uuid, subscription_id uuid, management_paid_at timestamptz,
  payer_name text, payer_email text, payer_phone text, payer_cpf text,
  business_name text, website text, instagram text,
  amount_cents int, card_last4 text, sub_status text, next_payment_date timestamptz,
  last_charge_at timestamptz, last_charge_status text,
  cancelled_at timestamptz, mp_preapproval_id text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_platform_admin();
  RETURN QUERY
  SELECT d.id, s.id, d.management_paid_at,
         d.payer_name, d.payer_email, d.payer_phone, d.payer_cpf,
         d.management_business_name, d.management_website, d.management_instagram,
         s.amount_cents, s.card_last4, s.status, s.next_payment_date,
         s.last_charge_at, s.last_charge_status, s.cancelled_at, s.mp_preapproval_id
  FROM public.management_subscriptions s
  JOIN public.diagnoses d ON d.id = s.diagnosis_id
  WHERE (p_status IS NULL OR p_status = '' OR s.status = p_status)
    AND (
      p_search IS NULL OR p_search = '' OR
      d.payer_email ILIKE '%'||p_search||'%' OR
      d.payer_name ILIKE '%'||p_search||'%' OR
      d.payer_cpf ILIKE '%'||p_search||'%' OR
      d.management_business_name ILIKE '%'||p_search||'%'
    )
  ORDER BY d.management_paid_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 200))
  OFFSET GREATEST(0, p_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_management_subscribers_kpis()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.require_platform_admin();
  SELECT jsonb_build_object(
    'active_count', count(*) FILTER (WHERE status = 'authorized'),
    'mrr_cents', coalesce(sum(amount_cents) FILTER (WHERE status = 'authorized'), 0),
    'new_this_month', count(*) FILTER (WHERE created_at >= date_trunc('month', now())),
    'cancelled_this_month', count(*) FILTER (WHERE cancelled_at >= date_trunc('month', now()))
  ) INTO v FROM public.management_subscriptions;
  RETURN v;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas diagnosis_*: policies deny_all explícitas
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS diagnosis_followup_jobs_deny_all ON public.diagnosis_followup_jobs;
CREATE POLICY diagnosis_followup_jobs_deny_all ON public.diagnosis_followup_jobs
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS diagnosis_handoff_events_deny_all ON public.diagnosis_handoff_events;
CREATE POLICY diagnosis_handoff_events_deny_all ON public.diagnosis_handoff_events
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS diagnosis_metric_snapshots_deny_all ON public.diagnosis_metric_snapshots;
CREATE POLICY diagnosis_metric_snapshots_deny_all ON public.diagnosis_metric_snapshots
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- EXECUTE lockdown: service_role only (Edge / cron / triggers internos)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  service_only text[] := ARRAY[
    'get_retentio_cron_bearer',
    'bootstrap_retentio_cron_jobs',
    'setup_retentio_cron_jobs',
    'claim_ai_jobs',
    'check_api_rate_limit',
    'check_ai_budget',
    'check_diagnosis_ai_budget',
    'cleanup_stale_diagnosis_processing',
    'cleanup_stale_sync_runs',
    'get_agency_client_batch',
    'get_agency_cron_prefetch',
    'get_cron_dispatch_agency_batch',
    'delete_orphan_metrics_daily_for_sync',
    'upsert_metrics_daily_batch',
    'get_latest_campaign_audits_for_clients',
    'get_diagnosis_ops_snapshot',
    'refresh_campaign_audit_summary_mv',
    'refresh_client_metrics_28d',
    'retention_cleanup_ops',
    'enforce_max_open_alerts',
    'handle_new_user',
    'integrations_guard_secrets',
    'profiles_guard_platform_admin',
    'profiles_guard_platform_admin_insert',
    'prevent_profile_privilege_escalation',
    'tr_action_center_events_fn',
    'rls_auto_enable',
    'require_authenticated_agency_member',
    'require_platform_admin'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(service_only)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- EXECUTE lockdown: authenticated + service_role (helpers RLS + dashboard)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  auth_helpers text[] := ARRAY[
    'auth_is_platform_admin',
    'is_member_of',
    'has_role',
    'is_owner_or_admin',
    'user_can_access_client',
    'count_agency_clients',
    'count_open_alerts',
    'current_user_agency',
    'max_alerts_for_agency',
    'get_agency_dashboard_snapshot',
    'get_agency_dashboard_detail',
    'get_resilience_ops_snapshot',
    'platform_list_agencies_minimal',
    'platform_overview_counts',
    'platform_diagnosis_ops_snapshot',
    'platform_diagnosis_funnel_counts',
    'platform_diagnosis_list_recent',
    'platform_diagnosis_revenue_summary',
    'platform_diagnosis_failures_summary',
    'platform_diagnosis_buyers_list',
    'platform_management_subscribers_list',
    'platform_management_subscribers_kpis'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(auth_helpers)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Rotação do cron bearer (comprometido na auditoria)
-- ---------------------------------------------------------------------------
UPDATE public.retentio_ops_config
SET cron_bearer = encode(extensions.gen_random_bytes(24), 'hex'),
    updated_at = now()
WHERE id = 1;

DO $$
DECLARE
  v_bearer text;
BEGIN
  SELECT cron_bearer INTO v_bearer FROM public.retentio_ops_config WHERE id = 1;
  IF v_bearer IS NOT NULL AND length(trim(v_bearer)) >= 8 THEN
    PERFORM public.setup_retentio_cron_jobs(v_bearer);
  END IF;
END $$;

COMMENT ON FUNCTION public.require_platform_admin() IS
  'Guard fail-closed: exige JWT autenticado e is_platform_admin.';
COMMENT ON FUNCTION public.require_authenticated_agency_member(uuid) IS
  'Guard fail-closed: exige JWT autenticado e membership na agência.';
