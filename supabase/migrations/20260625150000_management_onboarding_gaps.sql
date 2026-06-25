-- Gaps pipeline gestão: KPIs PIX, RPC formulário, dedupe assinantes.

-- KPIs incluem receita PIX (diagnoses pagas sem assinatura MP)
CREATE OR REPLACE FUNCTION public.platform_management_subscribers_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_active bigint;
  v_card_mrr bigint;
  v_pix_active bigint;
  v_pix_mrr bigint;
  v_new_card bigint;
  v_new_pix bigint;
  v_cancelled bigint;
BEGIN
  PERFORM public.require_platform_admin();

  SELECT
    count(*) FILTER (WHERE status = 'authorized'),
    coalesce(sum(amount_cents) FILTER (WHERE status = 'authorized'), 0),
    count(*) FILTER (WHERE created_at >= date_trunc('month', now())),
    count(*) FILTER (WHERE cancelled_at >= date_trunc('month', now()))
  INTO v_card_active, v_card_mrr, v_new_card, v_cancelled
  FROM public.management_subscriptions;

  SELECT
    count(*),
    coalesce(sum(management_amount_cents), 0)
  INTO v_pix_active, v_pix_mrr
  FROM public.diagnoses d
  WHERE d.management_status = 'paid'
    AND d.management_payment_method = 'pix'
    AND NOT EXISTS (
      SELECT 1 FROM public.management_subscriptions s
      WHERE s.diagnosis_id = d.id AND s.status = 'authorized'
    );

  SELECT count(*) INTO v_new_pix
  FROM public.diagnoses d
  WHERE d.management_status = 'paid'
    AND d.management_payment_method = 'pix'
    AND d.management_paid_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'active_count', v_card_active + v_pix_active,
    'mrr_cents', v_card_mrr + v_pix_mrr,
    'mrr_card_cents', v_card_mrr,
    'mrr_pix_cents', v_pix_mrr,
    'new_this_month', v_new_card + v_new_pix,
    'cancelled_this_month', v_cancelled
  );
END;
$$;

-- Detalhe do formulário pós-pagamento (fila de onboarding)
CREATE OR REPLACE FUNCTION public.get_management_onboarding_submission(
  p_diagnosis_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency uuid;
  v_row public.management_onboarding_submissions%ROWTYPE;
BEGIN
  v_agency := public.assert_funnel_agency_operator();

  SELECT * INTO v_row
  FROM public.management_onboarding_submissions
  WHERE diagnosis_id = p_diagnosis_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'diagnosis_id', v_row.diagnosis_id,
    'submitted_at', v_row.submitted_at,
    'monthly_ad_budget', v_row.monthly_ad_budget,
    'roas_goal', v_row.roas_goal,
    'access_notes', v_row.access_notes,
    'preferred_contact_time', v_row.preferred_contact_time,
    'access_checklist', v_row.access_checklist
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_management_onboarding_submission(uuid) TO authenticated;

-- Evita linhas duplicadas quando há múltiplas subscriptions por diagnóstico
DROP FUNCTION IF EXISTS public.platform_management_subscribers_list(int, int, text, text);

CREATE OR REPLACE FUNCTION public.platform_management_subscribers_list(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  diagnosis_id uuid,
  subscription_id uuid,
  management_paid_at timestamptz,
  payer_name text,
  payer_email text,
  payer_phone text,
  payer_cpf text,
  business_name text,
  website text,
  instagram text,
  amount_cents int,
  card_last4 text,
  sub_status text,
  next_payment_date timestamptz,
  last_charge_at timestamptz,
  last_charge_status text,
  cancelled_at timestamptz,
  mp_preapproval_id text,
  payment_method text,
  onboarding_status text,
  whatsapp_clicked_at timestamptz,
  client_id uuid
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
  RETURN QUERY
  SELECT
    d.id,
    s.id,
    d.management_paid_at,
    d.payer_name,
    d.payer_email,
    d.payer_phone,
    d.payer_cpf,
    d.management_business_name,
    d.management_website,
    d.management_instagram,
    COALESCE(s.amount_cents, d.management_amount_cents),
    s.card_last4,
    COALESCE(s.status, CASE WHEN d.management_payment_method = 'pix' THEN 'pix_paid' ELSE 'unknown' END),
    s.next_payment_date,
    s.last_charge_at,
    s.last_charge_status,
    s.cancelled_at,
    s.mp_preapproval_id,
    d.management_payment_method,
    d.management_onboarding_status,
    d.management_whatsapp_clicked_at,
    c.id
  FROM public.diagnoses d
  LEFT JOIN LATERAL (
    SELECT ms.*
    FROM public.management_subscriptions ms
    WHERE ms.diagnosis_id = d.id
    ORDER BY ms.created_at DESC
    LIMIT 1
  ) s ON true
  LEFT JOIN public.clients c ON c.diagnosis_id = d.id
  WHERE d.management_status = 'paid'
    AND (
      p_status IS NULL OR p_status = '' OR
      COALESCE(s.status, CASE WHEN d.management_payment_method = 'pix' THEN 'pix_paid' ELSE 'unknown' END) = p_status
    )
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

GRANT EXECUTE ON FUNCTION public.platform_management_subscribers_list(int, int, text, text) TO authenticated;
