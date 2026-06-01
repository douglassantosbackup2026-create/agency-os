/**
 * Fase 2 — resumo de targeting por ad set (IDs de público salvo, sem expandir semântica).
 */

export type AdsetTargetingRow = {
  adset_id: string;
  campaign_id: string;
  name: string;
  custom_audience_ids: string[];
  geo_keys: string[];
};

function collectIds(targeting: unknown, key: string): string[] {
  if (!targeting || typeof targeting !== "object") return [];
  const t = targeting as Record<string, unknown>;
  const raw = t[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (typeof x === "object" && x && "id" in x) return String((x as { id: unknown }).id);
      return typeof x === "string" ? x : "";
    })
    .filter(Boolean);
}

export function summarizeAdsetTargeting(
  adsets: Record<string, unknown>[] | undefined,
): AdsetTargetingRow[] {
  if (!adsets?.length) return [];
  return adsets.slice(0, 40).map((a) => {
    const targeting = a.targeting;
    const geo = targeting && typeof targeting === "object"
      ? (targeting as Record<string, unknown>).geo_locations
      : null;
    const geoKeys: string[] = [];
    if (geo && typeof geo === "object") {
      for (const k of ["countries", "regions", "cities"]) {
        const arr = (geo as Record<string, unknown>)[k];
        if (Array.isArray(arr)) geoKeys.push(...arr.map(String));
      }
    }
    return {
      adset_id: String(a.id ?? ""),
      campaign_id: String(a.campaign_id ?? ""),
      name: String(a.name ?? "").slice(0, 80),
      custom_audience_ids: collectIds(targeting, "custom_audiences"),
      geo_keys: geoKeys.slice(0, 5),
    };
  });
}

/** Mesmo saved_audience_id em 2+ ad sets da mesma campanha (evidência de overlap de targeting). */
export function findDuplicateAudienceTargeting(
  rows: AdsetTargetingRow[],
): { campaign_id: string; audience_id: string; adset_ids: string[] }[] {
  const byCampAud = new Map<string, Set<string>>();
  const adsetsByKey = new Map<string, string[]>();

  for (const r of rows) {
    if (!r.campaign_id) continue;
    for (const aud of r.custom_audience_ids) {
      const key = `${r.campaign_id}:${aud}`;
      const set = byCampAud.get(key) ?? new Set();
      set.add(r.adset_id);
      byCampAud.set(key, set);
      const list = adsetsByKey.get(key) ?? [];
      if (r.adset_id) list.push(r.adset_id);
      adsetsByKey.set(key, list);
    }
  }

  const dupes: { campaign_id: string; audience_id: string; adset_ids: string[] }[] = [];
  for (const [key, set] of byCampAud) {
    if (set.size < 2) continue;
    const [campaign_id, audience_id] = key.split(":");
    dupes.push({
      campaign_id,
      audience_id,
      adset_ids: [...set],
    });
  }
  return dupes.slice(0, 3);
}
