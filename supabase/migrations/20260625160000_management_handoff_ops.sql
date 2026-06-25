-- Operadores do funil, handoff observability, filtro WhatsApp em assinantes.

CREATE OR REPLACE FUNCTION public.auth_is_funnel_agency_operator()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF public.auth_is_platform_admin() THEN
    RETURN true;
  END IF;
  v_agency := public.get_diagnosis_funnel_agency_id();
  IF v_agency IS NULL THEN
    RETURN false;
  END IF;
  RETURN public.is_member_of(v_agency);
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_can_provision_management()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF public.auth_is_platform_admin() THEN
    RETURN true;
  END IF;
  v_agency := public.get_diagnosis_funnel_agency_id();
  IF v_agency IS NULL OR NOT public.is_member_of(v_agency) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.agency_id = v_agency
      AND ur.role IN ('owner', 'admin')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_is_funnel_agency_operator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_can_provision_management() TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_management_handoff_list(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_kind text DEFAULT NULL,
  p_paid_without_whatsapp boolean DEFAULT false
)
RETURNS TABLE (
  event_id uuid,
  diagnosis_id uuid,
  secret_slug text,
  kind text,
  event_at timestamptz,
  payer_name text,
  payer_email text,
  payer_phone text,
  business_name text,
  management_paid_at timestamptz,
  onboarding_status text,
  whatsapp_clicked_at timestamptz,
  client_id uuid,
  payload jsonb
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
    e.id,
    d.id,
    d.secret_slug,
    e.kind,
    e.created_at,
    d.payer_name,
    d.payer_email,
    d.payer_phone,
    d.management_business_name,
    d.management_paid_at,
    d.management_onboarding_status,
    d.management_whatsapp_clicked_at,
    c.id,
    e.payload
  FROM public.diagnosis_handoff_events e
  INNER JOIN public.diagnoses d ON d.id = e.diagnosis_id
  LEFT JOIN public.clients c ON c.diagnosis_id = d.id
  WHERE d.management_status = 'paid'
    AND (
      NOT COALESCE(p_paid_without_whatsapp, false)
      OR d.management_whatsapp_clicked_at IS NULL
    )
    AND (
      p_kind IS NULL OR p_kind = '' OR e.kind = p_kind
    )
  ORDER BY e.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200))
  OFFSET GREATEST(0, p_offset);
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_management_handoff_list(int, int, text, boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.platform_management_subscribers_list(int, int, text, text);

CREATE OR REPLACE FUNCTION public.platform_management_subscribers_list(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_whatsapp_filter text DEFAULT NULL
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
    AND (
      p_whatsapp_filter IS NULL OR p_whatsapp_filter = '' OR
      (p_whatsapp_filter = 'clicked' AND d.management_whatsapp_clicked_at IS NOT NULL) OR
      (p_whatsapp_filter = 'not_clicked' AND d.management_whatsapp_clicked_at IS NULL)
    )
  ORDER BY d.management_paid_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 200))
  OFFSET GREATEST(0, p_offset);
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_management_subscribers_list(int, int, text, text, text) TO authenticated;
