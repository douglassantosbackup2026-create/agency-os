import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { submitEcommerceLead } from "@/lib/ecommerce-leads.functions";
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
  | { stage: "success"; leadId: string }
  | { stage: "error"; message: string };

export function useEcommerceLeadSubmit(utm: {
  source: string;
  campaign: string;
  adset: string;
  ad: string;
}) {
  const [status, setStatus] = useState<SubmitStatus>({ stage: "idle" });
  const submit = useServerFn(submitEcommerceLead);

  const handleSubmit = useCallback(
    async (data: LeadFormData) => {
      setStatus({ stage: "loading" });
      try {
        const parsed = localSchema.parse(data);
        const result = await submit({
          data: {
            name: parsed.name,
            email: parsed.email,
            phone: parsed.phone,
            storeName: parsed.storeName,
            website: parsed.website,
            monthlyAdBudgetRange: parsed.monthlyAdBudgetRange,
            challenge: parsed.challenge,
            source: "meta_ads",
            utmSource: utm.source,
            utmCampaign: utm.campaign,
            utmAdset: utm.adset,
            utmAd: utm.ad,
          },
        });

        const dedupId = result.leadId;
        trackMetaLead(GESTAO_PRODUCT, dedupId, { lead_id: dedupId });
        trackMetaCompleteRegistration("Gestão E-commerce Lead", { lead_id: dedupId }, dedupId);

        setStatus({ stage: "success", leadId: result.leadId });
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
    [submit, utm],
  );

  return { status, submit: handleSubmit, reset: () => setStatus({ stage: "idle" }) };
}
