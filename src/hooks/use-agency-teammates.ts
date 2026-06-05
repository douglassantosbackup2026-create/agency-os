import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwIfSupabaseError } from "@/lib/supabase-result";

export function useAgencyTeammates(agencyId: string | undefined) {
  return useQuery({
    queryKey: ["agency-teammates", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("agency_id", agencyId!)
        .order("display_name");
      throwIfSupabaseError(error, "agency-teammates.profiles");
      return data ?? [];
    },
  });
}
