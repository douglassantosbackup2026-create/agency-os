-- Scope activities by client_member_scopes (missed in 20260609140000).

DROP POLICY IF EXISTS activities_select ON public.activities;
DROP POLICY IF EXISTS activities_insert ON public.activities;
DROP POLICY IF EXISTS activities_update ON public.activities;

CREATE POLICY activities_select ON public.activities
  FOR SELECT TO authenticated
  USING (
    public.is_member_of(agency_id)
    AND public.user_can_access_client(client_id)
  );

CREATE POLICY activities_insert ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of(agency_id)
    AND public.user_can_access_client(client_id)
  );

CREATE POLICY activities_update ON public.activities
  FOR UPDATE TO authenticated
  USING (
    public.is_member_of(agency_id)
    AND public.user_can_access_client(client_id)
  )
  WITH CHECK (
    public.is_member_of(agency_id)
    AND public.user_can_access_client(client_id)
  );
