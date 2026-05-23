-- Fix clients_insert self-referential limit bypass
DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients
  FOR INSERT
  WITH CHECK (
    is_member_of(agency_id)
    AND (
      (SELECT count(*)::int FROM public.clients c WHERE c.agency_id = clients.agency_id)
      < COALESCE(
        (SELECT s.max_clients FROM public.subscriptions s WHERE s.agency_id = clients.agency_id LIMIT 1),
        5
      )
    )
  );

-- Restrict push_subscriptions access to the owning user only
DROP POLICY IF EXISTS push_subscriptions_select ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_update ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert ON public.push_subscriptions;

CREATE POLICY push_subscriptions_select ON public.push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY push_subscriptions_insert ON public.push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_member_of(agency_id));

CREATE POLICY push_subscriptions_update ON public.push_subscriptions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subscriptions_delete ON public.push_subscriptions
  FOR DELETE USING (user_id = auth.uid());