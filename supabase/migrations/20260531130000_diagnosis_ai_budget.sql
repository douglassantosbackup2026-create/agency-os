-- Orçamento diário global do produto Diagnóstico (sem agency_id).

CREATE OR REPLACE FUNCTION public.check_diagnosis_ai_budget(
  p_estimated_tokens integer DEFAULT 15000
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT SUM(e.prompt_tokens + e.completion_tokens)
      FROM public.ai_usage_events e
      WHERE e.function_name = 'process-diagnosis'
        AND e.day = (now() AT TIME ZONE 'utc')::date
    ),
    0
  ) + GREATEST(COALESCE(p_estimated_tokens, 0), 0) > 100000;
$$;

REVOKE ALL ON FUNCTION public.check_diagnosis_ai_budget(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_diagnosis_ai_budget(integer) TO service_role;

COMMENT ON FUNCTION public.check_diagnosis_ai_budget(integer) IS
  'true = orçamento diário de tokens do funil diagnóstico excedido (function_name process-diagnosis).';
