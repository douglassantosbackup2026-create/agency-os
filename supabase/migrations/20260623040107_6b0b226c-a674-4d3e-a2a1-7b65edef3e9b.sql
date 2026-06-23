
-- Tighten RLS to respect client_member_scopes

-- ga4_daily
DROP POLICY IF EXISTS ga4_daily_select ON public.ga4_daily;
DROP POLICY IF EXISTS ga4_daily_insert ON public.ga4_daily;
DROP POLICY IF EXISTS ga4_daily_update ON public.ga4_daily;
CREATE POLICY ga4_daily_select ON public.ga4_daily FOR SELECT USING (is_member_of(agency_id) AND user_can_access_client(client_id));
CREATE POLICY ga4_daily_insert ON public.ga4_daily FOR INSERT WITH CHECK (is_member_of(agency_id) AND user_can_access_client(client_id));
CREATE POLICY ga4_daily_update ON public.ga4_daily FOR UPDATE USING (is_member_of(agency_id) AND user_can_access_client(client_id)) WITH CHECK (is_member_of(agency_id) AND user_can_access_client(client_id));

-- ga4_funnel_daily
DROP POLICY IF EXISTS ga4_funnel_daily_select ON public.ga4_funnel_daily;
DROP POLICY IF EXISTS ga4_funnel_daily_insert ON public.ga4_funnel_daily;
DROP POLICY IF EXISTS ga4_funnel_daily_update ON public.ga4_funnel_daily;
CREATE POLICY ga4_funnel_daily_select ON public.ga4_funnel_daily FOR SELECT USING (is_member_of(agency_id) AND user_can_access_client(client_id));
CREATE POLICY ga4_funnel_daily_insert ON public.ga4_funnel_daily FOR INSERT WITH CHECK (is_member_of(agency_id) AND user_can_access_client(client_id));
CREATE POLICY ga4_funnel_daily_update ON public.ga4_funnel_daily FOR UPDATE USING (is_member_of(agency_id) AND user_can_access_client(client_id)) WITH CHECK (is_member_of(agency_id) AND user_can_access_client(client_id));

-- ga4_channel_daily
DROP POLICY IF EXISTS ga4_channel_daily_select ON public.ga4_channel_daily;
DROP POLICY IF EXISTS ga4_channel_daily_insert ON public.ga4_channel_daily;
DROP POLICY IF EXISTS ga4_channel_daily_update ON public.ga4_channel_daily;
CREATE POLICY ga4_channel_daily_select ON public.ga4_channel_daily FOR SELECT USING (is_member_of(agency_id) AND user_can_access_client(client_id));
CREATE POLICY ga4_channel_daily_insert ON public.ga4_channel_daily FOR INSERT WITH CHECK (is_member_of(agency_id) AND user_can_access_client(client_id));
CREATE POLICY ga4_channel_daily_update ON public.ga4_channel_daily FOR UPDATE USING (is_member_of(agency_id) AND user_can_access_client(client_id)) WITH CHECK (is_member_of(agency_id) AND user_can_access_client(client_id));

-- ga4_tracking_health_daily
DROP POLICY IF EXISTS ga4_tracking_health_daily_select ON public.ga4_tracking_health_daily;
DROP POLICY IF EXISTS ga4_tracking_health_daily_insert ON public.ga4_tracking_health_daily;
DROP POLICY IF EXISTS ga4_tracking_health_daily_update ON public.ga4_tracking_health_daily;
CREATE POLICY ga4_tracking_health_daily_select ON public.ga4_tracking_health_daily FOR SELECT USING (is_member_of(agency_id) AND user_can_access_client(client_id));
CREATE POLICY ga4_tracking_health_daily_insert ON public.ga4_tracking_health_daily FOR INSERT WITH CHECK (is_member_of(agency_id) AND user_can_access_client(client_id));
CREATE POLICY ga4_tracking_health_daily_update ON public.ga4_tracking_health_daily FOR UPDATE USING (is_member_of(agency_id) AND user_can_access_client(client_id)) WITH CHECK (is_member_of(agency_id) AND user_can_access_client(client_id));

-- sync_runs (client_id nullable)
DROP POLICY IF EXISTS sync_runs_select ON public.sync_runs;
DROP POLICY IF EXISTS sync_runs_insert ON public.sync_runs;
DROP POLICY IF EXISTS sync_runs_update ON public.sync_runs;
CREATE POLICY sync_runs_select ON public.sync_runs FOR SELECT USING (is_member_of(agency_id) AND (client_id IS NULL OR user_can_access_client(client_id)));
CREATE POLICY sync_runs_insert ON public.sync_runs FOR INSERT WITH CHECK (is_member_of(agency_id) AND (client_id IS NULL OR user_can_access_client(client_id)));
CREATE POLICY sync_runs_update ON public.sync_runs FOR UPDATE USING (is_member_of(agency_id) AND (client_id IS NULL OR user_can_access_client(client_id))) WITH CHECK (is_member_of(agency_id) AND (client_id IS NULL OR user_can_access_client(client_id)));

-- ai_jobs (client_id nullable, only SELECT exists; INSERT continues denied)
DROP POLICY IF EXISTS ai_jobs_select ON public.ai_jobs;
CREATE POLICY ai_jobs_select ON public.ai_jobs FOR SELECT USING (is_member_of(agency_id) AND (client_id IS NULL OR user_can_access_client(client_id)));

-- action_center_events (joined via action_center.client_id)
DROP POLICY IF EXISTS action_center_events_select ON public.action_center_events;
DROP POLICY IF EXISTS action_center_events_insert ON public.action_center_events;
CREATE POLICY action_center_events_select ON public.action_center_events FOR SELECT USING (
  is_member_of(agency_id) AND EXISTS (
    SELECT 1 FROM public.action_center ac
    WHERE ac.id = action_center_events.action_id
      AND (ac.client_id IS NULL OR public.user_can_access_client(ac.client_id))
  )
);
CREATE POLICY action_center_events_insert ON public.action_center_events FOR INSERT WITH CHECK (
  is_member_of(agency_id) AND EXISTS (
    SELECT 1 FROM public.action_center ac
    WHERE ac.id = action_center_events.action_id
      AND (ac.client_id IS NULL OR public.user_can_access_client(ac.client_id))
  )
);

-- agency_briefings (agency-wide; hide from scoped members)
DROP POLICY IF EXISTS agency_briefings_select ON public.agency_briefings;
DROP POLICY IF EXISTS agency_briefings_insert ON public.agency_briefings;
DROP POLICY IF EXISTS agency_briefings_update ON public.agency_briefings;
CREATE POLICY agency_briefings_select ON public.agency_briefings FOR SELECT USING (
  is_member_of(agency_id) AND (
    is_owner_or_admin(agency_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.client_member_scopes s
      WHERE s.user_id = auth.uid() AND s.agency_id = agency_briefings.agency_id
    )
  )
);
CREATE POLICY agency_briefings_insert ON public.agency_briefings FOR INSERT WITH CHECK (
  is_member_of(agency_id) AND (
    is_owner_or_admin(agency_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.client_member_scopes s
      WHERE s.user_id = auth.uid() AND s.agency_id = agency_briefings.agency_id
    )
  )
);
CREATE POLICY agency_briefings_update ON public.agency_briefings FOR UPDATE USING (
  is_member_of(agency_id) AND (
    is_owner_or_admin(agency_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.client_member_scopes s
      WHERE s.user_id = auth.uid() AND s.agency_id = agency_briefings.agency_id
    )
  )
) WITH CHECK (
  is_member_of(agency_id) AND (
    is_owner_or_admin(agency_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.client_member_scopes s
      WHERE s.user_id = auth.uid() AND s.agency_id = agency_briefings.agency_id
    )
  )
);

-- whatsapp_logs INSERT
DROP POLICY IF EXISTS whatsapp_logs_insert ON public.whatsapp_logs;
CREATE POLICY whatsapp_logs_insert ON public.whatsapp_logs FOR INSERT WITH CHECK (is_member_of(agency_id) AND user_can_access_client(client_id));
