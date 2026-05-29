import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseDashboardBundle } from "@/lib/dashboard-data";

export const fetchDashboardCore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr || !profile?.agency_id) {
      return null;
    }

    const agencyId = profile.agency_id;
    const { data: detail, error: detailErr } = await supabase.rpc(
      "get_agency_dashboard_detail",
      { p_agency_id: agencyId },
    );

    if (detailErr) {
      throw new Error(detailErr.message);
    }

    return {
      agencyId,
      core: parseDashboardBundle(detail),
    };
  });
