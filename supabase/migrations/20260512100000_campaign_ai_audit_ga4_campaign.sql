-- Auditor IA de campanhas + GA4 por nome de campanha (sessão).

CREATE TABLE IF NOT EXISTS public.campaign_ai_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  ga4_tracking_health TEXT NOT NULL
    CHECK (ga4_tracking_health IN ('healthy', 'partial', 'broken', 'unavailable')),
  executive_summary_markdown TEXT,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT NOT NULL DEFAULT '',
  prompt_version TEXT NOT NULL DEFAULT '07-v1'
);

CREATE INDEX IF NOT EXISTS idx_campaign_ai_audits_client_created
  ON public.campaign_ai_audits(client_id, created_at DESC);

ALTER TABLE public.campaign_ai_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_ai_audits_select ON public.campaign_ai_audits
  FOR SELECT USING (public.is_member_of(agency_id));
CREATE POLICY campaign_ai_audits_insert ON public.campaign_ai_audits
  FOR INSERT WITH CHECK (public.is_member_of(agency_id));
CREATE POLICY campaign_ai_audits_update ON public.campaign_ai_audits
  FOR UPDATE USING (public.is_member_of(agency_id));
CREATE POLICY campaign_ai_audits_delete ON public.campaign_ai_audits
  FOR DELETE USING (public.is_owner_or_admin(agency_id));

CREATE TABLE IF NOT EXISTS public.ga4_campaign_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_id_ga4 TEXT,
  sessions BIGINT NOT NULL DEFAULT 0,
  conversions BIGINT NOT NULL DEFAULT 0,
  revenue NUMERIC(14, 2) NOT NULL DEFAULT 0,
  landing_page TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, date, campaign_name)
);

CREATE INDEX IF NOT EXISTS idx_ga4_campaign_daily_client_date
  ON public.ga4_campaign_daily(client_id, date DESC);

ALTER TABLE public.ga4_campaign_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY ga4_campaign_daily_select ON public.ga4_campaign_daily
  FOR SELECT USING (public.is_member_of(agency_id));
CREATE POLICY ga4_campaign_daily_insert ON public.ga4_campaign_daily
  FOR INSERT WITH CHECK (public.is_member_of(agency_id));
CREATE POLICY ga4_campaign_daily_update ON public.ga4_campaign_daily
  FOR UPDATE USING (public.is_member_of(agency_id));
CREATE POLICY ga4_campaign_daily_delete ON public.ga4_campaign_daily
  FOR DELETE USING (public.is_owner_or_admin(agency_id));

DO $$
DECLARE
  conname TEXT;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class r ON r.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = r.relnamespace
  WHERE n.nspname = 'public'
    AND r.relname = 'action_center'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%source_type%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.action_center DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE public.action_center ADD CONSTRAINT action_center_source_type_check
  CHECK (source_type IN (
    'alerta_ia',
    'relatorio_ia',
    'manual',
    'whatsapp',
    'briefing',
    'auditoria_campanhas_ia'
  ));
