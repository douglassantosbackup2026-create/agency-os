import type { CommercialDerived, WasteLine } from "./derive-commercial.ts";
import { deriveCreativeDependency } from "./derive-creative-diagnosis.ts";
import type { DiagnosticChapter, LeakByAxisItem, LeakAxis } from "./derive-senior-types.ts";

const AXIS_LABELS: Record<LeakAxis, string> = {
  structure: "Estrutura",
  audience: "Públicos",
  creative: "Criativo",
  sales: "Vendas / funil",
};

function fmtBRL(n: number): string {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function classifyWasteAxis(
  line: WasteLine,
  enriched: { name: string; family?: string }[],
): LeakAxis {
  const reason = line.label.toLowerCase();
  const firstCamp = line.campaignNames[0] ?? "";
  const camp = enriched.find(
    (c) =>
      c.name === firstCamp ||
      firstCamp.includes(c.name) ||
      c.name.includes(firstCamp),
  );
  if (/frequência|freq|público|alcance|reach|topo|meio|saturação/i.test(reason)) {
    return "audience";
  }
  if (/criativo|ctr|anúncio|ad /i.test(reason)) return "creative";
  if (camp?.family === "sales" || /roas|venda|purchase|conversão|vendas/i.test(reason)) {
    return "sales";
  }
  if (/estrutura|campanha|pausad|fragment/i.test(reason)) return "structure";
  return camp?.family === "sales" ? "sales" : "structure";
}

export function deriveLeakByAxis(
  commercial: CommercialDerived,
  facts: Record<string, unknown> | null | undefined,
  chapters: {
    structure: DiagnosticChapter;
    audience: DiagnosticChapter;
    creative: DiagnosticChapter;
  },
): LeakByAxisItem[] {
  const enriched = Array.isArray(facts?.campaigns_enriched)
    ? (facts!.campaigns_enriched as { name: string; family?: string }[])
    : [];

  const byAxis = new Map<LeakAxis, { monthlyBrl: number; lines: string[] }>();

  for (const line of commercial.waste.lines) {
    const axis = classifyWasteAxis(line, enriched);
    const cur = byAxis.get(axis) ?? { monthlyBrl: 0, lines: [] };
    cur.monthlyBrl += line.monthlyBrl;
    const names = line.campaignNames.slice(0, 2).join(", ") || line.label;
    cur.lines.push(`${names}: ${line.label}`);
    byAxis.set(axis, cur);
  }

  const dep = deriveCreativeDependency(facts);
  if (dep?.isHighDependency && commercial.waste.totalMonthlyBrl > 0) {
    const creative = byAxis.get("creative") ?? { monthlyBrl: 0, lines: [] };
    const bump = Math.min(
      commercial.waste.totalMonthlyBrl * 0.15,
      commercial.recovery.conservativeMonthlyBrl * 0.25,
    );
    if (bump > 50) {
      creative.monthlyBrl += bump;
      creative.lines.push(
        `Dependência criativa (${dep.topAdSpendSharePct}% gasto no top ad) — risco de queda se saturar`,
      );
      byAxis.set("creative", creative);
    }
  }

  if (chapters.audience.status === "critical" && commercial.waste.totalMonthlyBrl > 0) {
    const aud = byAxis.get("audience") ?? { monthlyBrl: 0, lines: [] };
    const bump = Math.min(commercial.waste.totalMonthlyBrl * 0.1, 800);
    if (bump > 30 && aud.monthlyBrl < bump) {
      aud.monthlyBrl = Math.max(aud.monthlyBrl, bump);
      aud.lines.push(chapters.audience.headline);
      byAxis.set("audience", aud);
    }
  }

  const items: LeakByAxisItem[] = [];
  for (const axis of ["structure", "audience", "creative", "sales"] as LeakAxis[]) {
    const data = byAxis.get(axis);
    if (!data || data.monthlyBrl <= 0) continue;
    const monthlyBrl = Math.round(data.monthlyBrl * 100) / 100;
    const severity =
      monthlyBrl >= commercial.waste.totalMonthlyBrl * 0.35
        ? "critical"
        : monthlyBrl >= commercial.waste.totalMonthlyBrl * 0.15
          ? "warning"
          : "info";
    items.push({
      axis,
      axisLabel: AXIS_LABELS[axis],
      monthlyBrl,
      monthlyFormatted: fmtBRL(monthlyBrl),
      severity,
      headline: `${AXIS_LABELS[axis]}: ~${fmtBRL(monthlyBrl)}/mês em desperdício ou risco estimado`,
      evidence: data.lines.slice(0, 3).join(" · "),
    });
  }

  return items.sort((a, b) => b.monthlyBrl - a.monthlyBrl).slice(0, 5);
}
