-- GA4 business/funnel/channel/tracking layer.

CREATE TABLE IF NOT EXISTS public.ga4_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sessions BIGINT NOT NULL DEFAULT 0,
  users_count BIGINT NOT NULL DEFAULT 0,
  conversions BIGINT NOT NULL DEFAULT 0,
  revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  avg_ticket NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, date)
);

CREATE TABLE IF NOT EXISTS public.ga4_funnel_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  view_item BIGINT NOT NULL DEFAULT 0,
  add_to_cart BIGINT NOT NULL DEFAULT 0,
  begin_checkout BIGINT NOT NULL DEFAULT 0,
  purchase BIGINT NOT NULL DEFAULT 0,
  add_to_cart_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  checkout_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  purchase_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, date)
);

CREATE TABLE IF NOT EXISTS public.ga4_channel_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  channel TEXT NOT NULL,
  sessions BIGINT NOT NULL DEFAULT 0,
  conversions BIGINT NOT NULL DEFAULT 0,
  revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  revenue_per_session NUMERIC(14,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, date, channel)
);

CREATE TABLE IF NOT EXISTS public.ga4_tracking_health_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'critical')),
  connected BOOLEAN NOT NULL DEFAULT false,
  property_valid BOOLEAN NOT NULL DEFAULT false,
  events_ok BOOLEAN NOT NULL DEFAULT false,
  conversion_event_ok BOOLEAN NOT NULL DEFAULT false,
  revenue_available BOOLEAN NOT NULL DEFAULT false,
  data_sufficient BOOLEAN NOT NULL DEFAULT false,
  tracking_drop_detected BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, date)
);

ALTER TABLE public.health_scores
  ADD COLUMN IF NOT EXISTS ga4_context JSONB;

CREATE INDEX IF NOT EXISTS idx_ga4_daily_client_date
  ON public.ga4_daily(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ga4_funnel_client_date
  ON public.ga4_funnel_daily(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ga4_channel_client_date
  ON public.ga4_channel_daily(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ga4_tracking_client_date
  ON public.ga4_tracking_health_daily(client_id, date DESC);

ALTER TABLE public.ga4_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga4_funnel_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga4_channel_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga4_tracking_health_daily ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'ga4_daily',
    'ga4_funnel_daily',
    'ga4_channel_daily',
    'ga4_tracking_health_daily'
  ])
  LOOP
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (public.is_member_of(agency_id));', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (public.is_member_of(agency_id));', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (public.is_member_of(agency_id));', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE USING (public.is_owner_or_admin(agency_id));', t, t);
  END LOOP;
END $$;
