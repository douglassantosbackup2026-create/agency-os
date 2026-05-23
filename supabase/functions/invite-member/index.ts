// Admin/owner invites a new member to the agency.
// Creates the auth user (if needed) and assigns a role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { BodyTooLargeError, readJsonBody } from "../_shared/edge-json-body.ts";
import { appCors, appCorsPreflight } from "../_shared/cors-allowlist.ts";

const InviteBody = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

Deno.serve(async (req) => {
  const pre = appCorsPreflight(req);
  if (pre) return pre;
  const corsHeaders = appCors(req);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

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
    const parsed = InviteBody.safeParse(rawBody);
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
    const { email: emailRaw, role } = parsed.data;


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

    const { data: caller } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("agency_id", profile.agency_id)
      .maybeSingle();
    if (!caller || !["owner", "admin"].includes(caller.role)) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Find or invite user
    const { data: existing } = await admin.auth.admin.listUsers();
    let target = existing.users.find(
      (x) => x.email?.toLowerCase() === emailRaw.toLowerCase(),
    );
    if (!target) {
      const { data: invited, error: inviteErr } =
        await admin.auth.admin.inviteUserByEmail(emailRaw);
      if (inviteErr)
        return new Response(JSON.stringify({ error: inviteErr.message }), {
          status: 400,
          headers: corsHeaders,
        });
      target = invited.user;
    }
    if (!target)
      return new Response(JSON.stringify({ error: "could not invite" }), {
        status: 500,
        headers: corsHeaders,
      });

    // Make sure profile points to this agency (overwrite for invited members)
    await admin.from("profiles").upsert(
      {
        id: target.id,
        agency_id: profile.agency_id,
        email: target.email,
        display_name: target.email?.split("@")[0],
      },
      { onConflict: "id" },
    );

    await admin.from("user_roles").upsert(
      {
        user_id: target.id,
        agency_id: profile.agency_id,
        role,
      },
      { onConflict: "user_id,agency_id,role", ignoreDuplicates: true },
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
