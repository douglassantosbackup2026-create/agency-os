export type RoadmapPlanItem = {
  step: number;
  action: string;
  impact: string;
  eta: string;
};

export type RoadmapBuckets = {
  short: RoadmapPlanItem[];
  mid: RoadmapPlanItem[];
  long: RoadmapPlanItem[];
};

export function buildRoadmapFromActionPlan(
  plan: RoadmapPlanItem[] | undefined,
): RoadmapBuckets {
  const buckets: RoadmapBuckets = { short: [], mid: [], long: [] };
  (plan ?? []).forEach((item) => {
    const eta = (item.eta || "").toLowerCase();
    const m = eta.match(/(\d+)/);
    const n = m ? Number(m[1]) : 0;
    let days = 30;
    if (m) {
      if (/h(ora)?/.test(eta)) days = Math.ceil(n / 24);
      else if (/dia/.test(eta)) days = n;
      else if (/sem/.test(eta)) days = n * 7;
      else if (/m[eê]s/.test(eta)) days = n * 30;
      else if (/trim/.test(eta)) days = n * 90;
      else days = n;
    }
    if (days <= 14) buckets.short.push(item);
    else if (days <= 45) buckets.mid.push(item);
    else buckets.long.push(item);
  });
  return buckets;
}
