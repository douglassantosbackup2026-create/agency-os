-- Bearer de cron partilhado entre pg_cron e Edge Functions (fallback quando CRON_SECRET env difere).
CREATE TABLE IF NOT EXISTS public.retentio_ops_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cron_bearer text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.retentio_ops_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.retentio_ops_config FROM PUBLIC;
GRANT SELECT ON TABLE public.retentio_ops_config TO service_role;

CREATE OR REPLACE FUNCTION public.get_retentio_cron_bearer()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cron_bearer FROM public.retentio_ops_config WHERE id = 1 LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_retentio_cron_bearer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_retentio_cron_bearer() TO service_role;

CREATE OR REPLACE FUNCTION public.bootstrap_retentio_cron_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_bearer text;
  v_result jsonb;
BEGIN
  SELECT cron_bearer INTO v_bearer FROM public.retentio_ops_config WHERE id = 1;

  IF v_bearer IS NULL OR length(trim(v_bearer)) < 8 THEN
    v_bearer := encode(gen_random_bytes(24), 'hex');
    INSERT INTO public.retentio_ops_config (id, cron_bearer, updated_at)
    VALUES (1, v_bearer, now())
    ON CONFLICT (id) DO UPDATE
      SET cron_bearer = EXCLUDED.cron_bearer,
          updated_at = now();
  END IF;

  v_result := public.setup_retentio_cron_jobs(v_bearer);

  RETURN v_result || jsonb_build_object(
    'bootstrap', true,
    'hint', 'Bearer gravado em retentio_ops_config; Edge Functions aceitam env CRON_SECRET ou este valor via RPC.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_retentio_cron_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_retentio_cron_jobs() TO service_role;

COMMENT ON FUNCTION public.bootstrap_retentio_cron_jobs() IS
  'Gera (se necessário) cron bearer, agenda pg_cron Retentio. Idempotente.';
