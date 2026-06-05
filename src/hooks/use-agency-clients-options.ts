import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwIfSupabaseError } from "@/lib/supabase-result";

export function useAgencyClientsOptions(agencyId: string | undefined) {
  return useQuery({
    queryKey: ["agency-client-options", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("agency_id", agencyId!)
        .order("name");
      throwIfSupabaseError(error, "agency-client-options.clients");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}
