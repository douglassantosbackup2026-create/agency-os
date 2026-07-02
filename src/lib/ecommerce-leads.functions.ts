import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  phone: z.string().trim().min(8, "WhatsApp inválido").max(40),
  storeName: z.string().trim().min(2, "Nome da loja é obrigatório").max(120),
  website: z.string().trim().min(2, "Site/Instagram é obrigatório").max(255),
  monthlyAdBudgetRange: z.enum(["<5k", "5k-15k", "15k-50k", ">50k"], {
    message: "Selecione o investimento mensal",
  }),
  challenge: z.string().trim().max(1000).optional(),
  source: z.string().trim().max(100).default("meta_ads"),
  utmSource: z.string().trim().max(200).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
  utmAdset: z.string().trim().max(200).optional(),
  utmAd: z.string().trim().max(200).optional(),
});

export type SubmitEcommerceLeadInput = z.infer<typeof leadSchema>;

function createServerSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server config missing");
  }
  return createClient<Database>(url, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const submitEcommerceLead = createServerFn({ method: "POST" })
  .inputValidator((data) => leadSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = createServerSupabaseClient();
    const leadId = crypto.randomUUID();
    const accessSlug = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase
      .from("ecommerce_leads")
      .insert({
        id: leadId,
        access_slug: accessSlug,
        name: data.name,
        email: data.email,
        phone: data.phone,
        store_name: data.storeName,
        website: data.website,
        monthly_ad_budget_range: data.monthlyAdBudgetRange,
        challenge: data.challenge ?? null,
        source: data.source,
        utm_source: data.utmSource ?? null,
        utm_campaign: data.utmCampaign ?? null,
        utm_adset: data.utmAdset ?? null,
        utm_ad: data.utmAd ?? null,
      });

    if (error) {
      console.error("submitEcommerceLead insert error:", error);
      throw new Error("Falha ao salvar lead. Tente novamente.");
    }

    return { success: true as const, leadId, accessSlug };
  });
