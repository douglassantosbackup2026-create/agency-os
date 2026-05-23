import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export function useDiagnosisCheckout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await navigate({ to: "/checkout" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  return { checkout, loading, error };
}
