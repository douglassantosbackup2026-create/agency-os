
-- 1) Drop the looser overlapping policies on campaign_ai_audit_recommendation_status
DROP POLICY IF EXISTS campaign_ai_audit_reco_status_insert ON public.campaign_ai_audit_recommendation_status;
DROP POLICY IF EXISTS campaign_ai_audit_reco_status_select ON public.campaign_ai_audit_recommendation_status;
DROP POLICY IF EXISTS campaign_ai_audit_reco_status_update ON public.campaign_ai_audit_recommendation_status;

-- 2) Tighten whatsapp_logs SELECT/UPDATE to require client-scope access
DROP POLICY IF EXISTS whatsapp_logs_select ON public.whatsapp_logs;
DROP POLICY IF EXISTS whatsapp_logs_update ON public.whatsapp_logs;

CREATE POLICY whatsapp_logs_select ON public.whatsapp_logs
  FOR SELECT
  USING (is_member_of(agency_id) AND user_can_access_client(client_id));

CREATE POLICY whatsapp_logs_update ON public.whatsapp_logs
  FOR UPDATE
  USING (is_member_of(agency_id) AND user_can_access_client(client_id))
  WITH CHECK (is_member_of(agency_id) AND user_can_access_client(client_id));
