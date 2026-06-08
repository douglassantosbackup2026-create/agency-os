import { useEffect, useState } from "react";
import { reportFunnelError } from "@/lib/report-error";

export interface MpInstance {
  createCardToken: (data: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType: string;
    identificationNumber: string;
  }) => Promise<{ id: string; first_six_digits?: string }>;
  getPaymentMethods: (opts: {
    bin: string;
  }) => Promise<{ results: Array<{ id: string; payment_type_id: string }> }>;
  getIssuers: (opts: {
    paymentMethodId: string;
    bin: string;
  }) => Promise<Array<{ id: string }>>;
}

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      opts?: { locale?: string },
    ) => MpInstance;
  }
}

export function useMercadoPago(
  publicKey: string | null,
  errorContext = "checkout.mp_sdk_failed",
): {
  mp: MpInstance | null;
  sdkError: string | null;
} {
  const [mp, setMp] = useState<MpInstance | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey || typeof window === "undefined") return;

    setSdkError(null);
    setMp(null);

    let timeoutId = 0;
    let cancelled = false;

    const failSdk = (message: string) => {
      if (cancelled) return;
      setSdkError(message);
      reportFunnelError(errorContext, message);
    };

    const init = () => {
      if (cancelled || !window.MercadoPago) return;
      setMp(new window.MercadoPago(publicKey, { locale: "pt-BR" }));
      if (timeoutId) window.clearTimeout(timeoutId);
    };

    timeoutId = window.setTimeout(() => {
      setMp((current) => {
        if (!current) {
          failSdk(
            "Não foi possível carregar o Mercado Pago. Recarregue a página ou tente outro navegador.",
          );
        }
        return current;
      });
    }, 15_000);

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-mp-sdk="v2"]',
    );
    if (existing) {
      if (window.MercadoPago) init();
      else {
        existing.addEventListener("load", init, { once: true });
        existing.addEventListener(
          "error",
          () =>
            failSdk(
              "Falha ao carregar o script do Mercado Pago. Verifique a ligação e recarregue a página.",
            ),
          { once: true },
        );
      }
      return () => {
        cancelled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
      };
    }

    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.async = true;
    s.dataset.mpSdk = "v2";
    s.addEventListener("load", init, { once: true });
    s.addEventListener(
      "error",
      () =>
        failSdk(
          "Falha ao carregar o script do Mercado Pago. Verifique a ligação e recarregue a página.",
        ),
      { once: true },
    );
    document.head.appendChild(s);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [publicKey, errorContext]);

  return { mp, sdkError };
}
