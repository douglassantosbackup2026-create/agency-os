/** Templates por cenário com placeholders {{cliente}}, {{periodo}}, {{metrica}} */

export type MessageTemplateDef = {
  id: string;
  label: string;
  body: string;
};

export const MESSAGE_SCENARIO_TEMPLATES: MessageTemplateDef[] = [
  {
    id: "roas_drop",
    label: "Queda de ROAS",
    body:
      "Olá! Em {{periodo}} notámos uma queda de performance ({{metrica}}) na conta. Já estamos a rever criativos e segmentação; enviamos um plano de ação até {{prazo}}.",
  },
  {
    id: "budget",
    label: "Orçamento / pacing",
    body:
      "Olá! Sobre o investimento em {{periodo}}: o pacing está {{metrica}} em relação ao definido. Sugerimos {{acao}} — confirmamos contigo?",
  },
  {
    id: "creative",
    label: "Pedido de criativo",
    body:
      "Olá! Para {{cliente}}, precisamos de novos criativos (formatos: vídeo 15s + estático 1:1) até {{prazo}} para evitar fadiga e escalar com segurança.",
  },
  {
    id: "checkin",
    label: "Check-in rápido",
    body:
      "Olá! Check-in sobre {{cliente}}: em {{periodo}} os principais números foram {{metrica}}. Há algum ponto que queiram priorizar esta semana?",
  },
];

export type TemplatePlaceholders = {
  cliente: string;
  periodo: string;
  metrica: string;
  prazo?: string;
  acao?: string;
};

export function applyMessageTemplate(
  template: string,
  p: TemplatePlaceholders,
): string {
  return template
    .replace(/\{\{cliente\}\}/g, p.cliente)
    .replace(/\{\{periodo\}\}/g, p.periodo)
    .replace(/\{\{metrica\}\}/g, p.metrica)
    .replace(/\{\{prazo\}\}/g, p.prazo ?? "breve")
    .replace(/\{\{acao\}\}/g, p.acao ?? "um ajuste fino de orçamento");
}

/** Liga tipos de alerta (evaluate-alerts / UI) ao cenário de template. */
export function templateIdForAlertType(alertType: string): MessageTemplateDef["id"] {
  const m: Record<string, MessageTemplateDef["id"]> = {
    roas_drop: "roas_drop",
    budget_pacing: "budget",
    ctr_drop: "creative",
    cpa_spike: "roas_drop",
    campaign_paused: "checkin",
    no_contact: "checkin",
    ga4_conversion_drop: "checkin",
    ga4_revenue_drop: "checkin",
    ga4_sessions_up_results_down: "checkin",
    ga4_checkout_drop: "checkin",
    ga4_tracking_issue: "checkin",
  };
  return m[alertType] ?? "checkin";
}

export function draftMessageForAlert(args: {
  alertType: string;
  clientName: string;
  description?: string | null;
  title?: string | null;
  recommendedAction?: string | null;
}): { scenarioLabel: string; body: string; templateId: MessageTemplateDef["id"] } {
  const templateId = templateIdForAlertType(args.alertType);
  const def =
    MESSAGE_SCENARIO_TEMPLATES.find((t) => t.id === templateId) ??
    MESSAGE_SCENARIO_TEMPLATES.find((t) => t.id === "checkin")!;
  const metricSnippet =
    (args.description ?? args.title ?? "indicadores").trim().slice(0, 160);
  const body = applyMessageTemplate(def.body, {
    cliente: args.clientName,
    periodo: "últimos 7 dias",
    metrica: metricSnippet || "métricas principais",
    prazo: "esta semana",
    acao: args.recommendedAction ?? undefined,
  });
  return { scenarioLabel: def.label, body, templateId };
}
