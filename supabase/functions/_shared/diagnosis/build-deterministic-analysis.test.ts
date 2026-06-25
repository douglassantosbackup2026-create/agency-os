import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { attachCommercialToFacts, buildFactsEnrichment } from "./derive-analysis.ts";
import {
  buildDeterministicAnalysis,
  buildDeterministicAnalysisSkeleton,
} from "./build-deterministic-analysis.ts";
import {
  validateAnalysis,
  validateAnalysisBasics,
  validateConsultativeNarrative,
} from "./diagnosis-validate-analysis.ts";
import { buildUserPromptSlim, buildFactsCompact } from "./build-ai-prompt.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const paprika = JSON.parse(
  readFileSync(join(__dir, "__fixtures__", "paprika-account.json"), "utf8"),
) as Record<string, unknown>;

function enrichFixture(): Record<string, unknown> {
  const campaigns = paprika.campaigns_sample as Record<string, unknown>[];
  const insights = paprika.campaigns_insights as Record<string, unknown>[];
  const { campaigns_enriched, objective_spend_mix } = buildFactsEnrichment(
    campaigns,
    insights,
  );
  return attachCommercialToFacts({
    ...paprika,
    campaigns_enriched,
    objective_spend_mix,
  });
}

describe("build-deterministic-analysis", () => {
  it("produz skeleton com criticalIssues e actionPlan", () => {
    const facts = enrichFixture();
    const skeleton = buildDeterministicAnalysisSkeleton(facts);
    expect(typeof skeleton.score).toBe("number");
    expect(String(skeleton.verdictLine).length).toBeGreaterThan(10);
    expect(Array.isArray(skeleton.criticalIssues)).toBe(true);
    expect((skeleton.criticalIssues as unknown[]).length).toBeGreaterThan(0);
    expect(Array.isArray(skeleton.actionPlan)).toBe(true);
    expect((skeleton.actionPlan as unknown[]).length).toBeGreaterThan(0);
  });

  it("normalizeAnalysisV2 preenche campos derivados", () => {
    const facts = enrichFixture();
    const analysis = buildDeterministicAnalysis(facts);
    expect(analysis.growthIntelligenceDerived).toBeDefined();
    expect(analysis.topFindings).toBeDefined();
    expect(validateAnalysisBasics(analysis)).toBe(true);
  });
});

describe("build-ai-prompt slim", () => {
  it("facts_compact não inclui campaigns_insights brutos", () => {
    const facts = enrichFixture();
    const compact = buildFactsCompact(facts);
    const json = JSON.stringify(compact);
    expect(json.length).toBeLessThan(8000);
    expect(compact).toHaveProperty("campaigns_enriched_top5");
    expect(json).not.toContain("campaigns_insights");
  });

  it("user prompt slim é menor que 50k chars", () => {
    const facts = enrichFixture();
    const prompt = buildUserPromptSlim(facts);
    expect(prompt.length).toBeLessThan(50_000);
    expect(prompt).not.toContain("facts_json:");
  });
});

describe("diagnosis-validate-analysis consultative", () => {
  it("rejeita verdictLine longa", () => {
    const facts = enrichFixture();
    const analysis = buildDeterministicAnalysis(facts);
    analysis.verdictLine = "x".repeat(300);
    expect(validateAnalysis(analysis, facts)).toBe(false);
  });

  it("rejeita frases estilo dashboard", () => {
    const facts = enrichFixture();
    const skeleton = buildDeterministicAnalysisSkeleton(facts);
    const bad = {
      ...skeleton,
      verdictLine: "CTR abaixo do ideal na conta com frequência alta.",
      summary:
        "Frequência alta na conta. ROAS baixo. Métricas abaixo do benchmark esperado para o segmento. " +
        "Recomenda-se revisar a estrutura geral e acompanhar os indicadores nas próximas semanas.",
      chapterNarratives: {
        structure: "x".repeat(50),
        audience: "x".repeat(50),
        creative: "x".repeat(50),
        scale: "x".repeat(50),
        financial: "x".repeat(50),
      },
    };
    expect(validateConsultativeNarrative(bad, facts)).toBe(false);
  });

  it("aceita análise com tom consultivo mínimo", () => {
    const facts = enrichFixture();
    const gi = facts.growth_intelligence_derived as {
      moneyLeaks: { title: string; entityName?: string; monthlyImpactFormatted: string }[];
      executiveImpact: { headlinePt: string; gapMonthlyBrl: number };
    };
    const leak = gi.moneyLeaks[0];
    const analysis = {
      ...buildDeterministicAnalysis(facts),
      verdictLine:
        `O maior vazamento está em ${leak?.title ?? "Conjunto X"}: a Meta ainda não aprendeu quem compra — pode recuperar ${leak?.monthlyImpactFormatted ?? "R$ 2 mil/mês"}.`.slice(
          0,
          220,
        ),
      narrativeHook: "Priorize consolidar conjuntos antes de escalar criativos novos.",
      summary:
        "A conta investe com estrutura de funil mista, mas há vazamento concentrado em um conjunto com falha de aprendizado. " +
        `Isso representa cerca de ${leak?.monthlyImpactFormatted ?? "R$ 2 mil"} por mês em eficiência perdida. ` +
        "Corrigir o aprendizado vem antes de testar novos criativos. O próximo passo é consolidar verba no conjunto líder.",
      chapterNarratives: {
        structure: "A estrutura mista topo/meio/fundo é coerente; o gargalo está na execução das campanhas de vendas, não na arquitetura geral da conta.",
        audience: "O público ainda não saturou — o algoritmo não completou aprendizado no conjunto que mais gasta, o que distorce frequência e custo.",
        creative: "Há sinais de criativos com potencial, mas estão diluídos em conjuntos que impedem o Meta de otimizar entrega para compradores.",
        scale: "Escalar agora amplificaria o vazamento; primeiro estabilize ROAS no conjunto com tracking e volume mínimo de conversões.",
        financial: `O gap mensal estimado é material (${leak?.monthlyImpactFormatted ?? "R$ 2 mil"}); recuperar parte disso já melhora margem de mídia no próximo ciclo de 30 dias.`,
      },
      criticalIssues: [
        {
          title: leak?.title ?? "Conjunto principal",
          description:
            "O conjunto gasta sem o Meta aprender quem compra — não é saturação de público. Impacto estimado mensal significativo.",
          cause: "Learning fail por volume insuficiente no conjunto.",
          consequence: "Custo por resultado instável e verba mal alocada.",
          financialNote: leak?.monthlyImpactFormatted ?? "R$ 2 mil/mês",
          priority: "high",
          axis: "structure",
          engine: "leak",
          hypothesisId: "h1",
          confidence: "high",
          evidenceFor: ["learning_fail no conjunto de maior gasto"],
          evidenceAgainst: [],
          conclusion: "Consolidar ad sets e aumentar verba antes de novos testes criativos.",
        },
      ],
    };
    expect(validateAnalysis(analysis, facts)).toBe(true);
  });
});
