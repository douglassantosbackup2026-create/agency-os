import type { Database } from "@/integrations/supabase/types";
import { isOpenActionCenterStatus } from "@/lib/action-center-status";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
type ActionRow = Database["public"]["Tables"]["action_center"]["Row"];

export type NextStepItem = {
  id: string;
  kind: "action" | "alert" | "report" | "metrics";
  title: string;
  subtitle?: string;
  /** Estimativa conservadora para priorização na UI */
  effortMinutes: number;
  tab:
    | "tasks"
    | "alerts"
    | "reports"
    | "metrics"
    | "overview"
    | "campaign_audit";
  /** Se definido, navega para rota em vez de mudar tab na ficha */
  href?: string;
  priorityScore: number;
};

const EFFORT_BY_ALERT_PRIORITY: Record<string, number> = {
  critical: 15,
  high: 15,
  medium: 10,
  low: 5,
};

const EFFORT_BY_ACTION_PRIORITY: Record<string, number> = {
  critica: 20,
  alta: 15,
  media: 10,
  baixa: 5,
};

function parseDueDate(d: string | null): number {
  if (!d) return 0;
  const t = new Date(d + "T12:00:00").getTime();
  if (Number.isNaN(t)) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return t <= today.getTime() ? 40 : 0;
}

function scoreAction(a: ActionRow): number {
  let s = 10;
  const st = String(a.status ?? "");
  if (st === "pendente") s += 20;
  s += parseDueDate(a.due_date);
  const p = String(a.priority ?? "").toLowerCase();
  if (p === "critica") s += 50;
  else if (p === "alta") s += 35;
  else if (p === "media") s += 20;
  else s += 8;
  return s;
}

function scoreAlert(a: AlertRow): number {
  let s = 5;
  const pr = String(a.priority ?? "");
  if (pr === "critical") s += 45;
  else if (pr === "high") s += 30;
  else if (pr === "medium") s += 15;
  else s += 5;
  if (a.status === "open") s += 10;
  return s;
}

/**
 * Ordena os 2–3 próximos passos sugeridos para um cliente (heurística estática).
 */
export function buildNextStepsQueue(args: {
  actions: ActionRow[];
  alerts: AlertRow[];
  reportsCount: number;
  hasConnectedIntegrationHint?: boolean;
}): NextStepItem[] {
  const openActions = args.actions.filter((a) =>
    isOpenActionCenterStatus(a.status),
  );
  const openAlerts = args.alerts.filter((a) => a.status === "open");

  const actionItems: NextStepItem[] = openActions.map((a) => ({
    id: `action:${a.id}`,
    kind: "action",
    title: String(a.title ?? "Ação na central"),
    subtitle: a.due_date ? `Prazo: ${a.due_date}` : undefined,
    effortMinutes:
      EFFORT_BY_ACTION_PRIORITY[String(a.priority ?? "").toLowerCase()] ?? 10,
    tab: "tasks",
    priorityScore: scoreAction(a),
  }));

  const alertItems: NextStepItem[] = openAlerts.map((a) => ({
    id: `alert:${a.id}`,
    kind: "alert",
    title: String(a.title ?? "Alerta"),
    subtitle: a.recommended_action ?? a.description ?? undefined,
    effortMinutes:
      EFFORT_BY_ALERT_PRIORITY[String(a.priority ?? "")] ?? 10,
    tab: "alerts",
    priorityScore: scoreAlert(a),
  }));

  const extra: NextStepItem[] = [];
  if (args.reportsCount === 0) {
    extra.push({
      id: "report:first",
      kind: "report",
      title: "Gerar primeiro relatório IA",
      subtitle: "Documente valor para o cliente.",
      effortMinutes: 15,
      tab: "reports",
      priorityScore: 25,
    });
  }
  if (args.hasConnectedIntegrationHint === false) {
    extra.push({
      id: "integrations",
      kind: "metrics",
      title: "Ligar integração de dados",
      subtitle: "Sem dados frescos é difícil priorizar bem.",
      effortMinutes: 20,
      tab: "overview",
      href: "/integrations",
      priorityScore: 18,
    });
  }

  const merged = [...actionItems, ...alertItems, ...extra]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3);

  return merged;
}

export function formatEffort(minutes: number): string {
  if (minutes <= 5) return "~5 min";
  if (minutes <= 15) return "~15 min";
  return "~20 min";
}

/** Passo agregado na carteira (vários clientes) para o dashboard. */
export type PortfolioNextStepRow = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  subtitle?: string;
  effortMinutes: number;
  priorityScore: number;
  kind: "action" | "alert";
};

/**
 * Mistura ações e alertas abertos da agência e devolve os melhores passos
 * entre clientes (sem duplicar o mesmo cliente duas vezes na lista curta).
 */
export function buildPortfolioNextSteps(args: {
  actions: Array<
    ActionRow & {
      clients?: { name?: string | null } | null;
    }
  >;
  alerts: Array<
    AlertRow & {
      clients?: { name?: string | null } | null;
    }
  >;
  limit?: number;
}): PortfolioNextStepRow[] {
  const lim = args.limit ?? 6;
  const openActions = args.actions.filter((a) =>
    isOpenActionCenterStatus(a.status),
  );
  const openAlerts = args.alerts.filter((a) => a.status === "open");

  const candidates: PortfolioNextStepRow[] = [];

  for (const a of openActions) {
    const cid = a.client_id ? String(a.client_id) : "";
    if (!cid) continue;
    candidates.push({
      id: `action:${a.id}`,
      clientId: cid,
      clientName: String(a.clients?.name ?? "Cliente"),
      title: String(a.title ?? "Ação"),
      subtitle: a.due_date ? `Prazo ${a.due_date}` : undefined,
      effortMinutes:
        EFFORT_BY_ACTION_PRIORITY[String(a.priority ?? "").toLowerCase()] ?? 10,
      priorityScore: scoreAction(a),
      kind: "action",
    });
  }
  for (const a of openAlerts) {
    const cid = a.client_id ? String(a.client_id) : "";
    if (!cid) continue;
    candidates.push({
      id: `alert:${a.id}`,
      clientId: cid,
      clientName: String(a.clients?.name ?? "Cliente"),
      title: String(a.title ?? "Alerta"),
      subtitle: a.recommended_action ?? a.description ?? undefined,
      effortMinutes:
        EFFORT_BY_ALERT_PRIORITY[String(a.priority ?? "")] ?? 10,
      priorityScore: scoreAlert(a),
      kind: "alert",
    });
  }

  candidates.sort((x, y) => y.priorityScore - x.priorityScore);
  const picked: PortfolioNextStepRow[] = [];
  const seenClient = new Set<string>();
  for (const c of candidates) {
    if (seenClient.has(c.clientId)) continue;
    seenClient.add(c.clientId);
    picked.push(c);
    if (picked.length >= lim) break;
  }
  return picked;
}
