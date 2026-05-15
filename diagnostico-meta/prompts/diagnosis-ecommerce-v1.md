# Prompt v1 — Diagnóstico e-commerce (Meta Ads)

Versão alinhada com a Edge Function `process-diagnosis` (`PROMPT_VERSION=diagnosis-ecommerce-v1`).

## Objetivo

Produzir JSON único para a UI com score, métricas resumidas, problemas, vazamentos (como **estimativas**), oportunidades, criativos, públicos, estrutura, plano de ação e disclaimer legal.

## Regras

- Português (PT-BR).
- Nunca garantir ROAS ou poupança exata em euros/reais sem qualificar como cenário ou intervalo.
- Usar apenas os dados fornecidos em `facts_json`; não inventar números que não possam derivar-se dos dados ou de benchmarks explícitos como “referência típica”.
- Resposta **apenas** JSON válido, sem markdown.

## Estrutura JSON esperada

Ver contrato em `supabase/functions/process-diagnosis/index.ts` (campo `system`).
