ALTER TABLE public.diagnoses
  ADD COLUMN IF NOT EXISTS business_context jsonb;

COMMENT ON COLUMN public.diagnoses.business_context IS
  'P3: contexto de negócio opcional informado pelo usuário (ticket médio, margem, meta, nicho, notas). Usado para interpretação contextual no relatório, separado dos dados observados da Meta.';
