/** Extrai bullets curtos para cartões no dashboard / lista de clientes. */
export function auditBulletsFromResult(
  resultJson: Record<string, unknown> | null | undefined,
  executiveMarkdown: string | null | undefined,
  limit = 3,
): string[] {
  const out: string[] = [];
  const recs = Array.isArray(resultJson?.recommendations)
    ? (resultJson!.recommendations as Record<string, unknown>[])
    : [];
  for (const r of recs) {
    if (out.length >= limit) break;
    if (
      r.requires_human_review === true ||
      r.requires_human_review === "true"
    ) {
      const line = String(r.suggested_copy ?? r.rationale ?? "").trim();
      if (line) out.push(line.slice(0, 220));
    }
  }
  if (out.length < limit && executiveMarkdown) {
    const lines = executiveMarkdown
      .split(/\n+/)
      .map((s) => s.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
    for (const line of lines) {
      if (out.length >= limit) break;
      if (!out.includes(line)) out.push(line.slice(0, 220));
    }
  }
  return out.slice(0, limit);
}

export function auditOverallStatus(
  resultJson: Record<string, unknown> | null | undefined,
): string | null {
  const s = resultJson?.overall_status;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}
