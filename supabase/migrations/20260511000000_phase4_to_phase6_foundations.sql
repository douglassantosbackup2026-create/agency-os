-- Foundations for phases 4-6 (without payment gateway).

-- ==============================
-- Client platform accounts (multi-account)
-- ==============================
CREATE TABLE IF NOT EXISTS public.client_platform_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  account_external_id TEXT NOT NULL,
  account_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, provider, account_external_id)
);

CREATE INDEX IF NOT EXISTS idx_client_platform_accounts_agency
  ON public.client_platform_accounts(agency_id, provider, is_active);
CREATE INDEX IF NOT EXISTS idx_client_platform_accounts_client
  ON public.client_platform_accounts(client_id, provider, is_active);

DROP TRIGGER IF EXISTS tr_client_platform_accounts_updated ON public.client_platform_accounts;
CREATE TRIGGER tr_client_platform_accounts_updated
  BEFORE UPDATE ON public.client_platform_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================
-- Onboarding checklist per client
-- ==============================
CREATE TABLE IF NOT EXISTS public.onboarding_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_checklist_agency
  ON public.onboarding_checklist_items(agency_id, client_id, status);

DROP TRIGGER IF EXISTS tr_onboarding_checklist_items_updated ON public.onboarding_checklist_items;
CREATE TRIGGER tr_onboarding_checklist_items_updated
  BEFORE UPDATE ON public.onboarding_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================
-- Creative approvals
-- ==============================
CREATE TABLE IF NOT EXISTS public.creative_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  storage_path TEXT,
  preview_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creative_assets_agency
  ON public.creative_assets(agency_id, client_id, status, created_at DESC);

DROP TRIGGER IF EXISTS tr_creative_assets_updated ON public.creative_assets;
CREATE TRIGGER tr_creative_assets_updated
  BEFORE UPDATE ON public.creative_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.creative_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  creative_asset_id UUID NOT NULL REFERENCES public.creative_assets(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  feedback TEXT,
  reviewer_name TEXT,
  source TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'manager')),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creative_reviews_asset
  ON public.creative_reviews(creative_asset_id, reviewed_at DESC);

-- ==============================
-- Meeting reports (AI)
-- ==============================
CREATE TABLE IF NOT EXISTS public.meeting_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  period_start DATE,
  period_end DATE,
  agenda TEXT,
  what_worked TEXT,
  what_to_improve TEXT,
  next_month_plan TEXT,
  strategic_questions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_reports_client
  ON public.meeting_reports(client_id, created_at DESC);

-- ==============================
-- Client assignments for member scoping
-- ==============================
CREATE TABLE IF NOT EXISTS public.client_member_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_member_scopes_user
  ON public.client_member_scopes(agency_id, user_id, client_id);

-- ==============================
-- Competitor intelligence (MVP)
-- ==============================
CREATE TABLE IF NOT EXISTS public.competitor_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  source_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, competitor_name)
);

CREATE TABLE IF NOT EXISTS public.competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  competitor_watchlist_id UUID REFERENCES public.competitor_watchlist(id) ON DELETE CASCADE,
  headline TEXT,
  summary TEXT,
  ad_count INTEGER DEFAULT 0,
  insight TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_client
  ON public.competitor_snapshots(client_id, captured_at DESC);

-- ==============================
-- Push subscriptions (PWA)
-- ==============================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- ==============================
-- RLS for new tables
-- ==============================
ALTER TABLE public.client_platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_member_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'client_platform_accounts',
    'onboarding_checklist_items',
    'creative_assets',
    'creative_reviews',
    'meeting_reports',
    'client_member_scopes',
    'competitor_watchlist',
    'competitor_snapshots',
    'push_subscriptions'
  ])
  LOOP
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (public.is_member_of(agency_id));', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (public.is_member_of(agency_id));', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (public.is_member_of(agency_id));', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE USING (public.is_owner_or_admin(agency_id));', t, t);
  END LOOP;
END $$;
