# 07 — Auditoria de campanhas (IA)

**Prompt key:** `07-auditoria-campanhas`  
**Versão runtime:** `07-v1`  
**Função Edge:** `campaign-ai-audit`

## Objetivo

Auditar campanhas pagas com base em `metrics_daily` (nível campanha), contexto GA4 (totais a nível de propriedade e, quando existir, dimensão `sessionCampaignName` via `ga4_campaign_daily`), e health de tracking. Produzir recomendações **sugeridas** (nunca ordens), com revisão humana quando o pré-processamento ou o tracking exigirem.

## Atribuição GA4

- **`ga4_campaign_dimension`**: uso direto das linhas GA4 agregadas por nome de campanha quando o match nome ads ↔ GA4 é forte ou parcial.
- **`spend_share_heuristic`**: quando não há match ou não há dados por campanha, reparte sessões/conversões/receita do período pela quota de gasto da campanha.
- **`unavailable`**: sem dados GA4 no período.

O JSON de saída deve incluir `ga4_attribution_method` coerente com o pacote recebido (o servidor também pode denormalizar isto em `result_json`).

## System prompt (referência)

```
És auditor sénior de performance de media paga. Não inventes números fora do pacote JSON.
Regras obrigatórias:
- Português (PT-PT/PT-BR neutro).
- Copy sugestiva: "Sugestão: avaliar pausa", nunca ordens diretas ao cliente ("Pausar agora").
- Se flags.low_volume ou tracking_critical ou tracking_match não matched: não recomendar escalar nem cortes agressivos; preferir investigate ou fix_tracking.
- Responde APENAS com um único objeto JSON válido (sem markdown fora do JSON).
```

## JSON de saída (contrato)

O modelo deve devolver **apenas** um objeto JSON com:

| Campo | Tipo | Notas |
|-------|------|--------|
| `executive_summary_markdown` | string | Resumo curto em Markdown para UI |
| `overall_status` | string | `healthy` \| `attention` \| `risk` \| `critical` |
| `tracking_issues` | array | `{ severity, detail, campaign_id? }` |
| `do_not_touch` | array | `{ campaign_id, reason }` |
| `recommendations` | array | Ver abaixo |
| `confianca_analise` | string | `alta` \| `media` \| `baixa` |
| `notes` | string | Opcional |

### `recommendations[]`

| Campo | Tipo |
|-------|------|
| `campaign_id` | string (UUID) |
| `campaign_name` | string |
| `platform` | string |
| `suggestion_type` | `investigate` \| `creative_refresh` \| `audience_tune` \| `budget_shift` \| `fix_tracking` \| `scale` \| `pause` |
| `suggested_copy` | string — texto sugestivo para o gestor |
| `rationale` | string |
| `confidence` | `alta` \| `media` \| `baixa` |
| `requires_human_review` | boolean |
| `tracking_match` | `matched` \| `partial` \| `unmatched` \| `unavailable` |

## Governança pós-modelo (Edge)

A função `campaign-ai-audit` aplica:

- Limite de campanhas enviadas ao modelo (ranking por impacto).
- Regras TS: volume baixo → não sugerir pausa/escala/corte agressivo sem `investigate` + `requires_human_review`.
- Tracking crítico → bloqueio de recomendações de escala agressiva.
- Persistência em `campaign_ai_audits` com `prompt_version: 07-v1` e evento em `ai_usage_events` (`function_name: campaign-ai-audit`).

## Dados de entrada (pacote)

Gerado em código e enviado como JSON no turno `user`:

- `period`, `client`, `ga4` (totais, health, método global).
- `account_benchmarks` (ROAS/CPA médios ponderados no período).
- `campaigns_ranked_for_model` — até 15 campanhas com métricas agregadas, `tracking_match`, `ga4_attribution_method` por linha e `flags`.
