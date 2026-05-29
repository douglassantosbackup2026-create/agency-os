import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import { BodyTooLargeError, readJsonBody } from "../_shared/edge-json-body.ts";
import { portalClientIp, portalRateLimitExceeded } from "../_shared/portal-rate-limit.ts";
import {
  portalReviewSecret,
  verifyPortalReviewToken,
} from "../_shared/portal-review-token.ts";

const MAX_SLUG_LEN = 160;

// Portal é endpoint público para clientes finais — mantém CORS aberto
// (pode ser embutido em domínios diversos). Validação rigorosa de body.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ReviewBody = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(MAX_SLUG_LEN)
    .regex(/^[a-z0-9_-]+$/i, "slug inválido"),
  creative_id: z.string().trim().uuid(),
  decision: z.enum(["approved", "rejected"]),
  review_token: z.string().trim().min(16).max(512),
  feedback: z.string().trim().max(2000).optional().nullable(),
  reviewer_name: z.string().trim().min(1).max(120).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const trace = beginEdgeTrace(req, "portal_creative_review");
  try {
    let rawBody: Record<string, unknown>;
    try {
      rawBody = await readJsonBody(req);
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return new Response(
          JSON.stringify({ error: "payload demasiado grande" }),
          {
            status: 413,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      rawBody = {};
    }
    const parsed = ReviewBody.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "payload inválido",
          details: parsed.error.flatten(),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const {
      slug,
      creative_id: creativeId,
      decision,
      review_token: reviewToken,
      feedback = null,
      reviewer_name: reviewerName = "Cliente",
    } = parsed.data;



    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const ip = portalClientIp(req);
    const rateKey = `portal-review:${ip}:${slug}:${creativeId}`;
    if (await portalRateLimitExceeded(admin, rateKey)) {
      return new Response(JSON.stringify({ error: "too_many_requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reviewSecret = portalReviewSecret();
    if (!reviewSecret) {
      return new Response(JSON.stringify({ error: "portal_review_disabled" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: client } = await admin
      .from("clients")
      .select("id, agency_id, portal_slug")
      .eq("portal_slug", slug)
      .maybeSingle();
    if (!client) {
      return new Response(JSON.stringify({ error: "portal não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenOk = await verifyPortalReviewToken(
      reviewToken,
      client.id as string,
      client.portal_slug as string,
      reviewSecret,
    );
    if (!tokenOk) {
      return new Response(JSON.stringify({ error: "review_token inválido" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creative } = await admin
      .from("creative_assets")
      .select("id, agency_id, client_id, status")
      .eq("id", creativeId)
      .maybeSingle();
    if (!creative || creative.client_id !== client.id) {
      return new Response(JSON.stringify({ error: "criativo inválido" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upErr } = await admin
      .from("creative_assets")
      .update({
        status: decision,
        updated_at: new Date().toISOString(),
      })
      .eq("id", creative.id);
    if (upErr) throw upErr;

    const { error: revErr } = await admin.from("creative_reviews").insert({
      agency_id: client.agency_id,
      creative_asset_id: creative.id,
      decision,
      feedback,
      reviewer_name: reviewerName,
      source: "portal",
    });
    if (revErr) throw revErr;

    trace.done({ decision });
    return new Response(JSON.stringify({ ok: true, decision }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    trace.fail(e);
    console.error("[portal-creative-review]", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
