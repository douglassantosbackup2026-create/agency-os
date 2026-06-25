import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryErrorMeta, throwIfSupabaseError } from "@/lib/supabase-result";

export function useFunnelAgencyOperator() {
  return useQuery({
    queryKey: ["funnel-agency-operator"],
    meta: queryErrorMeta,
    staleTime: 60_000,
    queryFn: async () => {
      const opRes = await supabase.rpc("auth_is_funnel_agency_operator");
      throwIfSupabaseError(opRes.error, "auth_is_funnel_agency_operator");
      const isOperator = opRes.data === true;
      if (!isOperator) {
        return { isOperator: false, pendingCount: 0 };
      }
      const queueRes = await supabase.rpc("management_onboarding_queue", {
        p_include_provisioned: false,
        p_limit: 50,
      });
      throwIfSupabaseError(queueRes.error, "management_onboarding_queue");
      return {
        isOperator: true,
        pendingCount: (queueRes.data ?? []).length,
      };
    },
  });
}

export function useCanProvisionManagement() {
  return useQuery({
    queryKey: ["can-provision-management"],
    meta: queryErrorMeta,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await supabase.rpc("auth_can_provision_management");
      throwIfSupabaseError(res.error, "auth_can_provision_management");
      return res.data === true;
    },
  });
}
