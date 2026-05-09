
-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false) ON CONFLICT (id) DO NOTHING;

-- Branding: public read; members of the agency (folder name = agency_id) can write
CREATE POLICY "branding_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "branding_members_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'branding' AND public.is_member_of(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "branding_members_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'branding' AND public.is_member_of(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "branding_members_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'branding' AND public.is_member_of(((storage.foldername(name))[1])::uuid)
);

-- Reports: private; only members can read/write
CREATE POLICY "reports_members_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'reports' AND public.is_member_of(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "reports_members_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'reports' AND public.is_member_of(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "reports_members_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'reports' AND public.is_member_of(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "reports_members_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'reports' AND public.is_member_of(((storage.foldername(name))[1])::uuid)
);

-- WhatsApp templates
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wt_select" ON public.whatsapp_templates FOR SELECT USING (public.is_member_of(agency_id));
CREATE POLICY "wt_insert" ON public.whatsapp_templates FOR INSERT WITH CHECK (public.is_member_of(agency_id));
CREATE POLICY "wt_update" ON public.whatsapp_templates FOR UPDATE USING (public.is_member_of(agency_id));
CREATE POLICY "wt_delete" ON public.whatsapp_templates FOR DELETE USING (public.is_owner_or_admin(agency_id));
CREATE TRIGGER wt_updated BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Subscriptions stub
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'trialing',
  max_clients INT NOT NULL DEFAULT 5,
  max_alerts INT NOT NULL DEFAULT 100,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_select" ON public.subscriptions FOR SELECT USING (public.is_owner_or_admin(agency_id));
CREATE POLICY "sub_update" ON public.subscriptions FOR UPDATE USING (public.is_owner_or_admin(agency_id));
CREATE POLICY "sub_insert" ON public.subscriptions FOR INSERT WITH CHECK (public.is_owner_or_admin(agency_id));
CREATE TRIGGER sub_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public portal access: allow anyone to read minimal client data when portal_slug is set (used by client portal)
CREATE POLICY "clients_public_portal" ON public.clients FOR SELECT USING (portal_slug IS NOT NULL);

-- Add api_key column to integrations for manual API key config
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS account_id TEXT;
