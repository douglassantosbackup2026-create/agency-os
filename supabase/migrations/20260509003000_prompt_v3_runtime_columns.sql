-- Prompt v3 runtime compatibility columns (backward-compatible).

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS prompt_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_output_text TEXT,
  ADD COLUMN IF NOT EXISTS ai_output_json JSONB,
  ADD COLUMN IF NOT EXISTS confianca TEXT CHECK (confianca IN ('alta', 'media', 'baixa')),
  ADD COLUMN IF NOT EXISTS requer_revisao_humana BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_envio TEXT NOT NULL DEFAULT 'pendente_revisao'
    CHECK (status_envio IN ('pendente_revisao', 'aprovado', 'enviado', 'descartado'));

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS prompt_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_output_text TEXT,
  ADD COLUMN IF NOT EXISTS ai_output_json JSONB,
  ADD COLUMN IF NOT EXISTS confianca TEXT CHECK (confianca IN ('alta', 'media', 'baixa')),
  ADD COLUMN IF NOT EXISTS requer_revisao_humana BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_envio TEXT NOT NULL DEFAULT 'pendente_revisao'
    CHECK (status_envio IN ('pendente_revisao', 'aprovado', 'enviado', 'descartado')),
  ADD COLUMN IF NOT EXISTS avoid_duplicate_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS should_create_task BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS task_title TEXT,
  ADD COLUMN IF NOT EXISTS time_to_act TEXT;

ALTER TABLE public.meeting_reports
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS prompt_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_output_text TEXT,
  ADD COLUMN IF NOT EXISTS ai_output_json JSONB,
  ADD COLUMN IF NOT EXISTS confianca TEXT CHECK (confianca IN ('alta', 'media', 'baixa')),
  ADD COLUMN IF NOT EXISTS requer_revisao_humana BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status_envio TEXT NOT NULL DEFAULT 'pendente_revisao'
    CHECK (status_envio IN ('pendente_revisao', 'aprovado', 'enviado', 'descartado'));

ALTER TABLE public.competitor_snapshots
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS prompt_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_output_text TEXT,
  ADD COLUMN IF NOT EXISTS ai_output_json JSONB,
  ADD COLUMN IF NOT EXISTS confianca TEXT CHECK (confianca IN ('alta', 'media', 'baixa')),
  ADD COLUMN IF NOT EXISTS requer_revisao_humana BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_envio TEXT NOT NULL DEFAULT 'pendente_revisao'
    CHECK (status_envio IN ('pendente_revisao', 'aprovado', 'enviado', 'descartado'));

CREATE INDEX IF NOT EXISTS idx_alerts_dedup_v3
  ON public.alerts (client_id, type, created_at DESC);
