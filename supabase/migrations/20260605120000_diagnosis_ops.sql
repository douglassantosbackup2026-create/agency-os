-- Ops do funil Diagnóstico Meta: updated_at, limpeza de processing presos, snapshot.

ALTER TABLE public.diagnoses
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.diagnoses SET updated_at = created_at WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.diagnoses_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS diagnoses_updated_at ON public.diagnoses;
CREATE TRIGGER diagnoses_updated_at
  BEFORE UPDATE ON public.diagnoses
  FOR EACH ROW
  EXECUTE FUNCTION public.diagnoses_touch_updated_at();

CREATE OR REPLACE FUNCTION public.cleanup_stale_diagnosis_processing(
  p_stale_minutes integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  p_stale_minutes := GREATEST(5, LEAST(COALESCE(p_stale_minutes, 30), 1440));
  UPDATE public.diagnoses
  SET
    status = 'failed',
    failed_reason = 'Processamento expirou (timeout operacional). Tenta reconectar a Meta ou contacta suporte.',
    updated_at = now()
  WHERE status = 'processing'
    AND updated_at < now() - (p_stale_minutes || ' minutes')::interval;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_diagnosis_ops_snapshot()
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
  v_completed_24h bigint;
  v_failed_24h bigint;
BEGIN
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

  SELECT COUNT(*) INTO v_completed_24h
  FROM public.diagnoses
  WHERE status = 'completed' AND completed_at > now() - interval '24 hours';

  SELECT COUNT(*) INTO v_failed_24h
  FROM public.diagnoses
  WHERE status = 'failed' AND updated_at > now() - interval '24 hours';

  RETURN jsonb_build_object(
    'processing', v_processing,
    'stale_processing', v_stale_processing,
    'awaiting_payment', v_awaiting_payment,
    'awaiting_connection', v_awaiting_connection,
    'completed_24h', v_completed_24h,
    'failed_24h', v_failed_24h,
    'captured_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_diagnosis_processing(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_diagnosis_processing(integer) TO service_role;

REVOKE ALL ON FUNCTION public.get_diagnosis_ops_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_diagnosis_ops_snapshot() TO service_role;
