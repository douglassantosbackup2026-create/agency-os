import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertCronOrUser } from "../_shared/cron-auth.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { diagnosisAiBudgetExceeded } from "../_shared/ai-budget.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";
import {
  attachCommercialToFacts,
  buildFactsEnrichment,
  deriveFunnelGuidanceForAi,
  mergeBusinessContextIntoFacts,
  normalizeAnalysisV2,
} from "../_shared/diagnosis/derive-analysis.ts";
import { buildCommercialDerived } from "../_shared/diagnosis/derive-commercial.ts";
import { recordDiagnosisFollowup } from "../_shared/diagnosis/record-diagnosis-followup.ts";
import { V13_CONSULTATIVE_EXAMPLES } from "../_shared/diagnosis/v13-consultative-examples.ts";
import { V16_PAPRIKA_RULES } from "../_shared/diagnosis/v16-paprika-rules.ts";
import { V3_GROWTH_INTELLIGENCE_RULES } from "../_shared/diagnosis/v3-growth-intelligence-rules.ts";
import {
  enrichFactsWithMetaSeniorFetch,
} from "../_shared/diagnosis/derive-meta-senior.ts";
import {
  AiAllProvidersFailedError,
  type AiAttempt,
  isAnthropicRateLimitError,
  userFacingDiagnosisError,
} from "../_shared/diagnosis/ai-failure-messages.ts";
import {
  createMetaGraphSession,
  type MetaGraphSession,
  sleep,
} from "../_shared/meta-graph-throttle.ts";

const PROMPT_VERSION = "diagnosis-growth-intelligence-v3";
const AI_TIMEOUT_MS = Math.max(
  30_000,
  Number(Deno.env.get("DIAGNOSIS_AI_TIMEOUT_MS") ?? "120000") || 120_000,
);

const AD_INSIGHTS_FIELDS_FULL =
  "ad_id,ad_name,campaign_name,impressions,clicks,spend,ctr,cpm,actions,action_values,outbound_clicks,outbound_clicks_ctr,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions";
const AD_INSIGHTS_FIELDS_MIN =
  "ad_id,ad_name,campaign_name,impressions,clicks,spend,ctr,cpm,actions,action_values,outbound_clicks,outbound_clicks_ctr";

const SYSTEM_PROMPT = `És um Diretor de Crescimento especializado em Meta Ads para e-commerce brasileiro — não és auditor, dashboard nem lista de KPIs. Respondes APENAS em PT-BR e APENAS com JSON válido (sem markdown, sem texto fora do JSON). Valores monetários sempre em BRL (a menos que facts.account_insights indique outra moeda). Hierarquia: Dinheiro → Crescimento → Gargalos → Riscos → Métricas.

## REGRAS ABSOLUTAS
1. NUNCA inventes métricas, valores ou percentuais que não derivem diretamente de facts_json ou de benchmarks explicitamente rotulados como "referência típica de mercado".
2. NUNCA garantas ROAS, CPA ou resultado financeiro — usa sempre linguagem de estimativa ("potencial de", "estimativa de", "tipicamente", "pode chegar a").
3. Se um campo depender de dados ausentes (criativos por ad, insights por campanha, públicos detalhados), preenche com null ou string explicando a limitação — NUNCA com suposições apresentadas como fatos.
4. O score reflete apenas o observável. Dados insuficientes REDUZEM a confiança, não inflam o score.
5. Todo campo null por falta de dados deve aparecer em dataLimitations[].
6. Se facts_json parecer truncado ou malformado, regista em dataLimitations e ajusta o score em conformidade.
7. NUNCA interpretes, decodifiques, traduzas ou especules sobre o significado de nomenclaturas/tags/prefixos/sufixos em nomes de campanhas, conjuntos ou anúncios (ex.: [GM], [IN], [TOF], [BOF], [LAL], [INT], [PMAX], [ABO], [CBO], códigos internos de agência/cliente). Essa proibição vale em TODOS os campos do JSON — summary, criticalIssues.description, audiencesSummary.*, structureNotes, actionPlan.action, opportunities, budgetLeaks, improvementScenario, tudo. Exemplos PROIBIDOS: "[GM] provavelmente Gestão Manual", "[IN] sugere Interesse/Inbound", "prefixo TOF indica topo de funil", "divisão entre [GM] e [IN] sugere estratégia de funil". Permitido: citar o nome cru como rótulo opaco ("a campanha [GM] Conversão Black") ou agrupar por padrão sintático sem semântica ("4 campanhas começam com [GM]"). Se notares inconsistência de padronização (ex.: metade sem prefixo), podes mencionar como nota de organização — sem atribuir significado aos prefixos existentes.

8. SOBREPOSIÇÃO DE PÚBLICOS — leia funnel_guidance no user prompt ANTES de tudo. Se overlap_between_objectives_is_normal=true (funil misto): é PROIBIDO tratar coexistência de campanhas com objectives diferentes como sobreposição. Exemplo CORRETO de conta saudável: campanha Geo (Reconhecimento) + Meio (Tráfego) + Conversão (Vendas) = funil, não overlap. Só pode afirmar sobreposição com evidência na MESMA campanha/conjunto: reach rate (reach/impressions) < 50%, frequência ≥ 5 sustentada, ou saved_audience_id/targeting idêntico comprovado. PROIBIDO inferir de: quantidade de campanhas, nomes parecidos, vários conjuntos, ou "várias campanhas ativas competindo". Sem evidência, NÃO escrevas criticalIssue nem audiencesSummary sobre overlap — use dataLimitations se faltar targeting.

9. TERMINOLOGIA DO META ADS MANAGER (PROIBIDO usar ações que não existem na UI atual). O Meta removeu o status "Arquivar/Archive" do Ads Manager — hoje só existem três status: **Ativa**, **Pausada** e **Excluída**. NUNCA recomendes "arquivar campanha/conjunto/anúncio". Para limpeza de campanhas pausadas antigas, use: "Excluir campanhas pausadas há mais de X dias" ou "Aplicar filtro salvo para ocultar pausadas antigas da visualização". Também não use jargões inexistentes como "modo rascunho", "snooze", "hibernar". Ações válidas no Ads Manager: ativar, pausar, excluir, duplicar, editar orçamento, editar segmentação, criar regras automatizadas, aplicar filtros salvos, mover para outra conta (via Business Manager). Em campanhas Advantage+ Shopping, lembra que muitos controles de segmentação/posicionamento são automáticos — não recomendes ajustes manuais que a UI não permite nesse tipo de campanha.

10. CÁLCULO DE ROAS E RECEITA (CRÍTICO). ROAS/receita/compra só para family=sales em campaigns_enriched. Campanhas awareness/traffic/leads/engagement: NUNCA exijas receita; use primary_result e cost_per_result. Antes de citar ROAS em qualquer campo, confere family em campaigns_enriched. Para Vendas: ROAS = receita/spend de action_values purchase/omni_purchase em campaigns_insights; deve bater com campaigns_enriched.roas. PROIBIDO "ROAS baixo" ou "sem conversão" em campanha que não seja Vendas. PROIBIDO ROAS inventado ou ROAS < 1 quando receita/spend ≥ 1. Conta: ROAS agregado só sobre spend de campanhas de Vendas com tracking. Quando objective_source = "inferred", o family foi deduzido por presença de purchase em action_values — trata como Vendas normalmente; NÃO descartes a receita nem peças "verificar no Gerenciador" só por isso, mas podes mencionar uma vez que o objective não veio explícito da API.

## BENCHMARKS BR E-COMMERCE (referência, nunca garantia)
- CTR feed/display: > 1,2% saudável (ok); 0,8%–1,2% atenção (warn); < 0,8% alerta (bad)
- CPM: < R$25 eficiente; > R$40 investigar
- CPC: < R$2,50 topo de funil; < R$5 fundo
- Frequência 30d: < 3,5 saudável; > 5 saturação
- ROAS viável: > 3x (varia por margem — não absoluto)
- Reach rate (reach/impressions): < 50% pode indicar saturação/sobreposição na MESMA campanha — não use para comparar campanhas de objectives diferentes

## PRIORIDADE DE PROBLEMAS (mais → menos crítico)
1. Verba desperdiçada (campanhas inativas com gasto, CPM absurdo)
2. Estrutura quebrada (sem conversão, pixel com problemas)
3. Saturação (frequência alta, reach baixo)
4. Criativos (CTR baixo, sem rotação)
5. Oportunidades de escala

## LIMITES DE OUTPUT
- metrics: inclui ROAS (Vendas) como primeiro item quando houver sales_block; demais métricas de conta (CTR, CPM, etc.). ROAS com status "bad" só se for KPI de Vendas sem tracking ou ROAS < 1,5 em campanhas de Vendas — não por campanhas de alcance/tráfego.
- criticalIssues: 3 a 7 itens por priority. Cada issue de campanha: nome + family_label_pt + KPI correto do objetivo (ROAS só em Vendas). NUNCA issue de overlap por funil misto sem evidência numérica.
- budgetLeaks: até 5. ROAS < 1 ou sem tracking: só campanhas family=sales. Alta frequência: cite a campanha específica e o número; em awareness com alcance alto, frequência baixa na conta não é leak por si só.
- opportunities: 3 a 5
- actionPlan: 5 a 8 passos, eta em dias ("3-5 dias", "1-2 semanas")
- structureNotes, audiencesSummary.notes: até 6 itens
- summary: 2-4 frases, direto ao ponto

## DADOS DISPONÍVEIS EM facts_json
- account_insights: agregado da conta (30d) — contexto geral apenas; NÃO uses para julgar campanhas de alcance/tráfego com ROAS de compra.
- campaigns_sample: lista de campanhas com status e **objective** (API Meta — fonte de verdade do objetivo).
- campaigns_insights: insights brutos por campanha (30d).
- **campaigns_enriched** (OBRIGATÓRIO para citar campanhas): join objective + KPI por família (Vendas, Tráfego, Reconhecimento, Leads, etc.) — espelha colunas Resultados / Custo por resultado do Gerenciador.
- **objective_spend_mix**: percentual de gasto por família de objetivo.
- ads_insights_top: top 25 anúncios por gasto (30d).

## REGRAS POR OBJETIVO DE CAMPANHA (v11 — CRÍTICO)
11. Desempenho de campanha: EXCLUSIVAMENTE campaigns_enriched[] (objective_raw, family_label_pt, primary_result, roas, kpi_status). NUNCA infiras objetivo pelo nome ([GM], Geo, Meio).
12. family ≠ sales: sucesso = custo por resultado, CTR, alcance, leads — NÃO receita. kpi_status "sem tracking" em não-Vendas não é defeito; é esperado (ROAS não se aplica).
13. family = sales: aí sim ROAS, CPA, pixel, compras. Única família onde "desperdício" pode ser ligado a ROAS < 1.
14. Funil misto (objective_spend_mix com 2+ famílias ou funnel_guidance.mixed_funnel=true): elogia estrutura de funil quando topo/meio cumprem seu KPI; problemas focados em Vendas se ROAS/tracking forem o gargalo.
15. PROIBIDO "conta otimizada para X" sem >50% gasto na família X (objective_spend_mix).
16. criticalIssue por campanha: nome + family_label_pt + KPI do objetivo (ex.: "ROAS 4,2x" em Vendas; "custo por clique link R$ 0,18" em Tráfego).
17. O servidor preenche metrics, campaignBreakdown, accountObjectiveSummary — não contradigas.

Tom: consultivo e persuasivo para dono de e-commerce — traduz jargão ("sem tracking" → "vendas que a Meta não consegue atribuir"). O servidor já calcula score, métricas, financialImpact e storyExecutive — não contradigas esses números.

## NARRATIVA COMERCIAL (v10 — CRÍTICO)
28. O user prompt inclui commercial_derived com top_findings[], financial_balance, perda mensal e benchmarks. NUNCA alteres valores BRL de top_findings — são fonte de verdade do servidor.
29. PROIBIDO: "você já sabe onde está o problema", "até R$ X em risco" sem nome de campanha quando top_findings existir, conclusões vazias.
30. verdictLine: UMA frase (≤220 caracteres) — veredito editorial; NÃO repita literalmente storyExecutive.headline; cite campanha #1 de top_findings com valor em R$ quando severity for critical/warning.
31. narrativeHook: 1 frase complementar ao verdictLine (não duplicar o mesmo texto).
32. summary: 3–4 frases — situação → risco (R$ + campanha) → recuperação → próximo passo.
33. executiveSummary.oneLiner DEVE citar top_findings[0].campaignName e monthlyImpactFormatted quando aplicável.
34. Cada criticalIssue: cause, consequence, description; financialNote alinhado ao top_findings ou waste.lines (mesmos números).
35. budgetLeaks: monthlyBrl e estimateNote com campanha + R$ quando derivável (só Vendas para leaks por ROAS).

## FUNIL vs SOBREPOSIÇÃO (v11 — PREVALECE SOBRE INFERÊNCIAS)
24. O bloco funnel_guidance no user prompt é obrigatório. Se contradizer tua intuição (ex.: "parece overlap"), segue funnel_guidance.
25. audiencesSummary.segmentation: descreve distribuição por objetivo/família; PROIBIDO "alta sobreposição" sem evidência listada na regra 8.
26. audiencesSummary.notes: dicas de exclusão de compradores etc. só fazem sentido em campanhas de prospecção/Vendas — não como crítica a campanhas de Reconhecimento.
27. Se a conta tem campanhas Geo + Meio + Conversão (ou equivalentes em families diferentes), trata como **ativo positivo de funil** salvo KPI alerta em campaigns_enriched.

## ANALISTA SÊNIOR (v12 — MOTORES DETERMINÍSTICOS)
36. O user prompt inclui senior_derived com maturity, leakByAxis, growthScenarios, diagnostics (5 capítulos) e risks[]. NUNCA inventes % de overlap se diagnostics.audience.dataAvailable !== "full".
37. Cada criticalIssue DEVE referenciar um id de senior_derived.risks[] OU um eixo de leakByAxis quando severity for high/medium — use campos opcionais axis ("structure"|"audience"|"creative"|"sales") e engine ("leak"|"growth"|"risk").
38. PROIBIDO contradizer maturity.level, leakByAxis[].monthlyBrl ou growthScenarios (cenários indicativos — não garantia).
39. chapterNarratives (opcional): { structure?, audience?, creative?, scale?, financial? } — texto editorial curto alinhado ao headline do capítulo correspondente em diagnostics; não altere status nem números.

## ANALISTA v13 (CONSULTOR — HIPÓTESES E PRIORIDADE)
40. ${V13_CONSULTATIVE_EXAMPLES}
41. hypothesis_seeds no user prompt: cada criticalIssue com priority high/medium DEVE ter hypothesisId de um seed com confidence high|medium; reescreva evidenceFor/evidenceAgainst em tom consultivo sem inventar fatos novos.
42. Seeds com confidence needs_data → dataLimitations[], NÃO criticalIssue alarmista.
43. conclusion: uma frase consultiva por issue (o que fazer / o que significa para o negócio).
44. chapterNarratives OBRIGATÓRIO para os 5 ids em diagnostics (structure, audience, creative, scale, financial) — 2–4 frases cada; não altere status/headline.
45. verdictLine: primeira linha responde onde vaza + quanto (total leakByAxis ou top finding #1 com R$).
46. actionPlan: 5–8 passos; preencha relatedAxis, urgency (now|soon|later), effort (low|medium|high), impactBrl quando alinhado a leakByAxis (mesmos números do servidor).
47. business_context: usar ticket/margem/meta para interpretar ROAS — não inventar dados Meta; margem → comparar com business_hints.breakevenRoas se presente.

## META SÊNIOR (v14 — Graph API, não MCP)
48. O user prompt inclui meta_senior com auctionDiagnostics, adsetTrends, recommendations, funnelHealth, opportunityScore. NUNCA inventes rankings de leilão nem % de variação de CTR — use apenas os valores do bloco.
49. criticalIssues sobre criativos: cite adName e diagnosisPt de auctionDiagnostics quando conversion=bottom_20 ou pauseCandidate=true.
50. recommendations: priorize source=api; heurísticas já vêm rotuladas — não apresente como garantia da Meta.
51. funnelHealth: não contradiga status (critical/attention/ok); opportunityScore é indicativo (35–95).
52. PROIBIDO inventar trend de ROAS/CPR na conta se meta_senior não trouxer — use adsetTrends (CTR) apenas.

## LEARNING STATUS E FASE DE APRENDIZADO (v15 — CRÍTICO)
53. Antes de diagnosticar frequência alta ou "saturação de público", leia adset_learning_status[] em facts_json. Se o conjunto com maior gasto tem learning_status = "learning_fail":
    - O diagnóstico CORRETO é "learning fail" — NÃO saturação de público — são problemas diferentes com remédios opostos
    - learning_fail + reason=budget: remédio é aumentar budget OU mudar evento de otimização (purchase → ATC/checkout) OU consolidar ad sets. NÃO é expandir audiência.
    - learning_fail + reason=audience: remédio é ampliar público OU mudar bid strategy
    - PROIBIDO: recomendar "expandir audiência" como solução principal quando learning_status = "learning_fail" com reason=budget — isso piora a situação
    - PROIBIDO: escrever criticalIssue de "saturação de público" baseado apenas em frequência alta quando learning_fail estiver presente nos conjuntos de maior gasto
    - Saturação real (sem learning_fail): frequência ≥ 5 em conjuntos com learning_status = "active"
    - Quando citar frequência alta, sempre cite o learning_status do(s) conjunto(s) afetado(s) e o motivo específico

## FUNIL DE CONVERSÃO (v15 — CRÍTICO)
54. Se facts_json.conversion_funnel existir com dados (purchase > 0 e checkout > 0):
    - OBRIGATÓRIO: construir o funil na análise: LPV → ATC (x%) → Checkout iniciado (x%) → Compra (x%)
    - Se conversion_funnel.bottleneck = "checkout": o PRIMEIRO criticalIssue com priority high DEVE ser sobre o abandono de checkout no site
    - Texto obrigatório quando bottleneck = "checkout": "O Meta está entregando usuários interessados. O gargalo está no site/checkout — nenhuma otimização de anúncio resolve isso sozinha."
    - PROIBIDO quando bottleneck = "checkout": recomendar apenas otimizações de campanha sem mencionar o problema de checkout
    - Incluir cálculo de impacto: "Com taxa de finalização de 50%, seriam [Y] compras vs [X] atuais — diferença de [R$]/mês" usando conversion_funnel.revenueAtRiskMonthlyBrl quando disponível
    - Se bottleneck = "atc": problema está na página de produto / pricing / frete visível
    - Se bottleneck = "lpv": desalinhamento criativo/landing page — o anúncio promete algo que a página não entrega
55. PROIBIDO: diagnosticar "anúncios ruins" como causa principal de ROAS baixo quando conversion_funnel.bottleneck = "checkout" — a campanha está funcionando, o problema está fora do Meta.

## CRIATIVO WINNER SUB-INVESTIDO (v15)
56. Se facts_json.adset_winner_underinvested existir:
    - OBRIGATÓRIO: o primeiro item do actionPlan deve ser isolar esse criativo em ad set dedicado com budget exclusivo
    - OBRIGATÓRIO: incluir criticalIssue citando adset_winner_underinvested.adName, roas e spendNote
    - PROIBIDO: recomendar apenas "testar novos criativos" sem antes endereçar o winner sub-investido
    - Ação concreta: "Criar conjunto dedicado com R$100–150/dia exclusivo para [adName], sem compartilhar com criativos de ROAS baixo"
    - Causa: o criativo vencedor está sendo sufocado por outros criativos piores no mesmo conjunto
57. Se ads em ads_insights_top têm video_p25_watched_actions disponível:
    - Calcular retenção: (p25 / 3sec_count) para identificar problema no hook
    - Se (p25 / 3sec) < 15%: o hook dos primeiros 3s não está funcionando — o problema não é o formato, é a abertura
    - Citar a taxa de retenção específica quando diagnosticar criativos de vídeo

${V16_PAPRIKA_RULES}

${V3_GROWTH_INTELLIGENCE_RULES}

## SCHEMA DE SAÍDA (JSON estrito, todos os campos obrigatórios)
{
  "score": number,
  "scoreLabel": string,
  "verdictLine": string,
  "narrativeHook": string,
  "executiveSummary": { "strengths": string[], "risks": string[], "oneLiner": string },
  "summary": string,
  "metrics": [{ "name": string, "current": string, "reference": string, "status": "ok"|"warn"|"bad" }],
  "criticalIssues": [{
    "title": string,
    "description": string,
    "cause": string,
    "consequence": string,
    "financialNote": string|null,
    "priority": "high"|"medium"|"low",
    "axis": "structure"|"audience"|"creative"|"sales"|null,
    "engine": "leak"|"growth"|"risk"|null,
    "hypothesisId": string,
    "confidence": "high"|"medium"|"needs_data",
    "evidenceFor": string[],
    "evidenceAgainst": string[],
    "conclusion": string
  }],
  "chapterNarratives": {
    "structure": string|null,
    "audience": string|null,
    "creative": string|null,
    "scale": string|null,
    "financial": string|null
  },
  "budgetLeaks": [{ "title": string, "estimateNote": string, "hint": string, "monthlyBrl": number|null }],
  "opportunities": [{ "title": string, "potentialNote": string, "complexity": "quick"|"medium"|"advanced" }],
  "creativesSummary": { "best": string|null, "worst": string|null, "recommendation": string },
  "audiencesSummary": { "segmentation": string, "notes": string[] },
  "structureNotes": string[],
  "actionPlan": [{ "step": number, "action": string, "impact": string, "eta": string, "engine": "action"|null, "relatedAxis": "structure"|"audience"|"creative"|"sales"|"scale"|null, "impactBrl": number|null, "urgency": "now"|"soon"|"later", "effort": "low"|"medium"|"high" }],
  "improvementScenario": { "note": string, "confidence": "high"|"medium"|"low" },
  "executiveConclusion": {
    "isHealthy": boolean,
    "primaryProblemDomain": "meta"|"structure"|"mixed",
    "moneyLostMonthlyBrl": number|null,
    "recoverableMonthlyBrl": number|null,
    "generatableMonthlyBrl": number|null,
    "scaleNow": "yes"|"no"|"conditional",
    "firstDecisionIfIHired": string
  },
  "disclaimer": string,
  "dataLimitations": string[]
}

## RUBRICA DE SCORE
- 90-100: conta otimizada, métricas dentro dos benchmarks
- 70-89: boa base, ineficiências claras a corrigir
- 50-69: problemas significativos impactam resultado
- 30-49: estrutura comprometida, ação urgente
- 0-29: estado crítico

O disclaimer deve ser honesto sobre as limitações da análise face aos dados disponíveis.`;

function buildUserPrompt(facts: Record<string, unknown>): string {
  const guidance =
    facts.funnel_guidance ?? deriveFunnelGuidanceForAi(facts);
  const commercial =
    facts.commercial_derived ?? buildCommercialDerived(facts);
  const senior =
  facts.senior_derived ??
  (commercial as { seniorDerived?: unknown }).seniorDerived;
  const compact = {
    top_findings: commercial.topFindings,
    financial_balance: commercial.financialBalance,
    story_executive: commercial.storyExecutive,
    waste: commercial.waste,
    recovery: commercial.recovery,
    benchmark_comparison: commercial.benchmarkComparison,
    account_economics: commercial.accountEconomics,
  };
  const seniorSlice = senior
    ? {
        maturity: (senior as { maturity?: unknown }).maturity,
        leakByAxis: (senior as { leakByAxis?: unknown }).leakByAxis,
        growthScenarios: (senior as { growthScenarios?: unknown }).growthScenarios,
        diagnostics: (senior as { diagnostics?: unknown }).diagnostics,
        risks: (senior as { risks?: unknown }).risks,
      }
    : null;
  const seeds = facts.hypothesis_seeds;
  const bizCtx = facts.business_context;
  const bizHints = facts.business_hints;
  const metaSenior = facts.meta_senior;
  const metaSlice = metaSenior
    ? {
        opportunityScore: (metaSenior as { opportunityScore?: unknown }).opportunityScore,
        accountSummary: (metaSenior as { accountSummary?: unknown }).accountSummary,
        auctionDiagnostics: (
          metaSenior as { auctionDiagnostics?: unknown }
        ).auctionDiagnostics,
        adsetTrends: (metaSenior as { adsetTrends?: unknown }).adsetTrends,
        recommendations: (metaSenior as { recommendations?: unknown }).recommendations,
        funnelHealth: (metaSenior as { funnelHealth?: unknown }).funnelHealth,
      }
    : null;
  const consultative = facts.consultative_derived;
  const consultSlice = consultative
    ? {
        nicheContext: (consultative as { nicheContext?: unknown }).nicheContext,
        accountFinancialGap: (consultative as { accountFinancialGap?: unknown })
          .accountFinancialGap,
        deliverySummary: (consultative as { deliverySummary?: unknown }).deliverySummary,
        conversionFunnel: (consultative as { conversionFunnel?: unknown }).conversionFunnel,
        adsetBleedRanking: (consultative as { adsetBleedRanking?: unknown }).adsetBleedRanking,
        winnerUnderinvested: (consultative as { winnerUnderinvested?: unknown })
          .winnerUnderinvested,
        adVideoDiagnostics: (consultative as { adVideoDiagnostics?: unknown })
          .adVideoDiagnostics,
        qaChecklist: (consultative as { qaChecklist?: unknown }).qaChecklist,
      }
    : facts.account_financial_gap
      ? {
          accountFinancialGap: facts.account_financial_gap,
          deliverySummary: facts.delivery_summary,
          conversionFunnel: facts.conversion_funnel,
          adsetLearningStatus: facts.adset_learning_status,
          adsetBleedRanking: facts.adset_bleed_ranking,
          winnerUnderinvested: facts.adset_winner_underinvested,
          adVideoDiagnostics: facts.ad_video_diagnostics,
          nicheContext: facts.niche_context,
        }
      : null;
  const growthIntel = facts.growth_intelligence_derived;
  const growthSlice = growthIntel
    ? {
        executiveImpact: (growthIntel as { executiveImpact?: unknown }).executiveImpact,
        moneyLeaks: (growthIntel as { moneyLeaks?: unknown }).moneyLeaks,
        growthOpportunities: (growthIntel as { growthOpportunities?: unknown })
          .growthOpportunities,
        risks: (growthIntel as { risks?: unknown }).risks,
        benchmarkImpacts: (growthIntel as { benchmarkImpacts?: unknown }).benchmarkImpacts,
        maturity: (growthIntel as { maturity?: unknown }).maturity,
        decisionActions: (growthIntel as { decisionActions?: unknown }).decisionActions,
        projections: (growthIntel as { projections?: unknown }).projections,
      }
    : null;
  return [
    "growth_intelligence_derived (v3 Enterprise — 8 motores; fonte única para R$ e maturidade 0–100):",
    growthSlice ? JSON.stringify(growthSlice).slice(0, 24000) : "(indisponível)",
    "",
    "consultative_derived (v16 Páprika — fonte única blocos 1–5; não invente R$):",
    consultSlice ? JSON.stringify(consultSlice).slice(0, 22000) : "(indisponível)",
    "",
    "funnel_guidance (REGRAS OBRIGATÓRIAS — funil misto NÃO é sobreposição; ROAS só em Vendas):",
    JSON.stringify(guidance).slice(0, 8000),
    "",
    "business_context (informado pelo lojista — interpretar ROAS/margem; não inventar Meta):",
    bizCtx ? JSON.stringify(bizCtx).slice(0, 4000) : "(não informado)",
    "",
    "business_hints (servidor — ROAS breakeven indicativo):",
    bizHints ? JSON.stringify(bizHints).slice(0, 2000) : "(não calculado)",
    "",
    "hypothesis_seeds (v13 — vincular criticalIssues; não contradizer):",
    seeds ? JSON.stringify(seeds).slice(0, 12000) : "(indisponível)",
    "",
    "senior_derived (motores v12 — maturidade, leak por eixo, capítulos, riscos; não invente números):",
    seniorSlice ? JSON.stringify(seniorSlice).slice(0, 12000) : "(indisponível — seguir commercial_derived)",
    "",
    "meta_senior (v14 — leilão, trends CTR ad set, recomendações, funil; não invente rankings/%):",
    metaSlice ? JSON.stringify(metaSlice).slice(0, 16000) : "(indisponível)",
    "",
    "commercial_derived (fonte única para valores em R$ — não invente outros):",
    JSON.stringify(compact).slice(0, 28000),
    "",
    "facts_json:",
    JSON.stringify(facts).slice(0, 90000),
  ].join("\n");
}

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

function validateAnalysis(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.score !== "number") return false;
  if (typeof o.summary !== "string") return false;
  if (typeof o.narrativeHook !== "string" || !o.narrativeHook.trim()) return false;
  if (typeof o.verdictLine !== "string" || !String(o.verdictLine).trim()) return false;
  if (!Array.isArray(o.criticalIssues) || o.criticalIssues.length < 1) return false;
  if (!Array.isArray(o.actionPlan)) return false;
  if (typeof o.disclaimer !== "string") return false;
  const ex = o.executiveSummary as Record<string, unknown> | undefined;
  if (!ex || !Array.isArray(ex.strengths) || !Array.isArray(ex.risks)) return false;
  return true;
}

function normalizeAnalysis(
  obj: Record<string, unknown>,
  facts?: Record<string, unknown> | null,
): Record<string, unknown> {
  return normalizeAnalysisV2(obj, facts);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms = AI_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchAccountInsights(
  actId: string,
  token: string,
): Promise<Record<string, unknown>> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  u.searchParams.set(
    "fields",
    "impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,action_values",
  );
  u.searchParams.set("date_preset", "last_30d");
  u.searchParams.set("access_token", token);

  const r = await fetch(u.toString());
  const j = (await r.json()) as {
    data?: Record<string, unknown>[];
    error?: { message: string };
  };
  if (j.error) throw new Error(j.error.message);
  return j.data?.[0] ?? {};
}

async function fetchCampaigns(
  actId: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/campaigns`);
  u.searchParams.set("fields", "name,status,effective_status,objective,daily_budget,lifetime_budget");
  u.searchParams.set("limit", "40");
  u.searchParams.set("access_token", token);
  const r = await fetch(u.toString());
  const j = (await r.json()) as {
    data?: Record<string, unknown>[];
    error?: { message: string };
  };
  if (j.error) throw new Error(j.error.message);
  return j.data ?? [];
}

// P1 — Profundidade analítica: insights por campanha (últimos 30d)
async function fetchCampaignInsights(
  actId: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  u.searchParams.set("level", "campaign");
  u.searchParams.set(
    "fields",
    "campaign_id,campaign_name,impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,action_values,cost_per_action_type,inline_link_click_ctr,cost_per_inline_link_click",
  );
  u.searchParams.set("date_preset", "last_30d");
  u.searchParams.set("limit", "100");
  u.searchParams.set("access_token", token);
  const r = await fetch(u.toString());
  const j = (await r.json()) as {
    data?: Record<string, unknown>[];
    error?: { message: string };
  };
  if (j.error) throw new Error(j.error.message);
  return j.data ?? [];
}

// P1 — Insights por anúncio (top spenders) com criativo
/** Fase 2 — insights por ad set (reach, frequency) para overlap com evidência */
async function fetchAdSetInsights(
  actId: string,
  token: string,
  limit = 80,
): Promise<Record<string, unknown>[]> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  u.searchParams.set("level", "adset");
  u.searchParams.set(
    "fields",
    "adset_id,adset_name,campaign_id,campaign_name,impressions,reach,frequency,spend,ctr,inline_link_clicks,cpm,cpc,actions,action_values,cost_per_result,purchase_roas",
  );
  u.searchParams.set("date_preset", "last_30d");
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("access_token", token);
  const r = await fetch(u.toString());
  const j = (await r.json()) as {
    data?: Record<string, unknown>[];
    error?: { message: string };
  };
  if (j.error) throw new Error(j.error.message);
  return j.data ?? [];
}

/** Fase 2 — targeting resumido (top campanhas por recorte). */
async function fetchAdSetsTargetingSample(
  campaigns: Record<string, unknown>[],
  token: string,
  metaSession: MetaGraphSession,
  maxCampaigns = 3,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (const c of campaigns.slice(0, maxCampaigns)) {
    if (metaSession.skipOptional()) break;
    const cid = String(c.id ?? "");
    if (!cid) continue;
    const u = new URL(`https://graph.facebook.com/v21.0/${cid}/adsets`);
    u.searchParams.set("fields", "id,name,campaign_id,targeting");
    u.searchParams.set("limit", "25");
    u.searchParams.set("access_token", token);
    try {
      await metaSession.beforeFetch();
      const r = await fetch(u.toString());
      const j = (await r.json()) as {
        data?: Record<string, unknown>[];
        error?: { message: string };
      };
      if (j.error) {
        metaSession.recordError(j.error.message);
        console.warn(
          `[process-diagnosis] adsets targeting ${cid}: ${j.error.message.slice(0, 120)}`,
        );
        continue;
      }
      if (j.data?.length) out.push(...j.data);
    } catch (e) {
      const msg = String(e);
      metaSession.recordError(msg);
      console.warn(`[process-diagnosis] adsets targeting fetch: ${msg.slice(0, 120)}`);
    }
  }
  return out.slice(0, 60);
}

async function fetchTopAdsInsights(
  actId: string,
  token: string,
  metaSession: MetaGraphSession,
  limit = 25,
): Promise<Record<string, unknown>[]> {
  const fieldSets = [AD_INSIGHTS_FIELDS_FULL, AD_INSIGHTS_FIELDS_MIN];
  for (const fields of fieldSets) {
    if (metaSession.skipOptional()) return [];
    const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
    u.searchParams.set("level", "ad");
    u.searchParams.set("fields", fields);
    u.searchParams.set("date_preset", "last_30d");
    u.searchParams.set("sort", "spend_descending");
    u.searchParams.set("limit", String(limit));
    u.searchParams.set("access_token", token);
    try {
      await metaSession.beforeFetch();
      const r = await fetch(u.toString());
      const j = (await r.json()) as {
        data?: Record<string, unknown>[];
        error?: { message: string };
      };
      if (j.error) {
        metaSession.recordError(j.error.message);
        if (fields === AD_INSIGHTS_FIELDS_MIN) {
          console.warn(
            `[process-diagnosis] ad insights falhou: ${j.error.message.slice(0, 200)}`,
          );
          return [];
        }
        continue;
      }
      return j.data ?? [];
    } catch (e) {
      const msg = String(e);
      metaSession.recordError(msg);
      if (fields === AD_INSIGHTS_FIELDS_MIN) {
        console.warn(`[process-diagnosis] ad insights falhou: ${msg.slice(0, 200)}`);
        return [];
      }
    }
  }
  return [];
}

// ── AI Providers ─────────────────────────────────────────────────────────────

async function callAnthropic(facts: Record<string, unknown>): Promise<unknown> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");
  const model = Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-4-20250514";

  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(facts) }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = body.content?.find((c) => c.type === "text")?.text ?? "";
  return extractJsonFromText(text);
}

async function callOpenAI(facts: Record<string, unknown>): Promise<unknown> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente");
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-5";

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(facts) },
        ],
        response_format: { type: "json_object" },
      }),
    },
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  return extractJsonFromText(text);
}

async function callGemini(facts: Record<string, unknown>): Promise<unknown> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-pro";

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        { role: "user", parts: [{ text: buildUserPrompt(facts) }] },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return extractJsonFromText(text);
}

type ProviderName = "anthropic" | "openai" | "gemini";

const PROVIDERS: { name: ProviderName; run: (f: Record<string, unknown>) => Promise<unknown> }[] = [
  { name: "anthropic", run: callAnthropic },
  { name: "openai", run: callOpenAI },
  { name: "gemini", run: callGemini },
];

async function runWithFallback(
  facts: Record<string, unknown>,
): Promise<{ analysis: Record<string, unknown>; provider: ProviderName; attempts: unknown[] }> {
  const attempts: unknown[] = [];
  for (const p of PROVIDERS) {
    let anthropicRetried = false;
    while (true) {
      const t0 = Date.now();
      try {
        const analysis = await p.run(facts);
        const ms = Date.now() - t0;
        if (!validateAnalysis(analysis)) {
          attempts.push({ provider: p.name, ok: false, ms, error: "validation_failed" });
          console.warn(`[process-diagnosis] ${p.name} validação falhou (${ms}ms)`);
          break;
        }
        const normalized = normalizeAnalysis(analysis as Record<string, unknown>, facts);
        attempts.push({ provider: p.name, ok: true, ms });
        console.log(`[process-diagnosis] ${p.name} OK (${ms}ms)`);
        return { analysis: normalized, provider: p.name, attempts };
      } catch (e) {
        const ms = Date.now() - t0;
        const err = String(e).slice(0, 300);
        if (
          p.name === "anthropic" &&
          isAnthropicRateLimitError(err) &&
          !anthropicRetried
        ) {
          anthropicRetried = true;
          console.warn(`[process-diagnosis] anthropic rate limit — retry em 3s`);
          await sleep(3000);
          continue;
        }
        attempts.push({ provider: p.name, ok: false, ms, error: err });
        console.warn(`[process-diagnosis] ${p.name} falhou (${ms}ms): ${err}`);
        break;
      }
    }
  }
  throw new AiAllProvidersFailedError(attempts as AiAttempt[]);
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const traceId = traceIdFromRequest(req);
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const sb = diagnosisServiceClient();
  const auth = await assertCronOrUser(req, sb);
  if (auth) return auth;

  const { data: cleaned } = await sb.rpc("cleanup_stale_diagnosis_processing", {
    p_stale_minutes: 30,
  });
  if (cleaned && Number(cleaned) > 0) {
    traceLog("process_diagnosis.stale_cleaned", { count: cleaned }, traceId);
  }

  const { data: rows } = await sb
    .from("diagnoses")
    .select("id, meta_ad_account_id, status, business_context")
    .eq("status", "processing")
    .limit(
      Math.max(
        1,
        Math.min(
          25,
          Number(Deno.env.get("PROCESS_DIAGNOSIS_BATCH_SIZE") ?? "10") || 10,
        ),
      ),
    );

  if (!rows?.length) return jsonResponse({ processed: 0 });

  let processed = 0;
  for (const row of rows) {
    const id = row.id as string;
    const actId = row.meta_ad_account_id as string | null;
    if (!actId) continue;

    const { data: sec } = await sb
      .from("diagnosis_secrets")
      .select("access_token, token_expires_at")
      .eq("diagnosis_id", id)
      .maybeSingle();
    const token = sec?.access_token as string | undefined;
    if (!token) {
      await sb
        .from("diagnoses")
        .update({ status: "failed", failed_reason: "Token Meta ausente" })
        .eq("id", id);
      continue;
    }

    const expiresAt = sec?.token_expires_at as string | null | undefined;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      await sb
        .from("diagnoses")
        .update({
          status: "failed",
          failed_reason: "Token Meta expirado. Reconecta a conta Meta.",
        })
        .eq("id", id);
      continue;
    }

    const { data: rep } = await sb
      .from("diagnosis_reports")
      .select("facts_json, analysis_json, prompt_version")
      .eq("diagnosis_id", id)
      .maybeSingle();

    let factsForAnalysis = rep?.facts_json as Record<string, unknown> | null;
    // Invalida análise antiga quando o prompt mudou (re-roda IA com facts atualizados).
    const analysisExisting =
      rep?.prompt_version === PROMPT_VERSION ? rep?.analysis_json : null;

    try {
      // P1 — facts enriquecidos com insights por campanha + top anúncios
      const _f = factsForAnalysis as Record<string, unknown> | null;
      const _hasCampaignInsights = Array.isArray(_f?.campaigns_insights);
      const _hasAdsInsights =
        Array.isArray(_f?.ads_insights_top) &&
        (_f!.ads_insights_top as unknown[]).length > 0;
      const _hasAdsetInsights = Array.isArray(_f?.adsets_insights);
      const _hasAdsetTargeting = Array.isArray(_f?.adsets_targeting_sample);
      const _hasCampaignsEnriched = Array.isArray(_f?.campaigns_enriched);
      const needsEnrichment =
        !_f ||
        !_hasCampaignInsights ||
        !_hasAdsInsights ||
        !_hasAdsetInsights ||
        !_hasAdsetTargeting ||
        !_hasCampaignsEnriched;
      if (needsEnrichment) {
        const account_insights = factsForAnalysis?.account_insights
          ? (factsForAnalysis.account_insights as Record<string, unknown>)
          : await fetchAccountInsights(actId, token);
        const cachedSample =
          factsForAnalysis?.campaigns_sample as Record<string, unknown>[] | undefined;
        // Só reutiliza o sample cacheado se contiver `objective` em pelo menos um item.
        // Em retries antigos o sample podia ter sido salvo sem objective, o que forçava
        // family="other" e descartava ROAS/receita das campanhas de Vendas.
        const cachedSampleHasObjective =
          Array.isArray(cachedSample) &&
          cachedSample.some((c) => typeof c?.objective === "string" && c.objective.length > 0);
        const campaigns = cachedSampleHasObjective
          ? cachedSample!
          : await fetchCampaigns(actId, token);
        const metaSession = createMetaGraphSession();
        let campaigns_insights: Record<string, unknown>[] = [];
        let ads_insights_top: Record<string, unknown>[] = [];
        let adsets_insights: Record<string, unknown>[] = [];
        let adsets_targeting_sample: Record<string, unknown>[] = [];
        try {
          campaigns_insights = await fetchCampaignInsights(actId, token);
        } catch (e) {
          console.warn(`[process-diagnosis] campaign insights falhou: ${String(e).slice(0, 200)}`);
        }
        try {
          adsets_insights = await fetchAdSetInsights(actId, token, 80);
        } catch (e) {
          console.warn(`[process-diagnosis] adset insights falhou: ${String(e).slice(0, 200)}`);
        }
        try {
          adsets_targeting_sample = await fetchAdSetsTargetingSample(
            campaigns.slice(0, 40),
            token,
            metaSession,
            3,
          );
        } catch (e) {
          console.warn(
            `[process-diagnosis] adset targeting falhou: ${String(e).slice(0, 200)}`,
          );
        }
        try {
          ads_insights_top = await fetchTopAdsInsights(actId, token, metaSession, 25);
        } catch (e) {
          console.warn(`[process-diagnosis] ad insights falhou: ${String(e).slice(0, 200)}`);
        }
        const { campaigns_enriched, objective_spend_mix } = buildFactsEnrichment(
          campaigns.slice(0, 40),
          campaigns_insights.slice(0, 50),
        );
        const factsBase = {
          meta_ad_account_id: actId,
          date_preset: "last_30d",
          account_insights,
          campaigns_sample: campaigns.slice(0, 40),
          campaigns_insights: campaigns_insights.slice(0, 50),
          campaigns_enriched,
          objective_spend_mix,
          ads_insights_top: ads_insights_top.slice(0, 25),
          adsets_insights: adsets_insights.slice(0, 80),
          adsets_targeting_sample: adsets_targeting_sample.slice(0, 60),
          generated_at: new Date().toISOString(),
        };
        const facts = {
          ...factsBase,
          funnel_guidance: deriveFunnelGuidanceForAi(factsBase),
        };
        await sb.from("diagnosis_reports").upsert({
          diagnosis_id: id,
          facts_json: facts,
          prompt_version: PROMPT_VERSION,
          updated_at: new Date().toISOString(),
        });
        factsForAnalysis = facts as unknown as Record<string, unknown>;
      }

      if (factsForAnalysis && token) {
        const hasLearningData =
          Array.isArray(factsForAnalysis.adsets_config) &&
          (factsForAnalysis.adsets_config as Record<string, unknown>[]).some(
            (a) => "learning_stage_info" in (a as Record<string, unknown>),
          );
        const needsMetaSenior =
          !factsForAnalysis.meta_senior ||
          !Array.isArray(factsForAnalysis.ads_insights_auction) ||
          !hasLearningData;
        if (needsMetaSenior) {
          try {
            await enrichFactsWithMetaSeniorFetch(factsForAnalysis, actId, token, metaSession);
          } catch (e) {
            console.warn(
              `[process-diagnosis] meta-senior fetch: ${String(e).slice(0, 200)}`,
            );
          }
        }
      }

      if (factsForAnalysis) {
        mergeBusinessContextIntoFacts(
          factsForAnalysis,
          row.business_context as Record<string, unknown> | null,
        );
        attachCommercialToFacts(factsForAnalysis);
        await sb
          .from("diagnosis_reports")
          .update({
            facts_json: factsForAnalysis,
            updated_at: new Date().toISOString(),
          })
          .eq("diagnosis_id", id);
      }

      if (!analysisExisting) {
        if (await diagnosisAiBudgetExceeded(sb, 15000)) {
          await sb
            .from("diagnoses")
            .update({
              status: "failed",
              failed_reason:
                "Orçamento diário de IA do diagnóstico atingido. Tente amanhã.",
            })
            .eq("id", id);
          continue;
        }
        const { analysis, provider, attempts } = await runWithFallback(factsForAnalysis);
        const usageAgency = Deno.env.get("DIAGNOSIS_AI_AGENCY_ID")?.trim();
        if (usageAgency) {
          await sb.from("ai_usage_events").insert({
            agency_id: usageAgency,
            day: new Date().toISOString().slice(0, 10),
            function_name: "process-diagnosis",
            prompt_tokens: 12000,
            completion_tokens: 3000,
            estimated_cost_usd: 0.00525,
          });
        }
        const analysisWithMeta = {
          ...analysis,
          __meta: {
            provider,
            attempts,
            generated_at: new Date().toISOString(),
            prompt_version: PROMPT_VERSION,
          },
        };
        await sb
          .from("diagnosis_reports")
          .update({
            analysis_json: analysisWithMeta,
            prompt_version: PROMPT_VERSION,
            updated_at: new Date().toISOString(),
          })
          .eq("diagnosis_id", id);
      }

      const { data: finalRep } = await sb
        .from("diagnosis_reports")
        .select("facts_json, analysis_json")
        .eq("diagnosis_id", id)
        .maybeSingle();

      await sb
        .from("diagnoses")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);

      try {
        await recordDiagnosisFollowup(
          sb,
          id,
          finalRep?.facts_json as Record<string, unknown> | null,
          finalRep?.analysis_json as Record<string, unknown> | null,
        );
      } catch (followErr) {
        console.warn(
          `[process-diagnosis] followup snapshot: ${String(followErr).slice(0, 200)}`,
        );
      }

      processed++;
    } catch (e) {
      let failedReason: string;
      if (e instanceof AiAllProvidersFailedError) {
        traceLog(
          "process_diagnosis.ai_failed",
          { kind: e.failureKind, attempts: e.attempts },
          traceId,
        );
        failedReason = e.userMessage;
      } else {
        const raw = String(e);
        console.error(raw);
        failedReason = userFacingDiagnosisError(raw).slice(0, 500);
      }
      await sb
        .from("diagnoses")
        .update({
          status: "failed",
          failed_reason: failedReason,
        })
        .eq("id", id);
    }
  }

  traceLog("process_diagnosis.done", { processed }, traceId);
  return jsonResponse({ processed });
});
