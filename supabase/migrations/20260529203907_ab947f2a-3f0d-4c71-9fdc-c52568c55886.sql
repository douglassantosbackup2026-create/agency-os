
-- Fix 1: feature_flags UPDATE/INSERT/DELETE restricted to owner/admin
DROP POLICY IF EXISTS feature_flags_update ON public.feature_flags;
DROP POLICY IF EXISTS feature_flags_insert ON public.feature_flags;
CREATE POLICY feature_flags_update ON public.feature_flags
  FOR UPDATE TO authenticated
  USING (public.is_owner_or_admin(agency_id))
  WITH CHECK (public.is_owner_or_admin(agency_id));
CREATE POLICY feature_flags_insert ON public.feature_flags
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner_or_admin(agency_id));

-- Fix 2: clients SELECT restricted by client_member_scopes for non-owner/admin
DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    public.is_owner_or_admin(agency_id)
    OR (
      public.is_member_of(agency_id)
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.client_member_scopes s
          WHERE s.user_id = auth.uid()
            AND s.client_id IN (SELECT id FROM public.clients c2 WHERE c2.agency_id = clients.agency_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.client_member_scopes s
          WHERE s.user_id = auth.uid() AND s.client_id = clients.id
        )
      )
    )
  );

-- Also tighten UPDATE/DELETE to respect scopes for members
DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients
  FOR UPDATE TO authenticated
  USING (
    public.is_owner_or_admin(agency_id)
    OR (
      public.is_member_of(agency_id)
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.client_member_scopes s
          WHERE s.user_id = auth.uid()
            AND s.client_id IN (SELECT id FROM public.clients c2 WHERE c2.agency_id = clients.agency_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.client_member_scopes s
          WHERE s.user_id = auth.uid() AND s.client_id = clients.id
        )
      )
    )
  );

-- Fix 3: Remove broad listing on public branding bucket (direct URLs still work)
DROP POLICY IF EXISTS branding_public_read ON storage.objects;
