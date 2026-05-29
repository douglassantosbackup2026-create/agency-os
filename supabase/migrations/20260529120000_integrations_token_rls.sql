-- Hardening: tokens OAuth/API não legíveis por members via PostgREST.
-- Leitura para membros: view integrations_public (sem colunas de segredo).

CREATE OR REPLACE VIEW public.integrations_public AS
SELECT
  id,
  agency_id,
  provider,
  status,
  config,
  account_id,
  token_expires_at,
  last_sync_at,
  created_at,
  updated_at
FROM public.integrations;

ALTER VIEW public.integrations_public SET (security_invoker = true);

GRANT SELECT ON public.integrations_public TO authenticated;

DROP POLICY IF EXISTS integrations_select ON public.integrations;

CREATE POLICY integrations_select ON public.integrations
  FOR SELECT
  USING (public.is_owner_or_admin(agency_id));

CREATE OR REPLACE FUNCTION public.integrations_guard_secrets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_owner_or_admin(NEW.agency_id) THEN
      NEW.api_key_encrypted := NULL;
      NEW.refresh_token_encrypted := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT public.is_owner_or_admin(COALESCE(NEW.agency_id, OLD.agency_id)) THEN
      NEW.api_key_encrypted := OLD.api_key_encrypted;
      NEW.refresh_token_encrypted := OLD.refresh_token_encrypted;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_integrations_guard_secrets ON public.integrations;
CREATE TRIGGER tr_integrations_guard_secrets
  BEFORE INSERT OR UPDATE ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.integrations_guard_secrets();

COMMENT ON VIEW public.integrations_public IS
  'Integrações sem tokens; use para SELECT no cliente autenticado (members).';
