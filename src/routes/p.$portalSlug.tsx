import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { brl, num, pct } from "@/lib/format";
import { Sparkles, TrendingUp, Wallet, Target, Heart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/p/$portalSlug")({
  component: PortalPage,
});

function PortalPage() {
  const { portalSlug } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-data?slug=${encodeURIComponent(portalSlug)}`;
        const r = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        let j: Record<string, unknown> = {};
        try {
          j = (await r.json()) as Record<string, unknown>;
        } catch {
          j = {};
        }
        if (cancelled) return;
        if (!r.ok) {
          setError(r.status === 404 ? "not_found" : "unavailable");
          return;
        }
        setData(j);
      } catch {
        if (!cancelled) setError("network");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portalSlug]);

  if (error) {
    const message =
      error === "network"
        ? "Não foi possível carregar o portal. Verifique sua conexão e tente novamente."
        : error === "not_found"
          ? "Este link não está disponível ou o portal foi desativado."
          : "Não foi possível abrir este portal. Confirme o endereço com sua agência.";
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-foreground">
            Portal indisponível
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  if (!data)
    return (
      <div className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-5xl space-y-6 animate-pulse">
          <div className="h-16 rounded-xl bg-muted" />
          <div className="h-8 max-w-md rounded-lg bg-muted" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="h-24 rounded-xl bg-muted" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-40 rounded-xl bg-muted" />
            <div className="h-40 rounded-xl bg-muted" />
          </div>
          <div className="h-32 rounded-xl bg-muted" />
        </div>
      </div>
    );

  const themeColor = data.agency?.primary_color ?? "#7c5cff";
  const totalSpend = data.metrics.reduce(
    (a: number, b: any) => a + Number(b.spend ?? 0),
    0,
  );
  const totalRevenue = data.metrics.reduce(
    (a: number, b: any) => a + Number(b.revenue ?? 0),
    0,
  );
  const totalConv = data.metrics.reduce(
    (a: number, b: any) => a + Number(b.conversions ?? 0),
    0,
  );
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const cpa = totalConv > 0 ? totalSpend / totalConv : 0;
  const siteSessions = (data.ga4_daily ?? []).reduce(
    (a: number, b: any) => a + Number(b.sessions ?? 0),
    0,
  );
  const siteConversions = (data.ga4_daily ?? []).reduce(
    (a: number, b: any) => a + Number(b.conversions ?? 0),
    0,
  );
  const siteRevenue = (data.ga4_daily ?? []).reduce(
    (a: number, b: any) => a + Number(b.revenue ?? 0),
    0,
  );
  const siteCvr = siteSessions > 0 ? siteConversions / siteSessions : 0;
  const siteTicket = siteConversions > 0 ? siteRevenue / siteConversions : 0;
  const nextAction = (data.actions ?? [])[0];

  async function reviewCreative(
    creativeId: string,
    decision: "approved" | "rejected",
  ) {
    setReviewingId(creativeId);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-creative-review`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        slug: portalSlug,
        creative_id: creativeId,
        decision,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setReviewingId(null);
    if (!r.ok) {
      toast.error(
        "Não foi possível registrar sua resposta. Tente novamente em instantes.",
      );
      return;
    }
    setData((prev: any) => ({
      ...prev,
      pending_creatives: (prev?.pending_creatives ?? []).filter(
        (c: any) => c.id !== creativeId,
      ),
    }));
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ ["--primary" as any]: themeColor }}
    >
      <header
        className="border-b border-border"
        style={{
          background: `linear-gradient(135deg, ${themeColor}10, transparent)`,
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            {data.agency?.logo_url ? (
              <img
                src={data.agency.logo_url}
                alt={data.agency.name}
                className="h-9 w-9 rounded-md object-cover"
              />
            ) : (
              <div
                className="grid h-9 w-9 place-items-center rounded-md text-sm font-bold text-white"
                style={{ background: themeColor }}
              >
                {data.agency?.name?.[0]?.toUpperCase() ?? "A"}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold">{data.agency?.name}</div>
              <div className="text-sm text-muted-foreground">
                Painel · {data.client.name}
              </div>
            </div>
          </div>
          {data.health && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5">
              <Heart className="h-3.5 w-3.5" style={{ color: themeColor }} />
              <span className="text-xs font-medium">
                Saúde da operação: {data.health.score}/100
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">
            Olá, {data.client.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resultado do mês, contexto e próximos passos em 4 blocos.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            icon={Wallet}
            label="Investimento"
            value={brl(totalSpend)}
            color={themeColor}
          />
          <Stat
            icon={TrendingUp}
            label="Receita"
            value={brl(totalRevenue)}
            color={themeColor}
          />
          <Stat
            icon={Target}
            label="ROAS"
            value={`${num(roas, 2)}x`}
            color={themeColor}
          />
          <Stat icon={Target} label="CPA" value={brl(cpa)} color={themeColor} />
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Resultado no site</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat
              icon={TrendingUp}
              label="Sessões"
              value={String(Math.round(siteSessions))}
              color={themeColor}
            />
            <Stat
              icon={Target}
              label="Conversões"
              value={String(Math.round(siteConversions))}
              color={themeColor}
            />
            <Stat
              icon={Wallet}
              label="Receita"
              value={brl(siteRevenue)}
              color={themeColor}
            />
            <Stat
              icon={Target}
              label="Taxa conv."
              value={pct(siteCvr * 100)}
              color={themeColor}
            />
            <Stat
              icon={Heart}
              label="Tracking"
              value={String(data.ga4_tracking?.status ?? "n/d")}
              color={themeColor}
            />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Ticket médio: {brl(siteTicket)}{" "}
            {data.ga4_tracking?.notes ? `· ${data.ga4_tracking.notes}` : ""}
          </div>
        </section>

        {data.report && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: themeColor }} />
              <h2 className="text-sm font-semibold">Análise da agência</h2>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {data.report.client_friendly_summary ??
                data.report.executive_summary}
            </p>
            {data.report.next_steps && (
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Próximos passos
                </div>
                <p className="whitespace-pre-line text-sm">
                  {data.report.next_steps}
                </p>
              </div>
            )}
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold">O que estamos fazendo</h2>
          {(data.actions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma ação aberta no momento.
            </p>
          ) : (
            <div className="space-y-2">
              {(data.actions ?? []).slice(0, 4).map((a: any, idx: number) => (
                <div key={idx} className="rounded-md border border-border p-2">
                  <div className="text-xs font-medium">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {a.description || "Sem detalhe"} · prioridade {a.priority}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold">Próximo passo</h2>
          <p className="text-sm leading-relaxed text-foreground/90">
            {nextAction?.description ||
              data.report?.next_steps ||
              "Sem pendências imediatas. Seguimos monitorando e ajustando o plano."}
          </p>
        </section>

        <details className="rounded-xl border border-border bg-card open:bg-card">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-foreground marker:text-muted-foreground">
            Detalhes operacionais (campanhas e criativos)
          </summary>
          <div className="border-t border-border">
            <div className="border-b border-border px-5 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Campanhas ativas
            </div>
            {data.campaigns.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                Nenhuma campanha registrada.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.campaigns.map((c: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.platform} · {c.objective ?? "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium">
                        {brl(c.daily_budget)}/dia
                      </div>
                      <span
                        className={`text-[10px] uppercase ${c.status === "active" ? "text-emerald-500" : "text-muted-foreground"}`}
                      >
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border px-5 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Aprovação de criativos
            </div>
            {(data.pending_creatives ?? []).length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                Sem criativos pendentes.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(data.pending_creatives ?? []).map((item: any) => (
                  <div key={item.id} className="space-y-2 px-5 py-3">
                    <div className="text-sm font-medium">{item.title}</div>
                    {item.description ? (
                      <div className="text-xs text-muted-foreground">
                        {item.description}
                      </div>
                    ) : null}
                    {item.preview_url ? (
                      <a
                        href={item.preview_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Ver preview
                      </a>
                    ) : null}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={reviewingId === item.id}
                        onClick={() => reviewCreative(item.id, "approved")}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        disabled={reviewingId === item.id}
                        onClick={() => reviewCreative(item.id, "rejected")}
                        className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
                      >
                        Reprovar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>

        <footer className="pt-4 text-center text-[11px] text-muted-foreground">
          Powered by {data.agency?.name}
        </footer>
      </main>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" style={{ color }} />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
