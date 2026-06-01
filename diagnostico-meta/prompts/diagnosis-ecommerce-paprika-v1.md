# Diagnóstico Meta Ads E-commerce — Páprika v1.0

Versão de referência alinhada com `PROMPT_VERSION=diagnosis-ecommerce-v16` na Edge Function `process-diagnosis`.

Documento canônico do consultor sênior (identidade, 7 blocos, benchmarks por nicho, substatuses, exemplos Páprika). A implementação em produção usa:

- Motores determinísticos em `supabase/functions/_shared/diagnosis/derive-consultative-blocks.ts`
- Regras compactas em `v16-paprika-rules.ts`
- Slices dedicados no `buildUserPrompt` (não depender só do `facts_json` truncado)

## Ordem dos 7 blocos (UI + narrativa IA)

1. Impacto financeiro (`account_financial_gap`)
2. Status de entrega (`delivery_summary`)
3. Top 3 problemas (`adset_bleed_ranking` + `topFindings`)
4. Funil (`conversion_funnel`)
5. Criativos (`adset_winner_underinvested`, `ad_video_diagnostics`)
6. Plano (`prioritizedActions` / `actionPlan`)
7. Projeção (`growthScenarios`, `improvementScenario`)

## Nichos suportados (benchmarks v1)

- `ecom_moda`, `ecom_beleza`, `ecom_casa`, `ecom_eletronicos`, `ecom_esportes`, `ecom_alimentos`, `ecom_geral`

Resolução de nicho: formulário `business_context` → heurística campanhas/conta → `account_meta.vertical` → default.

## Regra de ouro

Ler `objective` / `family` antes de criticar métrica. ROAS só em campanhas de Vendas.

Ver especificação completa no repositório (prompt do usuário v1.0, maio/2026).
