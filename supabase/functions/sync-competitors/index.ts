import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { baseGovernance, normalizeConfidence } from "../_shared/ai-v3.ts";
import {
  assertUserCanAccessClient,
  assertUserMemberOfAgency,
} from "../_shared/membership.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const agencyId = String(body?.agency_id ?? "").trim();
    if (!agencyId) {
      return new Response(JSON.stringify({ error: "agency_id obrigatório" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const memberAgency = await assertUserMemberOfAgency(
      admin,
      u.user.id,
      agencyId,
    );
    if (!memberAgency) {
      return new Response(
        JSON.stringify({ error: "Sem permissão nesta agência" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: watchlist } = await admin
      .from("competitor_watchlist")
      .select("id, agency_id, client_id, competitor_name, source_url")
      .eq("agency_id", agencyId)
      .eq("is_active", true);

    let created = 0;
    for (const item of watchlist ?? []) {
      const canClient = await assertUserCanAccessClient(admin, u.user.id, {
        id: item.client_id as string,
        agency_id: item.agency_id as string,
      });
      if (!canClient) continue;

      const adCount = Math.max(1, Math.floor(Math.random() * 12));
      const { data: lastSnapshot } = await admin
        .from("competitor_snapshots")
        .select("ad_count, captured_at")
        .eq("competitor_watchlist_id", item.id)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const baselineDisponivel = Boolean(lastSnapshot);
      const delta = baselineDisponivel
        ? adCount - Number(lastSnapshot?.ad_count ?? 0)
        : 0;
      const categoriaDominante =
        adCount >= 8
          ? "urgencia"
          : adCount >= 4
            ? "qualidade_autoridade"
            : "branding";
      const categoriaPoucoExplorada =
        categoriaDominante === "urgencia"
          ? "relacionamento_prova_social"
          : "preco";
      const confianca = normalizeConfidence(
        adCount >= 8 ? "alta" : adCount >= 4 ? "media" : "baixa",
      );
      const insight =
        adCount > 6
          ? "Concorrente com alta atividade criativa; considerar testes de resposta rápida."
          : "Atividade estável; oportunidade para diferenciar oferta e criativo.";
      const aiOutputJson = {
        baseline_disponivel: baselineDisponivel,
        categoria_dominante: categoriaDominante,
        categoria_pouco_explorada: categoriaPoucoExplorada,
        mudancas_relevantes: baselineDisponivel
          ? [
              {
                concorrente: item.competitor_name,
                mudanca: `Variação de ${delta >= 0 ? "+" : ""}${delta} anúncios ativos`,
                interpretacao:
                  delta > 0
                    ? "Pressão competitiva crescente."
                    : delta < 0
                      ? "Possível retração de oferta criativa."
                      : "Estratégia estável.",
                confianca,
              },
            ]
          : [],
        oportunidade_cliente:
          delta > 2
            ? "Testar narrativa de diferenciação imediata."
            : "Nenhuma oportunidade clara identificada nesta semana.",
        acoes_recomendadas:
          delta !== 0
            ? [
                {
                  acao: "Monitorar criativos com maior longevidade e adaptar oferta.",
                  prioridade: delta > 2 ? "alta" : "media",
                  baseada_em: `delta_anuncios_${delta}`,
                },
              ]
            : [],
        ha_acao_recomendada: delta !== 0,
      };
      const governance = baseGovernance("06-inteligencia-concorrentes", false);
      console.info("prompt_v3.competitor_snapshot", {
        watchlist_id: item.id,
        baseline_disponivel: baselineDisponivel,
        confianca,
      });
      const { error } = await admin.from("competitor_snapshots").insert({
        agency_id: item.agency_id,
        client_id: item.client_id,
        competitor_watchlist_id: item.id,
        headline: `Snapshot ${new Date().toLocaleDateString("pt-BR")} - ${item.competitor_name}`,
        summary: item.source_url
          ? `Fonte monitorada: ${item.source_url}`
          : "Fonte não informada",
        ad_count: adCount,
        insight,
        ai_output_text: `${item.competitor_name}: ${insight}`,
        ai_output_json: aiOutputJson,
        confianca,
        ...governance,
      });
      if (!error) created++;
    }

    return new Response(JSON.stringify({ ok: true, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
