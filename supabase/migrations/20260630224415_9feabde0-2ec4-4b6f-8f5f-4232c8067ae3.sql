CREATE TABLE public.ecommerce_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  store_name TEXT NOT NULL,
  website TEXT NOT NULL,
  monthly_ad_budget_range TEXT NOT NULL,
  challenge TEXT,
  source TEXT,
  utm_source TEXT,
  utm_campaign TEXT,
  utm_adset TEXT,
  utm_ad TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT INSERT ON public.ecommerce_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ecommerce_leads TO authenticated;
GRANT ALL ON public.ecommerce_leads TO service_role;

ALTER TABLE public.ecommerce_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leads can be inserted anonymously" ON public.ecommerce_leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated users can insert leads" ON public.ecommerce_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Platform admins can view all leads" ON public.ecommerce_leads FOR SELECT TO authenticated USING (public.auth_is_platform_admin());
CREATE POLICY "Platform admins can update leads" ON public.ecommerce_leads FOR UPDATE TO authenticated USING (public.auth_is_platform_admin()) WITH CHECK (public.auth_is_platform_admin());
CREATE POLICY "Service role can manage leads" ON public.ecommerce_leads FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_ecommerce_leads_updated_at BEFORE UPDATE ON public.ecommerce_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();