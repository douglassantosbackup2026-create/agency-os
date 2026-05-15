import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  mergeSubscription,
  type SubscriptionLimits,
} from "@/lib/subscription-limits";
import { throwIfSupabaseError } from "@/lib/supabase-result";

export function useSubscriptionLimits() {
  const { agency } = useAuth();

  return useQuery({
    queryKey: ["subscription-limits", agency?.id],
    enabled: !!agency,
    queryFn: async () => {
      const [sub, clientsCt, alertsCt] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("*")
          .eq("agency_id", agency!.id)
          .maybeSingle(),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("agency_id", agency!.id),
        supabase
          .from("alerts")
          .select("id", { count: "exact", head: true })
          .eq("agency_id", agency!.id)
          .eq("status", "open"),
      ]);

      throwIfSupabaseError(sub.error, "subscription-limits.subscriptions");
      throwIfSupabaseError(
        clientsCt.error,
        "subscription-limits.clients_count",
      );
      throwIfSupabaseError(alertsCt.error, "subscription-limits.alerts_count");

      const subscription = mergeSubscription(
        sub.data as SubscriptionLimits | null,
      );
      return {
        subscription,
        clientCount: clientsCt.count ?? 0,
        openAlertsCount: alertsCt.count ?? 0,
      };
    },
  });
}
