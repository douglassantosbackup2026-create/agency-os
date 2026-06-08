// Ações operacionais do funil Diagnóstico Meta. Só platform admin.
import { z } from "https://esm.sh/zod@3.23.8";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import { assertPlatformAdmin } from "../_shared/assert-platform-admin.ts";
import { triggerProcessDiagnosis } from "../_shared/diagnosis/trigger-process-diagnosis.ts";
import { distributedRateLimitExceeded } from "../_shared/distributed-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  action: z.enum(["retry_ai", "reprocess", "cleanup_stale"]),
  diagnosis_id: z.string().uuid().optional(),
  secret_slug: z.string().min(8).max(120).optional(),
  stale_minutes: z.number().int().min(5).max(1440).optional(),
});

const RETRY_COOLDOWN_SEC = 120;

function isMetaTokenFailure(reason: string | null | undefined): boolean {
  return /token meta|reconect/i.test(reason ?? "");
}

function isNonRetryableFailure(reason: string | null | undefined): boolean {
  if (!reason) return false;
  if (isMetaTokenFailure(reason)) return true;
  if (/Orçamento diário de IA/.test(reason)) return true;
  if (/Configuração de IA incompleta/.test(reason)) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const trace = beginEdgeTrace(req, "diagnosis_platform_ops");
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const gate = await assertPlatformAdmin(req.headers.get("Authorization"));
    if (!gate.ok) {
      return new Response(JSON.stringify({ error: gate.message }), {
        status: gate.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimited = await distributedRateLimitExceeded(
      gate.admin,
      `platform-diagnosis-ops:${gate.userId}`,
      10,
      60,
    );
    if (rateLimited) {
      return new Response(
        JSON.stringify({ error: "Muitas ações. Aguarde um minuto." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "payload inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, diagnosis_id, secret_slug, stale_minutes } = parsed.data;
    const sb = gate.admin;

    if (action === "cleanup_stale") {
      const { data, error } = await sb.rpc("cleanup_stale_diagnosis_processing", {
        p_stale_minutes: stale_minutes ?? 30,
      });
      if (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: "Falha na limpeza" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      trace.done({ action, cleaned: data });
      return new Response(JSON.stringify({ ok: true, cleaned: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!diagnosis_id || !secret_slug) {
      return new Response(
        JSON.stringify({ error: "diagnosis_id e secret_slug obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: row, error: fetchErr } = await sb
      .from("diagnoses")
      .select("status, failed_reason, meta_ad_account_id, updated_at")
      .eq("id", diagnosis_id)
      .eq("secret_slug", secret_slug)
      .maybeSingle();

    if (fetchErr) {
      console.error(fetchErr);
      return new Response(JSON.stringify({ error: "Erro interno" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!row) {
      return new Response(JSON.stringify({ error: "não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "retry_ai") {
      if (row.status !== "failed") {
        return new Response(
          JSON.stringify({ error: "Diagnóstico não está em falha" }),
          {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const updatedAt = row.updated_at as string | null;
      if (
        updatedAt &&
        Date.now() - new Date(updatedAt).getTime() < RETRY_COOLDOWN_SEC * 1000
      ) {
        return new Response(
          JSON.stringify({ error: "Aguarde antes de tentar novamente." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (isNonRetryableFailure(row.failed_reason)) {
        const msg = isMetaTokenFailure(row.failed_reason)
          ? "Reconecta a Meta antes de tentar novamente."
          : (row.failed_reason ?? "Não é possível tentar novamente.");
        return new Response(JSON.stringify({ error: msg }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!row.meta_ad_account_id) {
        return new Response(
          JSON.stringify({ error: "Conta Meta não ligada." }),
          {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } else if (action === "reprocess") {
      if (!["failed", "processing"].includes(String(row.status))) {
        return new Response(
          JSON.stringify({
            error: "Só é possível reprocessar em falha ou processamento.",
          }),
          {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const { error: eUp } = await sb
      .from("diagnoses")
      .update({
        status: "processing",
        failed_reason: null,
      })
      .eq("id", diagnosis_id)
      .eq("secret_slug", secret_slug);

    if (eUp) {
      console.error(eUp);
      return new Response(JSON.stringify({ error: "Falha ao reiniciar" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    triggerProcessDiagnosis(`diagnosis-platform-ops:${action}`);
    trace.done({ action, diagnosis_id });
    return new Response(JSON.stringify({ ok: true, status: "processing" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    trace.fail(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
