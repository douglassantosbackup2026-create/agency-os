export type ManagementOnboardingQueueRow = {
  diagnosis_id: string;
  secret_slug: string;
  business_name: string | null;
  payer_name: string | null;
  payer_email: string | null;
  payer_phone: string | null;
  management_paid_at: string | null;
  management_payment_method: string | null;
  onboarding_status: string;
  whatsapp_clicked_at: string | null;
  form_submitted_at: string | null;
  monthly_ad_budget: number | null;
  roas_goal: string | null;
  client_id: string | null;
  client_portal_slug: string | null;
  checklist_done: number;
  checklist_total: number;
  meta_ad_account_id: string | null;
};

export type OnboardingSlaTone = "ok" | "warn" | "bad";

export function onboardingSlaTone(
  paidAt: string | null | undefined,
): OnboardingSlaTone {
  if (!paidAt) return "bad";
  const hours = (Date.now() - new Date(paidAt).getTime()) / 3_600_000;
  if (hours < 12) return "ok";
  if (hours < 24) return "warn";
  return "bad";
}

export function onboardingStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "awaiting_client":
      return "Aguardando cliente";
    case "client_submitted":
      return "Formulário enviado";
    case "provisioned":
      return "Provisionado";
    default:
      return status ?? "—";
  }
}

export const ACCESS_CHECKLIST_OPTIONS = [
  { id: "business_manager", label: "Business Manager / acesso à conta" },
  { id: "catalog", label: "Catálogo de produtos" },
  { id: "shopify", label: "Shopify / e-commerce" },
  { id: "pixel", label: "Pixel Meta / CAPI" },
  { id: "ga4", label: "Google Analytics 4" },
  { id: "other", label: "Outros acessos" },
] as const;
