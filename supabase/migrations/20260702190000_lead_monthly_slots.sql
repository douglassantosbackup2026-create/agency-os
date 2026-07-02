-- Vagas mensais do funil /gestao-trafego (contagem por pagamentos confirmados).

CREATE OR REPLACE FUNCTION public.lead_month_start_sao_paulo()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (
    date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::timestamp
    AT TIME ZONE 'America/Sao_Paulo'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_ecommerce_lead_slot_snapshot(p_cap integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH m AS (
    SELECT public.lead_month_start_sao_paulo() AS month_start
  ),
  used AS (
    SELECT count(*)::integer AS n
    FROM public.ecommerce_leads e
    CROSS JOIN m
    WHERE e.status = 'paid'
      AND e.paid_at >= m.month_start
  )
  SELECT jsonb_build_object(
    'cap', p_cap,
    'used', (SELECT n FROM used),
    'available', GREATEST(0, p_cap - (SELECT n FROM used))
  );
$$;

CREATE OR REPLACE FUNCTION public.try_mark_ecommerce_lead_paid(
  p_lead_id uuid,
  p_cap integer,
  p_paid_at timestamptz DEFAULT now(),
  p_extra jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_key text;
  v_month_start timestamptz;
  v_used integer;
  v_status text;
BEGIN
  v_month_key := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  PERFORM pg_advisory_xact_lock(hashtext('ecommerce_lead_slots:' || v_month_key));

  SELECT status INTO v_status
  FROM public.ecommerce_leads
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_paid');
  END IF;

  IF v_status <> 'awaiting_payment' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  v_month_start := public.lead_month_start_sao_paulo();

  SELECT count(*)::integer INTO v_used
  FROM public.ecommerce_leads
  WHERE status = 'paid'
    AND paid_at >= v_month_start;

  IF v_used >= p_cap THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'slots_full',
      'used', v_used,
      'cap', p_cap
    );
  END IF;

  UPDATE public.ecommerce_leads
  SET
    status = 'paid',
    paid_at = p_paid_at,
    mp_payment_id = COALESCE(p_extra->>'mp_payment_id', mp_payment_id),
    payment_method = COALESCE(p_extra->>'payment_method', payment_method),
    mp_preapproval_id = COALESCE(p_extra->>'mp_preapproval_id', mp_preapproval_id)
  WHERE id = p_lead_id
    AND status = 'awaiting_payment';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'update_failed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'reason', 'claimed');
END;
$$;

REVOKE ALL ON FUNCTION public.lead_month_start_sao_paulo() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ecommerce_lead_slot_snapshot(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_mark_ecommerce_lead_paid(uuid, integer, timestamptz, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.lead_month_start_sao_paulo() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ecommerce_lead_slot_snapshot(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_mark_ecommerce_lead_paid(uuid, integer, timestamptz, jsonb) TO service_role;

COMMENT ON FUNCTION public.get_ecommerce_lead_slot_snapshot IS
  'Snapshot de vagas do funil gestao-trafego no mês corrente (America/Sao_Paulo).';
COMMENT ON FUNCTION public.try_mark_ecommerce_lead_paid IS
  'Marca lead como paid com lock mensal; falha com slots_full quando cap atingido.';
