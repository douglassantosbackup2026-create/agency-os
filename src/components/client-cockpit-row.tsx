import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { RiskDot } from "@/components/operational-ui";
import { syncLabelForCockpit } from "@/lib/sync-freshness";

export type ClientCockpitRowProps = {
  clientId: string;
  clientName: string;
  layout: "mobile" | "desktop";
  healthRisk?: string;
  healthScore?: number;
  openN: number;
  syncRunStatus?: string;
  syncCreatedAt?: string;
  auditDate?: string;
};

function ClientCockpitRowInner({
  clientId,
  clientName,
  layout,
  healthRisk,
  healthScore,
  openN,
  syncRunStatus,
  syncCreatedAt,
  auditDate,
}: ClientCockpitRowProps) {
  const syncUi = syncLabelForCockpit(syncRunStatus, syncCreatedAt);

  const integrationsLink = (
    <Link
      to="/integrations"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="text-primary underline-offset-2 hover:underline"
    >
      Integrações
    </Link>
  );

  if (layout === "mobile") {
    return (
      <Link
        to="/clients/$clientId"
        params={{ clientId }}
        className="surface-card block rounded-xl border border-border p-4 text-sm shadow-sm transition hover:bg-surface-2"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold">{clientName}</span>
          {healthRisk != null && healthScore != null ? (
            <span className="flex items-center gap-2 font-mono text-xs tabular">
              <RiskDot risk={healthRisk} />
              {healthScore}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <div className="font-medium text-foreground">Ações</div>
            <div className="font-mono tabular">{openN}</div>
          </div>
          <div>
            <div className="font-medium text-foreground">Sync</div>
            <div className={`tabular ${syncUi.toneClass}`}>
              {syncUi.primaryLine}
            </div>
            <div className="mt-1">{integrationsLink}</div>
          </div>
          <div className="col-span-2">
            <div className="font-medium text-foreground">Auditoria IA</div>
            <div className="tabular">{auditDate ?? "—"}</div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/clients/$clientId"
      params={{ clientId }}
      className="grid min-w-[760px] grid-cols-12 gap-2 border-b border-border px-4 py-2.5 text-sm last:border-0 hover:bg-surface-2"
    >
      <div className="col-span-3 truncate font-medium">{clientName}</div>
      <div className="col-span-2 flex items-center gap-2">
        {healthRisk != null && healthScore != null ? (
          <>
            <RiskDot risk={healthRisk} />
            <span className="font-mono tabular text-xs">{healthScore}</span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <div className="col-span-2 text-center font-mono tabular text-xs">
        {openN}
      </div>
      <div className={`col-span-3 text-xs ${syncUi.toneClass}`}>
        <div className="font-medium">{syncUi.primaryLine}</div>
        {syncCreatedAt && (
          <span className="block text-[11px] text-muted-foreground">
            {syncCreatedAt.slice(0, 19).replace("T", " ")}
          </span>
        )}
        <div className="mt-1">{integrationsLink}</div>
      </div>
      <div className="col-span-2 text-xs text-muted-foreground">
        {auditDate ?? "—"}
      </div>
    </Link>
  );
}

export const ClientCockpitRow = memo(ClientCockpitRowInner);
ClientCockpitRow.displayName = "ClientCockpitRow";
