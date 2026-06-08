-- Console platform-admin: funil Diagnóstico Meta (leitura agregada; guard is_platform_admin).

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
  IF NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.diagnoses;

  SELECT COUNT(*) INTO v_processing
  FROM public.diagnoses WHERE status = 'processing';

  SELECT COUNT(*) INTO v_stale_processing
  FROM public.diagnoses
  WHERE status = 'processing'
    AND updated_at < now() - interval '30 minutes';

  SELECT COUNT(*) INTO v_awaiting_payment
  FROM public.diagnoses WHERE status = 'awaiting_payment';

  SELECT COUNT(*) INTO v_awaiting_connection
  FROM public.diagnoses WHERE status = 'awaiting_connection';

  SELECT COUNT(*) INTO v_awaiting_account
  FROM public.diagnoses WHERE status = 'awaiting_account_selection';

  SELECT COUNT(*) INTO v_completed_24h
  FROM public.diagnoses
  WHERE status = 'completed' AND completed_at > now() - interval '24 hours';

  SELECT COUNT(*) INTO v_failed_24h
  FROM public.diagnoses
  WHERE status = 'failed' AND updated_at > now() - interval '24 hours';

  SELECT COUNT(*) INTO v_management_paid_24h
  FROM public.diagnoses
  WHERE management_status = 'paid'
    AND management_paid_at > now() - interval '24 hours';

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
  IF NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

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
  IF NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

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
  IF NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

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
  IF NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_days := GREATEST(1, LEAST(COALESCE(p_days, 7), 90));

  SELECT COALESCE(jsonb_agg(t.row ORDER BY (t.row->>'count')::bigint DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'category', x.cat,
      'count', COUNT(*)::bigint,
      'sample', left(min(x.failed_reason), 100)
    ) AS row
    FROM (
      SELECT
        d.failed_reason,
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
    'days', v_days,
    'categories', v_result,
    'total_failed', (
      SELECT COUNT(*)::bigint FROM public.diagnoses
      WHERE status = 'failed'
        AND updated_at > now() - (v_days || ' days')::interval
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_diagnosis_ops_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_diagnosis_funnel_counts(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_diagnosis_list_recent(integer, integer, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_diagnosis_revenue_summary(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_diagnosis_failures_summary(integer) TO authenticated;
