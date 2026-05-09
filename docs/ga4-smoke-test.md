# GA4 Smoke Test (E2E)

## Objetivo
Validar ingestão GA4, score, alertas e prompts com dados reais.

## Pré-requisitos
- Integração `google_analytics` conectada por OAuth.
- `account_id` com Property ID válida.
- Cliente ativo com métricas recentes.

## Passos
1. Executar `sync-platform` para `provider=google_analytics`.
2. Verificar persistência em:
   - `ga4_daily`
   - `ga4_funnel_daily`
   - `ga4_channel_daily`
   - `ga4_tracking_health_daily`
3. Executar `compute-health-scores` e validar `ga4_context` em `health_scores`.
4. Executar `evaluate-alerts` e validar gatilhos `ga4_*` quando houver queda relevante.
5. Executar `generate-report` nos modos `monthly_manager`, `monthly_client` e `on_demand`.
6. Validar nas telas:
   - dashboard (resultado site/tracking),
   - cliente (GA4 no card de insights),
   - relatórios (métricas GA4 em `raw_data`),
   - portal cliente (seção Resultado no site).

## Critério de sucesso
- Todas as tabelas GA4 recebem dados no período.
- Score/alertas reagem a variações de conversão/receita/funil.
- Relatórios IA incluem contexto de negócio + funil.
