export type SubscriptionLimits = {
  max_clients: number;
  max_alerts: number;
  plan: string;
  status: string;
};

export function defaultLimits(): SubscriptionLimits {
  return {
    max_clients: 5,
    max_alerts: 100,
    plan: "free",
    status: "trialing",
  };
}

export function mergeSubscription(
  row: Partial<SubscriptionLimits> | null,
): SubscriptionLimits {
  const d = defaultLimits();
  if (!row) return d;
  return {
    max_clients: row.max_clients ?? d.max_clients,
    max_alerts: row.max_alerts ?? d.max_alerts,
    plan: row.plan ?? d.plan,
    status: row.status ?? d.status,
  };
}

export function canCreateClient(
  currentCount: number,
  sub: SubscriptionLimits | null,
): boolean {
  const m = mergeSubscription(sub);
  return currentCount < m.max_clients;
}

export function isWithinAlertBudget(
  openCount: number,
  sub: SubscriptionLimits | null,
): boolean {
  const m = mergeSubscription(sub);
  return openCount <= m.max_alerts;
}
