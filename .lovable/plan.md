# Por que a receita das campanhas de conversão não aparece

## Diagnóstico (causa raiz confirmada nos dados)

Diagnóstico inspecionado: `7e8e3d16-306f-4960-ace3-56de6a3f0b6a` (status `completed`).

Na campanha **[GM] - Conversão 1** (`campaign_id 6910581785226`):

- `campaigns_insights[].action_values` contém **R$ 30.949,28** em `purchase`, `omni_purchase`, `offsite_conversion.fb_pixel_purchase`, `onsite_web_purchase` (gasto R$ 7.446,41 → ROAS real ≈ 4,16x).
- Em `campaigns_enriched[]` essa mesma campanha aparece como:
  - `objective_raw: "UNKNOWN"`
  - `family: "other"` → `family_label_pt: "Outro"`
  - `roas: null`
  - `kpi_status: "sem dados"` / `kpi_status_reason: "Objetivo não mapeado — verifique no Gerenciador de Anúncios."`

Ou seja: a receita **existe** nos dados crus, mas é descartada na etapa de enriquecimento.

### Por quê

1. `campaigns_sample` salvo em `facts_json` traz somente `{id, name, status, effective_status}` — **sem `objective`, `daily_budget`, `lifetime_budget`**, apesar de `fetchCampaigns` em `supabase/functions/process-diagnosis/index.ts:406` pedir esses campos. A API Meta está omitindo `objective` para essa conta/token (provável: token sem escopo `ads_management` completo, ou campanhas antigas com objective herdado / ODAX migrado).
2. Em `supabase/functions/_shared/diagnosis/campaign-objective.ts:406-407`, sem `meta.objective`, cai para `"UNKNOWN"` → `mapObjectiveToFamily` devolve `"other"`.
3. Na linha 423-424 a receita só é calculada quando `family === "sales"`:
   ```ts
   const roas = family === "sales" ? computeRoas(action_values, spend) : null;
   ```
4. Como consequência:
   - `roas = null`
   - `kpi_status = "sem dados"`
   - Toda a cadeia downstream (`derive-commercial`, `derive-top-findings`, `derive-meta-senior`, `derive-analysis` totals, prompt do LLM) filtra por `family === "sales"` e ignora a campanha.
   - O agregado da conta mostra "sem receita" mesmo havendo R$ 30k+ rastreados pelo pixel.
5. Há ainda um caminho de cache em `process-diagnosis/index.ts:762-764`: se `factsForAnalysis.campaigns_sample` já existir no `diagnosis_reports`, ele é reutilizado **sem refetch**, perpetuando o sample minimalista entre tentativas.

## Plano de ajuste

Tudo em backend (edge functions), sem mudar UI. Escopo cirúrgico no pipeline de enriquecimento.

### 1. Inferir family por sinais quando `objective` vier vazio
Arquivo: `supabase/functions/_shared/diagnosis/campaign-objective.ts`

- Em `enrichCampaigns`, quando `mapObjectiveToFamily(objective_raw) === "other"`, aplicar fallback nesta ordem (apenas se objective ausente/UNKNOWN — não sobrescrever objective explícito da API):
  1. Se `action_values` contém qualquer um de `purchase`, `omni_purchase`, `offsite_conversion.fb_pixel_purchase`, `onsite_web_purchase`, `onsite_web_app_purchase` com valor > 0 → `family = "sales"` (`family_inferred_from = "purchase_action_values"`).
  2. Se `actions` contém `lead`, `onsite_conversion.lead_grouped` ou `offsite_conversion.fb_pixel_lead` com count > 0 e sem purchase → `family = "leads"`.
  3. Caso contrário, manter `"other"`.
- Computar `roas` quando `family === "sales"` **independentemente** de o objective ter vindo do Meta ou da inferência.
- Anotar `objective_source: "meta" | "inferred"` em `CampaignEnriched` para auditoria (não muda o contrato, só adiciona campo opcional).
- Quando `family` foi inferido, ajustar `kpi_status_reason` para algo como `"Objetivo da API ausente — classificada como Vendas por presença de compras rastreadas."` em vez de "sem dados".

### 2. Garantir refetch do sample com `objective` em retries
Arquivo: `supabase/functions/process-diagnosis/index.ts` (linhas 762-764)

- Trocar o `??` que reaproveita `factsForAnalysis.campaigns_sample` por uma checagem: só reutilizar se o sample contiver pelo menos um item com chave `objective` definida. Caso contrário, refetch via `fetchCampaigns`.
- Continua barato: 1 chamada Graph extra apenas quando o cache está incompleto.

### 3. Tornar o prompt e o agregador resilientes a `objective_source = "inferred"`
Arquivos: `supabase/functions/process-diagnosis/index.ts` (bloco DADOS/REGRAS) e `supabase/functions/_shared/diagnosis/derive-analysis.ts`

- Atualizar a regra #10 do prompt para reconhecer `objective_source` e permitir ROAS/receita quando family foi inferida por purchase action_values (mantendo a proibição de inventar receita).
- Em `deriveAccountSummary` e `derive-commercial`, somar receita/ROAS agregada sobre **todas** campanhas com `roas != null`, não apenas as com `objective_raw` mapeado por nome.

### 4. Testes
- Adicionar caso em `campaign-objective.test.ts`: fixture com `objective: ""` e `action_values` com `purchase` → espera `family === "sales"`, `roas` > 0, `kpi_status` ∈ {`bom`,`atenção`,`alerta`}.
- Adicionar caso oposto: sem purchase nem leads → mantém `family === "other"`.

### 5. Reprocessar diagnósticos afetados
- Após deploy, re-enfileirar diagnósticos onde existir em `diagnosis_reports.facts_json -> 'campaigns_enriched'` algum item com `family = "other"` mas cujo `campaigns_insights` correspondente tenha `purchase` em `action_values`. Migração: `UPDATE diagnoses SET status='processing', failed_reason=NULL, updated_at=now() WHERE id IN (...)`. Mostro a query final para você aprovar antes de rodar.

## Detalhes técnicos (resumo)

- Arquivos editados: `_shared/diagnosis/campaign-objective.ts`, `process-diagnosis/index.ts`, `_shared/diagnosis/derive-analysis.ts`, `_shared/diagnosis/derive-commercial.ts` (apenas o agregado), `_shared/diagnosis/campaign-objective.test.ts`.
- Deploy: `process-diagnosis`.
- Sem mudanças de schema, sem migração de tabela. Sem mudanças de UI.
- Impacto colateral: contas que **realmente** não são de vendas, mas têm pixel de view_content disparando como purchase por erro de tag, podem ser reclassificadas. Mitigação: gatilho exige `purchase`/`omni_purchase` **com valor monetário > 0** e gasto > 0 — não basta presença em `actions`.

## Pós-deploy / verificação
- Reprocessar o diagnóstico `7e8e3d16-...` e conferir:
  - `campaigns_enriched[campaign_id=6910581785226].family === "sales"`
  - `roas ≈ 4.16`
  - Bloco de receita no relatório executivo passa a mostrar R$ 30.949,28.
