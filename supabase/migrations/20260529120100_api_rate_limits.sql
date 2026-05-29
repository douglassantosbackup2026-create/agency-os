-- P2 foundation: rate limits distribuídos (substitui Map in-memory entre réplicas).

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_rate_limits_deny_all ON public.api_rate_limits
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.api_rate_limits IS
  'Contadores de rate limit; apenas service_role / Edge Functions.';

CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_row public.api_rate_limits%ROWTYPE;
  v_window interval := make_interval(secs => greatest(p_window_seconds, 1));
BEGIN
  IF p_max IS NULL OR p_max <= 0 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row FROM public.api_rate_limits WHERE bucket_key = p_bucket FOR UPDATE;

  IF NOT FOUND OR v_row.window_start + v_window <= v_now THEN
    INSERT INTO public.api_rate_limits (bucket_key, window_start, request_count, updated_at)
    VALUES (p_bucket, v_now, 1, v_now)
    ON CONFLICT (bucket_key) DO UPDATE
      SET window_start = EXCLUDED.window_start,
          request_count = 1,
          updated_at = EXCLUDED.updated_at;
    RETURN false;
  END IF;

  IF v_row.request_count >= p_max THEN
    RETURN true;
  END IF;

  UPDATE public.api_rate_limits
    SET request_count = request_count + 1, updated_at = v_now
    WHERE bucket_key = p_bucket;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.check_api_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_api_rate_limit(text, integer, integer) TO service_role;

-- Códigos OAuth de uso único (harness Meta; evita token na URL).
CREATE TABLE IF NOT EXISTS public.oauth_exchange_codes (
  code text PRIMARY KEY,
  purpose text NOT NULL DEFAULT 'meta_test',
  access_token text NOT NULL,
  expires_in integer,
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.oauth_exchange_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY oauth_exchange_codes_deny ON public.oauth_exchange_codes
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.oauth_exchange_codes IS
  'Troca única de tokens OAuth; apenas service_role via Edge Functions.';
