// OAuth start URL + exchange code → integrations row (Meta, Google family, TikTok).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Provider = "meta_ads" | "google_ads" | "google_analytics" | "tiktok_ads";

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signState(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const json = JSON.stringify(payload);
  const b64 = btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sig = await hmacSign(b64, secret);
  return `${b64}.${sig}`;
}

async function verifyState(
  state: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const i = state.lastIndexOf(".");
  if (i < 0) return null;
  const b64 = state.slice(0, i);
  const sig = state.slice(i + 1);
  const expect = await hmacSign(b64, secret);
  if (sig !== expect) return null;
  const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as Record<string, unknown>;
}

function siteUrl(): string {
  return (
    Deno.env.get("PUBLIC_SITE_URL") ??
    Deno.env.get("SITE_URL") ??
    "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function redirectUri(): string {
  return `${siteUrl()}/integrations/oauth/callback`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  try {
    const stateSecret = Deno.env.get("INTEGRATION_OAUTH_STATE_SECRET");
    if (!stateSecret || stateSecret.length < 16) {
      return new Response(
        JSON.stringify({
          error:
            "Defina INTEGRATION_OAUTH_STATE_SECRET (min. 16 chars) nas secrets.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u.user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("agency_id")
      .eq("id", u.user.id)
      .maybeSingle();
    if (!profile?.agency_id)
      return new Response(JSON.stringify({ error: "no agency" }), {
        status: 400,
        headers: corsHeaders,
      });

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;
    const provider = body?.provider as Provider;

    if (action === "start") {
      if (
        !provider ||
        !["meta_ads", "google_ads", "google_analytics", "tiktok_ads"].includes(
          provider,
        )
      ) {
        return new Response(JSON.stringify({ error: "invalid provider" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const state = await signState(
        {
          agency_id: profile.agency_id,
          provider,
          user_id: u.user.id,
          exp: Date.now() + 900_000,
        },
        stateSecret,
      );

      const redir = encodeURIComponent(redirectUri());

      let url = "";
      if (provider === "meta_ads") {
        const appId = Deno.env.get("META_APP_ID");
        if (!appId)
          return new Response(
            JSON.stringify({ error: "META_APP_ID não configurado" }),
            {
              status: 503,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        url =
          `https://www.facebook.com/v21.0/dialog/oauth?client_id=${encodeURIComponent(appId)}` +
          `&redirect_uri=${redir}&state=${encodeURIComponent(state)}` +
          `&scope=${encodeURIComponent("ads_read")}&response_type=code`;
      } else if (provider === "google_ads" || provider === "google_analytics") {
        const cid = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
        if (!cid)
          return new Response(
            JSON.stringify({
              error: "GOOGLE_OAUTH_CLIENT_ID não configurado",
            }),
            {
              status: 503,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        const scope =
          provider === "google_analytics"
            ? "https://www.googleapis.com/auth/analytics.readonly"
            : "https://www.googleapis.com/auth/adwords";
        url =
          `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(cid)}` +
          `&redirect_uri=${redir}&response_type=code&access_type=offline&prompt=consent` +
          `&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
      } else if (provider === "tiktok_ads") {
        const ck =
          Deno.env.get("TIKTOK_CLIENT_KEY") ?? Deno.env.get("TIKTOK_APP_ID");
        if (!ck)
          return new Response(
            JSON.stringify({
              error: "TIKTOK_CLIENT_KEY (ou TIKTOK_APP_ID) não configurado",
            }),
            {
              status: 503,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        url =
          `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(ck)}` +
          `&scope=${encodeURIComponent("advertiser.read,business_center.read")}` +
          `&response_type=code&redirect_uri=${redir}&state=${encodeURIComponent(state)}`;
      }

      return new Response(JSON.stringify({ url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "exchange") {
      const code = body?.code as string;
      const stateRaw = body?.state as string;
      if (!code || !stateRaw)
        return new Response(
          JSON.stringify({ error: "code e state obrigatórios" }),
          {
            status: 400,
            headers: corsHeaders,
          },
        );

      const st = await verifyState(stateRaw, stateSecret);
      if (!st || typeof st.user_id !== "string" || st.user_id !== u.user.id) {
        return new Response(JSON.stringify({ error: "state inválido" }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      if (typeof st.exp !== "number" || Date.now() > st.exp) {
        return new Response(JSON.stringify({ error: "state expirado" }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const agencyId = st.agency_id as string;
      const prov = st.provider as Provider;
      if (agencyId !== profile.agency_id) {
        return new Response(
          JSON.stringify({ error: "agência inconsistente" }),
          {
            status: 403,
            headers: corsHeaders,
          },
        );
      }

      const redir = redirectUri();
      let access_token = "";
      let refresh_token: string | null = null;
      let expires_in = 3600;

      if (prov === "meta_ads") {
        const appId = Deno.env.get("META_APP_ID")!;
        const appSecret = Deno.env.get("META_APP_SECRET")!;
        const tokUrl =
          `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${encodeURIComponent(appId)}` +
          `&redirect_uri=${encodeURIComponent(redir)}` +
          `&client_secret=${encodeURIComponent(appSecret)}` +
          `&code=${encodeURIComponent(code)}`;
        const tr = await fetch(tokUrl);
        const tj = await tr.json();
        if (!tr.ok) {
          return new Response(
            JSON.stringify({
              error: tj?.error?.message ?? JSON.stringify(tj).slice(0, 400),
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        access_token = String(tj.access_token ?? "");
        expires_in = Number(tj.expires_in ?? 5184000);
        const llUrl =
          `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token` +
          `&client_id=${encodeURIComponent(appId)}` +
          `&client_secret=${encodeURIComponent(appSecret)}` +
          `&fb_exchange_token=${encodeURIComponent(access_token)}`;
        const lr = await fetch(llUrl);
        const lj = await lr.json();
        if (lr.ok && lj.access_token) {
          access_token = String(lj.access_token);
          expires_in = Number(lj.expires_in ?? expires_in);
        }
      } else if (prov === "google_ads" || prov === "google_analytics") {
        const cid = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
        const csec = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
        const tr = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: cid,
            client_secret: csec,
            redirect_uri: redir,
            grant_type: "authorization_code",
          }),
        });
        const tj = await tr.json();
        if (!tr.ok) {
          return new Response(
            JSON.stringify({
              error: tj?.error_description ?? tj?.error ?? JSON.stringify(tj),
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        access_token = String(tj.access_token ?? "");
        refresh_token = tj.refresh_token ? String(tj.refresh_token) : null;
        expires_in = Number(tj.expires_in ?? 3600);
      } else if (prov === "tiktok_ads") {
        const appId =
          Deno.env.get("TIKTOK_APP_ID") ?? Deno.env.get("TIKTOK_CLIENT_KEY")!;
        const cs =
          Deno.env.get("TIKTOK_APP_SECRET") ??
          Deno.env.get("TIKTOK_CLIENT_SECRET")!;
        const tr = await fetch(
          "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              app_id: appId,
              secret: cs,
              auth_code: code,
            }),
          },
        );
        const tj = await tr.json();
        const d = tj?.data;
        if (!tr.ok || !d?.access_token) {
          return new Response(
            JSON.stringify({
              error: tj?.message ?? JSON.stringify(tj).slice(0, 400),
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        access_token = String(d.access_token);
        refresh_token = d.refresh_token ? String(d.refresh_token) : null;
        expires_in = Number(d.expires_in ?? 86400);
      }

      if (!access_token) {
        return new Response(JSON.stringify({ error: "token vazio" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

      const { data: existing } = await admin
        .from("integrations")
        .select("id")
        .eq("agency_id", agencyId)
        .eq("provider", prov)
        .maybeSingle();

      const row = {
        agency_id: agencyId,
        provider: prov,
        status: "connected" as const,
        api_key_encrypted: access_token,
        refresh_token_encrypted: refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        const { error } = await admin
          .from("integrations")
          .update(row)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await admin.from("integrations").insert(row);
        if (error) throw error;
      }

      return new Response(JSON.stringify({ ok: true, provider: prov }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
