
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.client_status AS ENUM ('active', 'paused', 'onboarding', 'churned');
CREATE TYPE public.health_risk AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.alert_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.alert_status AS ENUM ('open', 'in_progress', 'resolved', 'dismissed');
CREATE TYPE public.campaign_status AS ENUM ('active', 'paused', 'archived');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE public.integration_provider AS ENUM ('meta_ads', 'google_ads', 'tiktok_ads', 'google_analytics', 'whatsapp', 'openai');
CREATE TYPE public.integration_status AS ENUM ('connected', 'disconnected', 'error');
CREATE TYPE public.whatsapp_status AS ENUM ('queued', 'sent', 'delivered', 'failed');

-- =========================================
-- HELPER: updated_at trigger
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================
-- AGENCIES
-- =========================================
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#7c5cff',
  custom_domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_agencies_updated BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- USER ROLES (separate table — security)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, agency_id, role)
);

-- =========================================
-- SECURITY DEFINER HELPERS
-- =========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _agency_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND agency_id = _agency_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND agency_id = _agency_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_admin(_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND agency_id = _agency_id AND role IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_agency()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT agency_id FROM public.profiles WHERE id = auth.uid();
$$;

-- =========================================
-- CLIENTS
-- =========================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  segment TEXT,
  status public.client_status NOT NULL DEFAULT 'active',
  monthly_budget NUMERIC(12,2) DEFAULT 0,
  mrr NUMERIC(12,2) DEFAULT 0,
  responsible_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  contact_email TEXT,
  contact_phone TEXT,
  portal_slug TEXT UNIQUE,
  started_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_agency ON public.clients(agency_id);
CREATE TRIGGER tr_clients_updated BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- CAMPAIGNS
-- =========================================
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  status public.campaign_status NOT NULL DEFAULT 'active',
  daily_budget NUMERIC(12,2) DEFAULT 0,
  objective TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_client ON public.campaigns(client_id);
CREATE INDEX idx_campaigns_agency ON public.campaigns(agency_id);
CREATE TRIGGER tr_campaigns_updated BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- METRICS DAILY
-- =========================================
CREATE TABLE public.metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  spend NUMERIC(14,2) DEFAULT 0,
  revenue NUMERIC(14,2) DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  roas NUMERIC(8,2) DEFAULT 0,
  cpa NUMERIC(10,2) DEFAULT 0,
  ctr NUMERIC(6,3) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_metrics_client_date ON public.metrics_daily(client_id, date DESC);
CREATE INDEX idx_metrics_agency_date ON public.metrics_daily(agency_id, date DESC);

-- =========================================
-- HEALTH SCORES
-- =========================================
CREATE TABLE public.health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  risk public.health_risk NOT NULL DEFAULT 'low',
  performance_score INTEGER DEFAULT 0,
  optimization_score INTEGER DEFAULT 0,
  communication_score INTEGER DEFAULT 0,
  stability_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_client ON public.health_scores(client_id, recorded_at DESC);

-- =========================================
-- ALERTS
-- =========================================
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority public.alert_priority NOT NULL DEFAULT 'medium',
  status public.alert_status NOT NULL DEFAULT 'open',
  recommended_action TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_agency ON public.alerts(agency_id, status, priority);
CREATE INDEX idx_alerts_client ON public.alerts(client_id);
CREATE TRIGGER tr_alerts_updated BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- ACTIVITIES (timeline)
-- =========================================
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_agency ON public.activities(agency_id, created_at DESC);
CREATE INDEX idx_activities_client ON public.activities(client_id, created_at DESC);

-- =========================================
-- REPORTS (IA)
-- =========================================
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  period_start DATE,
  period_end DATE,
  executive_summary TEXT,
  positives TEXT,
  problems TEXT,
  opportunities TEXT,
  next_steps TEXT,
  client_friendly_summary TEXT,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_client ON public.reports(client_id, created_at DESC);

-- =========================================
-- NOTES
-- =========================================
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_client ON public.notes(client_id, created_at DESC);
CREATE TRIGGER tr_notes_updated BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- TASKS
-- =========================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  due_date DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_agency ON public.tasks(agency_id, status);
CREATE TRIGGER tr_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- INTEGRATIONS
-- =========================================
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  status public.integration_status NOT NULL DEFAULT 'disconnected',
  config JSONB DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, provider)
);
CREATE TRIGGER tr_integrations_updated BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- WHATSAPP LOGS
-- =========================================
CREATE TABLE public.whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  template TEXT,
  status public.whatsapp_status NOT NULL DEFAULT 'queued',
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_whatsapp_agency ON public.whatsapp_logs(agency_id, created_at DESC);

-- =========================================
-- NOTIFICATIONS
-- =========================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read, created_at DESC);

-- =========================================
-- FEATURE FLAGS
-- =========================================
CREATE TABLE public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, key)
);

-- =========================================
-- RLS POLICIES
-- =========================================

-- AGENCIES
CREATE POLICY agencies_select ON public.agencies FOR SELECT
  USING (public.is_member_of(id));
CREATE POLICY agencies_update ON public.agencies FOR UPDATE
  USING (public.is_owner_or_admin(id));
CREATE POLICY agencies_insert ON public.agencies FOR INSERT
  WITH CHECK (true); -- handled via signup trigger

-- PROFILES
CREATE POLICY profiles_select ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR (agency_id IS NOT NULL AND public.is_member_of(agency_id))
  );
CREATE POLICY profiles_update ON public.profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY profiles_insert ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- USER_ROLES
CREATE POLICY roles_select ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.is_owner_or_admin(agency_id));
CREATE POLICY roles_insert ON public.user_roles FOR INSERT
  WITH CHECK (public.is_owner_or_admin(agency_id) OR user_id = auth.uid());
CREATE POLICY roles_update ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), agency_id, 'owner'));
CREATE POLICY roles_delete ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), agency_id, 'owner'));

-- Generic agency-scoped policies for the rest
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'clients','campaigns','metrics_daily','health_scores','alerts',
    'activities','reports','notes','tasks','integrations','whatsapp_logs',
    'feature_flags'
  ])
  LOOP
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (public.is_member_of(agency_id));', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (public.is_member_of(agency_id));', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (public.is_member_of(agency_id));', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE USING (public.is_owner_or_admin(agency_id));', t, t);
  END LOOP;
END $$;

-- NOTIFICATIONS — per user
CREATE POLICY notifications_select ON public.notifications FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY notifications_update ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY notifications_insert ON public.notifications FOR INSERT
  WITH CHECK (public.is_member_of(agency_id));
CREATE POLICY notifications_delete ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- =========================================
-- AUTO PROFILE + AGENCY ON SIGNUP
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_agency_id UUID;
  agency_name TEXT;
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  agency_name := COALESCE(NEW.raw_user_meta_data->>'agency_name', split_part(NEW.email, '@', 1) || ' agency');
  base_slug := lower(regexp_replace(agency_name, '[^a-z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'agency'; END IF;
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.agencies WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  INSERT INTO public.agencies (name, slug)
  VALUES (agency_name, final_slug)
  RETURNING id INTO new_agency_id;

  INSERT INTO public.profiles (id, agency_id, display_name, email)
  VALUES (NEW.id, new_agency_id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)), NEW.email);

  INSERT INTO public.user_roles (user_id, agency_id, role)
  VALUES (NEW.id, new_agency_id, 'owner');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- ENABLE REALTIME
-- =========================================
ALTER TABLE public.alerts REPLICA IDENTITY FULL;
ALTER TABLE public.activities REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
