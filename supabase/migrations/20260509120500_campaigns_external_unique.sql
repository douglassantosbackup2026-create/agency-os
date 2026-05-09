-- Evita linhas duplicadas de campanhas por cliente/plataforma/ex ID externo quando o sync faz upsert repetido.

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_client_platform_external
ON public.campaigns (client_id, platform, external_id)
WHERE external_id IS NOT NULL;
