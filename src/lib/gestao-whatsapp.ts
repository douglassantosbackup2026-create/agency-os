const DEFAULT_PHONE = "5511940485006";

/** Link wa.me para follow-up gestão tráfego (mensagem sempre URL-encoded). */
export function whatsappGestaoHref(message: string): string {
  const base =
    typeof import.meta.env.VITE_GESTAO_WHATSAPP_URL === "string" &&
    import.meta.env.VITE_GESTAO_WHATSAPP_URL.trim()
      ? import.meta.env.VITE_GESTAO_WHATSAPP_URL.trim()
      : typeof import.meta.env.VITE_DIAGNOSIS_WHATSAPP_URL === "string" &&
          import.meta.env.VITE_DIAGNOSIS_WHATSAPP_URL.trim()
        ? import.meta.env.VITE_DIAGNOSIS_WHATSAPP_URL.trim()
        : `https://wa.me/${DEFAULT_PHONE}`;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}text=${encodeURIComponent(message)}`;
}

export function buildGestaoIntroMessage(parts: {
  diagnosisId: string;
  storeName?: string | null;
}): string {
  const id = parts.diagnosisId;
  const name = parts.storeName?.trim();
  if (name) {
    return `Olá! Paguei a gestão de tráfego (diagnóstico ${id}). Loja: ${name}.`;
  }
  return `Olá! Paguei a gestão de tráfego. Diagnóstico: ${id}.`;
}
