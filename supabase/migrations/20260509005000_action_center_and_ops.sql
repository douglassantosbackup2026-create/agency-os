-- Central de Ações + comunicação + observabilidade operacional.

CREATE TABLE IF NOT EXISTS public.action_center (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('alerta_ia', 'relatorio_ia', 'manual', 'whatsapp', 'briefing')),
  source_ref_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'critica')),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'feito', 'ignorado', 'adiado', 'anotacao', 'enviado_cliente', 'revisar_depois')),
  due_date DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_center_agency_status
  ON public.action_center(agency_id, status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_center_client
  ON public.action_center(client_id, created_at DESC);

DROP TRIGGER IF EXISTS tr_action_center_updated ON public.action_center;
CREATE TRIGGER tr_action_center_updated
  BEFORE UPDATE ON public.action_center
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'warning', 'error')),
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_agency_created
  ON public.sync_runs(agency_id, created_at DESC);

ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'geral';

ALTER TABLE public.health_scores
  ADD COLUMN IF NOT EXISTS score_explanation JSONB;

ALTER TABLE public.action_center ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['action_center', 'sync_runs'])
  LOOP
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (public.is_member_of(agency_id));', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (public.is_member_of(agency_id));', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (public.is_member_of(agency_id));', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE USING (public.is_owner_or_admin(agency_id));', t, t);
  END LOOP;
END $$;
