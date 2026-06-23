import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Loader2, MessageCircle, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { throwIfSupabaseError, queryErrorMeta } from "@/lib/supabase-result";
import { QueryErrorState } from "@/components/query-error-state";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/operational-ui";
import {
  type DiagnosisBuyerRow,
  centsToBrl,
  formatCpf,
  formatPhoneBR,
  whatsappLink,
} from "@/lib/platform-admin-buyers";

const PAGE_SIZE = 50;

const PERIOD_OPTIONS = [
  { label: "Todo o período", value: "" },
  { label: "Últimos 7 dias", value: "7" },
  { label: "Últimos 30 dias", value: "30" },
  { label: "Últimos 90 dias", value: "90" },
];

function sinceFromPeriod(value: string): string | undefined {
  if (!value) return undefined;
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return undefined;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function siteBase(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function exportCsv(rows: DiagnosisBuyerRow[]): string {
  const header = [
    "criado_em",
    "status",
    "nome",
    "email",
    "telefone",
    "cpf",
    "metodo",
    "valor_brl",
    "gestao",
    "diagnosis_id",
  ];
  const lines = rows.map((r) =>
    [
      r.created_at,
      r.status,
      r.payer_name ?? "",
      r.payer_email ?? "",
      r.payer_phone ?? "",
      r.payer_cpf ?? "",
      r.payment_method ?? "",
      centsToBrl(r.amount_cents),
      r.management_status === "paid" ? "sim" : "nao",
      r.id,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function PlatformDiagnosisBuyers() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [period, setPeriod] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["platform-buyers", search, period, page],
    meta: queryErrorMeta,
    queryFn: async () => {
      const since = sinceFromPeriod(period);
      const res = await supabase.rpc("platform_diagnosis_buyers_list", {
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        p_search: search || null,
        p_since: since ?? null,
      });
      throwIfSupabaseError(res.error, "platform.buyers.list");
      return (res.data ?? []) as DiagnosisBuyerRow[];
    },
  });

  const kpis = useMemo(() => {
    const list = data ?? [];
    const paidCount = list.filter((r) => r.amount_cents && r.amount_cents > 0).length;
    const revenue = list.reduce((acc, r) => acc + (r.amount_cents ?? 0), 0);
    const toMgmt = list.filter((r) => r.management_status === "paid").length;
    const conv = paidCount > 0 ? Math.round((toMgmt / paidCount) * 100) : 0;
    return { paidCount, revenue, toMgmt, conv };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <QueryErrorState
        message={error instanceof Error ? error.message : String(error)}
        onRetry={() => void refetch()}
      />
    );
  }

  const list = data ?? [];
  const base = siteBase();

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <Users className="h-5 w-5" />
          <h2 className="text-xl font-semibold tracking-tight">
            Compradores do Diagnóstico
          </h2>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Todos os pagadores do diagnóstico R$ 37 (one-shot). Dados completos para
          contacto e suporte. Visível apenas a administradores da plataforma.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Na página atual" value={String(list.length)} />
        <Kpi title="Receita (página)" value={centsToBrl(kpis.revenue)} />
        <Kpi title="Viraram gestão (página)" value={String(kpis.toMgmt)} />
        <Kpi title="Conversão (página)" value={`${kpis.conv}%`} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
              setPage(0);
            }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar nome, e-mail ou CPF…"
                className="h-9 w-64 rounded-md border border-border bg-background pl-7 pr-2 text-xs"
              />
            </div>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-xs"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(0);
              }}
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="outline" disabled={isFetching}>
              {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Filtrar"}
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const csv = exportCsv(list);
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `compradores-diagnostico-${Date.now()}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>

        <div className="overflow-x-auto p-4">
          {!list.length ? (
            <p className="text-sm text-muted-foreground">Nenhum comprador encontrado.</p>
          ) : (
            <table className="w-full min-w-[960px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Pago em</th>
                  <th className="pb-2 pr-2 font-medium">Nome</th>
                  <th className="pb-2 pr-2 font-medium">E-mail</th>
                  <th className="pb-2 pr-2 font-medium">Telefone</th>
                  <th className="pb-2 pr-2 font-medium">CPF</th>
                  <th className="pb-2 pr-2 font-medium">Pagamento</th>
                  <th className="pb-2 pr-2 font-medium">Gestão</th>
                  <th className="pb-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const wa = whatsappLink(
                    r.payer_phone,
                    `Olá ${r.payer_name?.split(" ")[0] ?? ""}, aqui é da Retentio sobre o teu diagnóstico Meta.`,
                  );
                  return (
                    <tr key={r.id} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-2 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2 pr-2 font-medium">{r.payer_name ?? "—"}</td>
                      <td className="py-2 pr-2 font-mono text-[11px]">{r.payer_email ?? "—"}</td>
                      <td className="py-2 pr-2 font-mono text-[11px]">
                        {formatPhoneBR(r.payer_phone)}
                      </td>
                      <td className="py-2 pr-2 font-mono text-[11px]">
                        {formatCpf(r.payer_cpf)}
                      </td>
                      <td className="py-2 pr-2">
                        {r.payment_method ?? "—"}{" "}
                        <span className="text-muted-foreground">
                          {centsToBrl(r.amount_cents)}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        {r.management_status === "paid" ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                            Sim
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {base ? (
                            <a
                              href={`${base}/diagnostico/${r.id}?s=${r.secret_slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 hover:bg-muted"
                            >
                              <ExternalLink className="h-3 w-3" />
                              QA
                            </a>
                          ) : null}
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 hover:bg-muted"
                            >
                              <MessageCircle className="h-3 w-3" />
                              WhatsApp
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!list.length || list.length < PAGE_SIZE}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </Card>
    </section>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="p-4 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
