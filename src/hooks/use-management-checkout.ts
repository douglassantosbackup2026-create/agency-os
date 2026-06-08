import { useCallback, useState } from "react";
import { callDiagnosisApi } from "@/lib/diagnosis-api";

type Args = {
  diagnosisId: string;
  secretSlug: string;
  business_name: string;
  website: string;
  instagram: string;
};

/** @deprecated Preferir `/gestao-checkout` + `start-management-payment` (checkout transparente). */
export function useManagementCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = useCallback(async (payload: Args) => {
    setError(null);
    setLoading(true);
    try {
      const j = await callDiagnosisApi<{ init_point?: string }>(
        "create-management-checkout",
        {
          method: "POST",
          body: JSON.stringify({
            diagnosis_id: payload.diagnosisId,
            secret_slug: payload.secretSlug,
            business_name: payload.business_name,
            website: payload.website,
            instagram: payload.instagram,
          }),
        },
      );
      if (!j.init_point) throw new Error("Sem link de pagamento");
      window.location.href = j.init_point;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  return { checkout, loading, error };
}
