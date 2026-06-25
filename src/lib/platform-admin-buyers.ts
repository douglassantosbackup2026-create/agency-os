export type DiagnosisBuyerRow = {
  id: string;
  created_at: string;
  status: string;
  secret_slug: string;
  payer_name: string | null;
  payer_email: string | null;
  payer_phone: string | null;
  payer_cpf: string | null;
  payment_method: string | null;
  amount_cents: number | null;
  management_status: string | null;
  management_paid_at: string | null;
  completed_at: string | null;
};

export type ManagementSubscriberRow = {
  diagnosis_id: string;
  subscription_id: string | null;
  management_paid_at: string | null;
  payer_name: string | null;
  payer_email: string | null;
  payer_phone: string | null;
  payer_cpf: string | null;
  business_name: string | null;
  website: string | null;
  instagram: string | null;
  amount_cents: number | null;
  card_last4: string | null;
  sub_status: string | null;
  next_payment_date: string | null;
  last_charge_at: string | null;
  last_charge_status: string | null;
  cancelled_at: string | null;
  mp_preapproval_id: string | null;
  payment_method: string | null;
  onboarding_status: string | null;
  whatsapp_clicked_at: string | null;
  client_id: string | null;
};

export type ManagementKpis = {
  active_count: number;
  mrr_cents: number;
  new_this_month: number;
  cancelled_this_month: number;
};

export function centsToBrl(cents: number | null | undefined): string {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return phone;
}

export function whatsappLink(
  phone: string | null | undefined,
  message?: string,
): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11) d = "55" + d;
  const base = `https://wa.me/${d}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function subscriptionStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "authorized":
      return "Ativa";
    case "paused":
      return "Pausada";
    case "cancelled":
      return "Cancelada";
    case "pending":
      return "Pendente";
    case "pix_paid":
      return "PIX (mensal)";
    case "unknown":
      return "—";
    default:
      return status ?? "—";
  }
}

export function subscriptionStatusTone(
  status: string | null | undefined,
): "ok" | "warn" | "bad" | "muted" {
  switch (status) {
    case "authorized":
      return "ok";
    case "paused":
    case "pending":
      return "warn";
    case "pix_paid":
      return "ok";
    case "cancelled":
      return "bad";
    default:
      return "muted";
  }
}
