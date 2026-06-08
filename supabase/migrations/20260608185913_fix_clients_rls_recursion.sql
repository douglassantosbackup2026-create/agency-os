-- Fix infinite recursion in clients RLS: policies must not subquery public.clients.
-- Use client_member_scopes.agency_id instead of resolving client ids via clients.

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
            AND s.agency_id = clients.agency_id
        )
        OR EXISTS (
          SELECT 1 FROM public.client_member_scopes s
          WHERE s.user_id = auth.uid() AND s.client_id = clients.id
        )
      )
    )
  );

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
            AND s.agency_id = clients.agency_id
        )
        OR EXISTS (
          SELECT 1 FROM public.client_member_scopes s
          WHERE s.user_id = auth.uid() AND s.client_id = clients.id
        )
      )
    )
  )
  WITH CHECK (
    public.is_owner_or_admin(agency_id)
    OR (
      public.is_member_of(agency_id)
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.client_member_scopes s
          WHERE s.user_id = auth.uid()
            AND s.agency_id = clients.agency_id
        )
        OR EXISTS (
          SELECT 1 FROM public.client_member_scopes s
          WHERE s.user_id = auth.uid() AND s.client_id = clients.id
        )
      )
    )
  );
