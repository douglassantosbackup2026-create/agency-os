-- Critical RLS fixes (post-audit):
-- 1) Drop permissive portal SELECT on clients (cross-tenant leak). Portal público usa apenas Edge Function portal-data (service role).
-- 2) Block authenticated INSERT into user_roles except via SECURITY DEFINER triggers / service role (invite-member).
-- 3) Block authenticated INSERT into agencies except via handle_new_user trigger (SECURITY DEFINER).

DROP POLICY IF EXISTS clients_public_portal ON public.clients;

DROP POLICY IF EXISTS roles_insert ON public.user_roles;
CREATE POLICY roles_insert ON public.user_roles
  FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS agencies_insert ON public.agencies;
CREATE POLICY agencies_insert ON public.agencies
  FOR INSERT
  WITH CHECK (false);
