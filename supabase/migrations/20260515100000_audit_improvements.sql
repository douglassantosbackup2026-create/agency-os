-- Índice para dashboard / queries por agência
CREATE INDEX IF NOT EXISTS idx_campaign_ai_audits_agency_created
  ON public.campaign_ai_audits(agency_id, created_at DESC);

-- Estado persistente por recomendação de auditoria
CREATE TABLE IF NOT EXISTS public.campaign_ai_audit_recommendation_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES public.campaign_ai_audits(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_action TEXT NOT NULL
    CHECK (user_action IN ('open', 'analyzed', 'dismissed', 'task_created')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (audit_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_reco_status_client_audit
  ON public.campaign_ai_audit_recommendation_status(client_id, audit_id);

ALTER TABLE public.campaign_ai_audit_recommendation_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_ai_audit_reco_status_select
  ON public.campaign_ai_audit_recommendation_status FOR SELECT
  USING (public.is_member_of(agency_id));
CREATE POLICY campaign_ai_audit_reco_status_insert
  ON public.campaign_ai_audit_recommendation_status FOR INSERT
  WITH CHECK (public.is_member_of(agency_id));
CREATE POLICY campaign_ai_audit_reco_status_update
  ON public.campaign_ai_audit_recommendation_status FOR UPDATE
  USING (public.is_member_of(agency_id));
CREATE POLICY campaign_ai_audit_reco_status_delete
  ON public.campaign_ai_audit_recommendation_status FOR DELETE
  USING (public.is_owner_or_admin(agency_id));
