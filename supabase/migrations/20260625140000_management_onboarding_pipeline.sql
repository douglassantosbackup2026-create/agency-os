-- Pipeline pós-gestão R$ 1.997: vínculo diagnosis→client, onboarding, fila operacional.

-- ---------------------------------------------------------------------------
-- Schema: clients + diagnoses
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS diagnosis_id uuid REFERENCES public.diagnoses(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_diagnosis_id_unique_idx
  ON public.clients (diagnosis_id)
  WHERE diagnosis_id IS NOT NULL;

ALTER TABLE public.diagnoses
  ADD COLUMN IF NOT EXISTS management_onboarding_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS management_ops_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS management_provisioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS management_provisioned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.diagnoses
  DROP CONSTRAINT IF EXISTS diagnoses_management_status_check;

ALTER TABLE public.diagnoses
  ADD CONSTRAINT diagnoses_management_status_check
  CHECK (management_status IN ('none', 'awaiting_payment', 'paid', 'cancelled'));

ALTER TABLE public.diagnoses
  DROP CONSTRAINT IF EXISTS diagnoses_management_onboarding_status_check;

ALTER TABLE public.diagnoses
  ADD CONSTRAINT diagnoses_management_onboarding_status_check
  CHECK (management_onboarding_status IN ('none', 'awaiting_client', 'client_submitted', 'provisioned'));

COMMENT ON COLUMN public.clients.diagnosis_id IS 'Origem funil Diagnóstico Meta (gestão paga).';
COMMENT ON COLUMN public.diagnoses.management_onboarding_status IS 'none | awaiting_client | client_submitted | provisioned';

-- ---------------------------------------------------------------------------
-- Formulário pós-pagamento (service_role only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.management_onboarding_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id uuid NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  monthly_ad_budget numeric,
  roas_goal text,
  access_notes text,
  preferred_contact_time text,
  access_checklist text[] NOT NULL DEFAULT '{}',
  extra_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diagnosis_id)
);

CREATE INDEX IF NOT EXISTS management_onboarding_submissions_diagnosis_idx
  ON public.management_onboarding_submissions (diagnosis_id, submitted_at DESC);

DROP TRIGGER IF EXISTS tr_management_onboarding_submissions_updated
  ON public.management_onboarding_submissions;
CREATE TRIGGER tr_management_onboarding_submissions_updated
  BEFORE UPDATE ON public.management_onboarding_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.management_onboarding_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS management_onboarding_submissions_deny_all
  ON public.management_onboarding_submissions;
CREATE POLICY management_onboarding_submissions_deny_all
  ON public.management_onboarding_submissions
  FOR ALL
  USING (false)
  WITH CHECK (false);

GRANT ALL ON public.management_onboarding_submissions TO service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_diagnosis_funnel_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT diagnosis_funnel_agency_id FROM public.retentio_ops_config WHERE id = 1 LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.assert_funnel_agency_operator()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  v_agency := public.get_diagnosis_funnel_agency_id();
  IF v_agency IS NULL THEN
    RAISE EXCEPTION 'diagnosis_funnel_agency_id not configured' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_member_of(v_agency) AND NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN v_agency;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ops config (platform admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_retentio_ops_config()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.retentio_ops_config%ROWTYPE;
BEGIN
  IF NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.retentio_ops_config WHERE id = 1;
  RETURN jsonb_build_object(
    'diagnosis_funnel_agency_id', v_row.diagnosis_funnel_agency_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_retentio_ops_config(
  p_diagnosis_funnel_agency_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.retentio_ops_config
  SET diagnosis_funnel_agency_id = p_diagnosis_funnel_agency_id
  WHERE id = 1;
  IF NOT FOUND THEN
    INSERT INTO public.retentio_ops_config (id, diagnosis_funnel_agency_id)
    VALUES (1, p_diagnosis_funnel_agency_id);
  END IF;
  RETURN public.get_retentio_ops_config();
END;
$$;

-- ---------------------------------------------------------------------------
-- Fila de onboarding gestão
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.management_onboarding_queue(
  p_include_provisioned boolean DEFAULT false,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  diagnosis_id uuid,
  secret_slug text,
  business_name text,
  payer_name text,
  payer_email text,
  payer_phone text,
  management_paid_at timestamptz,
  management_payment_method text,
  onboarding_status text,
  whatsapp_clicked_at timestamptz,
  form_submitted_at timestamptz,
  monthly_ad_budget numeric,
  roas_goal text,
  client_id uuid,
  client_portal_slug text,
  checklist_done int,
  checklist_total int,
  meta_ad_account_id text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency uuid;
BEGIN
  v_agency := public.assert_funnel_agency_operator();

  RETURN QUERY
  SELECT
    d.id,
    d.secret_slug,
    d.management_business_name,
    d.payer_name,
    d.payer_email,
    d.payer_phone,
    d.management_paid_at,
    d.management_payment_method,
    d.management_onboarding_status,
    d.management_whatsapp_clicked_at,
    mos.submitted_at,
    mos.monthly_ad_budget,
    mos.roas_goal,
    c.id,
    c.portal_slug,
    COALESCE((
      SELECT COUNT(*)::int FROM public.onboarding_checklist_items oci
      WHERE oci.client_id = c.id AND oci.status = 'done'
    ), 0),
    COALESCE((
      SELECT COUNT(*)::int FROM public.onboarding_checklist_items oci
      WHERE oci.client_id = c.id
    ), 0),
    d.meta_ad_account_id
  FROM public.diagnoses d
  LEFT JOIN public.management_onboarding_submissions mos ON mos.diagnosis_id = d.id
  LEFT JOIN public.clients c ON c.diagnosis_id = d.id AND c.agency_id = v_agency
  WHERE d.management_status = 'paid'
    AND (
      p_include_provisioned
      OR d.management_onboarding_status <> 'provisioned'
      OR c.id IS NULL
    )
  ORDER BY d.management_paid_at ASC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 200));
END;
$$;

-- ---------------------------------------------------------------------------
-- Assinantes gestão: inclui PIX (sem management_subscriptions)
-- ---------------------------------------------------------------------------
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
  LEFT JOIN public.management_subscriptions s ON s.diagnosis_id = d.id
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

REVOKE ALL ON FUNCTION public.get_diagnosis_funnel_agency_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_funnel_agency_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_retentio_ops_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_retentio_ops_config(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.management_onboarding_queue(boolean, int) TO authenticated;

-- Link diagnóstico para banner no cliente (membros da agência do funil)
CREATE OR REPLACE FUNCTION public.get_client_diagnosis_handoff(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency uuid;
  v_client public.clients%ROWTYPE;
  v_diag public.diagnoses%ROWTYPE;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
  IF NOT FOUND OR v_client.diagnosis_id IS NULL THEN
    RETURN NULL;
  END IF;
  v_agency := public.get_diagnosis_funnel_agency_id();
  IF v_agency IS NULL OR v_client.agency_id <> v_agency THEN
    IF NOT public.is_member_of(v_client.agency_id) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.is_member_of(v_agency) AND NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_diag FROM public.diagnoses WHERE id = v_client.diagnosis_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('diagnosis_id', v_client.diagnosis_id);
  END IF;
  RETURN jsonb_build_object(
    'diagnosis_id', v_diag.id,
    'secret_slug', v_diag.secret_slug,
    'management_paid_at', v_diag.management_paid_at,
    'management_onboarding_status', v_diag.management_onboarding_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_diagnosis_handoff(uuid) TO authenticated;
