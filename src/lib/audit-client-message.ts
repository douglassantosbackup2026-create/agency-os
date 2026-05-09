/** Texto de apoio para comunicação com o cliente (sempre revisão humana). */

export function buildDraftClientMessageFromRecommendations(
  recommendations: Record<string, unknown>[],
  clientName: string,
): string {
  const bullets = recommendations
    .map((r) => String(r.suggested_copy ?? r.rationale ?? "").trim())
    .filter(Boolean);
  const header = [
    "[Rascunho interno — rever antes de enviar ao cliente]",
    "",
    "Olá,",
    "",
    `Segue um resumo dos pontos que estamos a acompanhar em ${clientName}:`,
    "",
  ];
  const body = bullets.length
    ? bullets.map((b) => `- ${b}`).join("\n")
    : "- (sem bullets automáticos — complete manualmente)";
  const footer = [
    "",
    "Qualquer dúvida, estamos disponíveis.",
    "",
    "[Esta mensagem foi gerada a partir das sugestões da auditoria IA; não constitui compromisso de resultados.]",
  ];
  return [...header, body, ...footer].join("\n");
}

export function recommendationCampaignKeys(
  recs: Record<string, unknown>[],
): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  for (const r of recs) {
    const id = String(r.campaign_id ?? "").trim();
    if (id) m.set(id, r);
  }
  return m;
}

export function overallStatusLabel(json: Record<string, unknown>): string {
  const v = json.overall_status ?? json.status;
  return v != null && String(v).trim() !== "" ? String(v) : "—";
}
