import { Users } from "lucide-react";
import { AgencyClientSelect } from "@/components/agency-client-select";
import { useAgencyClientsOptions } from "@/hooks/use-agency-clients-options";
import { useAuth } from "@/hooks/use-auth";
import { useOperationClientScope } from "@/hooks/use-operation-client-scope";
import { FILTER_SELECT_TRIGGER_CLASSES } from "@/lib/ui/filter-classes";

/** Filtro global de cliente para Alertas, Ações e Feed (persistido em localStorage). */
export function OperationScopeSelect() {
  const { agency } = useAuth();
  const { clientId, setClientId } = useOperationClientScope();
  const { data: clients = [], isLoading } = useAgencyClientsOptions(agency?.id);

  if (!agency) return null;

  return (
    <div className="hidden max-w-[220px] items-center gap-1.5 md:flex">
      <Users
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <AgencyClientSelect
        clients={clients}
        value={clientId ?? "all"}
        onValueChange={(v) => setClientId(v === "all" ? null : v)}
        placeholder="Carteira"
        allLabel="Todos os clientes"
        triggerClassName={`${FILTER_SELECT_TRIGGER_CLASSES.barClient} text-xs`}
      />
      {isLoading && clients.length === 0 ? (
        <span className="sr-only">A carregar clientes…</span>
      ) : null}
    </div>
  );
}
