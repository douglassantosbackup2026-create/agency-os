import { useCallback, useState } from "react";
import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";

export function useDiagnosisCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await invokeDiagnosisFunction("create-diagnosis-checkout", {
        method: "POST",
        body: "{}",
      });
      const j = (await res.json()) as {
        init_point?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Erro ao criar checkout");
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
