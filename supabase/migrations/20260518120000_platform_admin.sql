-- Operador global da instância (separado de owner/admin da agência).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_platform_admin IS
  'Quando true, permite usar RPCs platform_* e área /platform-admin (operador da instância).';

CREATE OR REPLACE FUNCTION public.auth_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_platform_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_list_agencies_minimal()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT a.id, a.name, a.slug, a.created_at
  FROM public.agencies a
  ORDER BY a.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_overview_counts()
RETURNS TABLE (
  agencies_count bigint,
  profiles_with_agency_count bigint,
  clients_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::bigint FROM public.agencies),
    (SELECT COUNT(*)::bigint FROM public.profiles WHERE agency_id IS NOT NULL),
    (SELECT COUNT(*)::bigint FROM public.clients);
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_list_agencies_minimal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_overview_counts() TO authenticated;

-- Apenas service_role pode alterar is_platform_admin (evitar auto-escalamento via UPDATE pelo cliente).
CREATE OR REPLACE FUNCTION public.profiles_guard_platform_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
    -- Pedidos PostgREST com utilizador: só service_role altera o flag (Edge Functions / secrets).
    IF auth.uid() IS NOT NULL THEN
      IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
        NEW.is_platform_admin := OLD.is_platform_admin;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_guard_platform_admin ON public.profiles;
CREATE TRIGGER tr_profiles_guard_platform_admin
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_platform_admin();

CREATE OR REPLACE FUNCTION public.profiles_guard_platform_admin_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_platform_admin IS TRUE THEN
    IF auth.uid() IS NOT NULL THEN
      IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
        NEW.is_platform_admin := false;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_guard_platform_admin_ins ON public.profiles;
CREATE TRIGGER tr_profiles_guard_platform_admin_ins
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_platform_admin_insert();
