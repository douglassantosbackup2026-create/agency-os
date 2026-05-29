/**
 * Chaves de métricas presentes no payload de sync (para delete de órfãos).
 */
export function syncMetricRowKeys(
  rows: Array<{ date: string; campaign_id?: string | null }>,
): { dates: string[]; campaignIds: string[] } {
  const dates = [...new Set(rows.map((r) => r.date).filter(Boolean))];
  const campaignIds = [
    ...new Set(
      rows
        .map((r) => r.campaign_id)
        .filter((id): id is string => !!id),
    ),
  ];
  return { dates, campaignIds };
}

export function webhookEventIsDuplicate(pgCode: string | undefined): boolean {
  return pgCode === "23505";
}

export function aiJobPollDone(
  status: string,
): "done" | "failed" | "pending" {
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  return "pending";
}
