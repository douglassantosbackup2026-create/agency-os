-- Security P1: cryptographically strong portal slugs + auto-assign on insert.

CREATE OR REPLACE FUNCTION public.generate_portal_slug()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public, extensions
AS $$
DECLARE
  v_slug text;
  v_attempts integer := 0;
BEGIN
  LOOP
    v_slug := encode(extensions.gen_random_bytes(12), 'hex');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.portal_slug = v_slug
    );
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'could not generate unique portal_slug';
    END IF;
  END LOOP;
  RETURN v_slug;
END;
$$;

-- Regenerate all existing slugs (invalidates old /p/ links).
UPDATE public.clients
SET portal_slug = public.generate_portal_slug()
WHERE portal_slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.clients_assign_portal_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.portal_slug IS NULL OR btrim(NEW.portal_slug) = '' THEN
    NEW.portal_slug := public.generate_portal_slug();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_clients_assign_portal_slug ON public.clients;
CREATE TRIGGER tr_clients_assign_portal_slug
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.clients_assign_portal_slug();
