
-- 1. client_member_scopes: restrict INSERT/UPDATE to owners/admins
DROP POLICY IF EXISTS client_member_scopes_insert ON public.client_member_scopes;
DROP POLICY IF EXISTS client_member_scopes_update ON public.client_member_scopes;

CREATE POLICY client_member_scopes_insert
  ON public.client_member_scopes
  FOR INSERT
  TO authenticated
  WITH CHECK (is_owner_or_admin(agency_id));

CREATE POLICY client_member_scopes_update
  ON public.client_member_scopes
  FOR UPDATE
  TO authenticated
  USING (is_owner_or_admin(agency_id))
  WITH CHECK (is_owner_or_admin(agency_id));

-- 2. integrations: restrict UPDATE to owners/admins (protects encrypted token columns)
DROP POLICY IF EXISTS integrations_update ON public.integrations;

CREATE POLICY integrations_update
  ON public.integrations
  FOR UPDATE
  TO authenticated
  USING (is_owner_or_admin(agency_id))
  WITH CHECK (is_owner_or_admin(agency_id));

-- 3. profiles: prevent users from self-escalating is_platform_admin via trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role / postgres to bypass (e.g., admin tooling)
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
    RAISE EXCEPTION 'is_platform_admin cannot be modified by end users';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 4. retentio_ops_config: add explicit deny-all policies for non-service-role
DROP POLICY IF EXISTS retentio_ops_config_deny_all_select ON public.retentio_ops_config;
DROP POLICY IF EXISTS retentio_ops_config_deny_all_modify ON public.retentio_ops_config;

CREATE POLICY retentio_ops_config_deny_all_select
  ON public.retentio_ops_config
  FOR SELECT
  TO authenticated, anon
  USING (false);

CREATE POLICY retentio_ops_config_deny_all_modify
  ON public.retentio_ops_config
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
