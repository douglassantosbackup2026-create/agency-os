import { useCallback, useState } from "react";
import { z } from "zod";
import { callDiagnosisApi } from "@/lib/diagnosis-api";
import { GESTAO_PRODUCT, trackMetaLead, trackMetaCompleteRegistration } from "@/lib/meta-pixel";
import { reportError } from "@/lib/report-error";

const localSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8),
  storeName: z.string().trim().min(2),
  website: z.string().trim().min(2),
  monthlyAdBudgetRange: z.enum(["<5k", "5k-15k", "15k-50k", ">50k"]),
  challenge: z.string().trim().max(1000).optional(),
  consent: z.boolean().refine((v) => v === true, { message: "Você precisa aceitar o contato" }),
});

export type LeadFormData = z.infer<typeof localSchema>;

export type SubmitStatus =
  | { stage: "idle" }
  | { stage: "loading" }
  | { stage: "success"; leadId: string; accessSlug: string }
  | { stage: "error"; message: string };

export function useEcommerceLeadSubmit(utm: {
  source: string;
  campaign: string;
  adset: string;
  ad: string;
}) {
  const [status, setStatus] = useState<SubmitStatus>({ stage: "idle" });

  const handleSubmit = useCallback(
    async (data: LeadFormData) => {
      if (status.stage === "loading") return;
      setStatus({ stage: "loading" });
      try {
        const parsed = localSchema.parse(data);
        const result = await callDiagnosisApi<{
          lead_id: string;
          access_slug: string;
        }>("submit-ecommerce-lead", {
          method: "POST",
          body: JSON.stringify({
            name: parsed.name,
            email: parsed.email,
            phone: parsed.phone,
            store_name: parsed.storeName,
            website: parsed.website,
            monthly_ad_budget_range: parsed.monthlyAdBudgetRange,
            challenge: parsed.challenge ?? null,
            source: "meta_ads",
            utm_source: utm.source || null,
            utm_campaign: utm.campaign || null,
            utm_adset: utm.adset || null,
            utm_ad: utm.ad || null,
          }),
        });

        const dedupId = result.lead_id;
        trackMetaLead(GESTAO_PRODUCT, dedupId, { lead_id: dedupId });
        trackMetaCompleteRegistration("Gestão E-commerce Lead", { lead_id: dedupId }, dedupId);

        setStatus({
          stage: "success",
          leadId: result.lead_id,
          accessSlug: result.access_slug,
        });
      } catch (err) {
        const message =
          err instanceof z.ZodError
            ? "Preencha todos os campos obrigatórios corretamente."
            : err instanceof Error
              ? err.message
              : "Erro inesperado. Tente novamente.";
        reportError("ecommerce-lead-submit", err);
        setStatus({ stage: "error", message });
      }
    },
    [status.stage, utm],
  );

  return { status, submit: handleSubmit, reset: () => setStatus({ stage: "idle" }) };
}
