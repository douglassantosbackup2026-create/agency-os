-- Preferências de silêncio WhatsApp por cliente (menos ruído em alertas sugeridos).

CREATE TABLE IF NOT EXISTS public.client_whatsapp_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  mute_whatsapp_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_whatsapp_prefs_agency
  ON public.client_whatsapp_prefs(agency_id);

ALTER TABLE public.client_whatsapp_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_whatsapp_prefs_select ON public.client_whatsapp_prefs
  FOR SELECT USING (public.is_member_of(agency_id));

CREATE POLICY client_whatsapp_prefs_insert ON public.client_whatsapp_prefs
  FOR INSERT WITH CHECK (public.is_member_of(agency_id));

CREATE POLICY client_whatsapp_prefs_update ON public.client_whatsapp_prefs
  FOR UPDATE USING (public.is_member_of(agency_id));

CREATE POLICY client_whatsapp_prefs_delete ON public.client_whatsapp_prefs
  FOR DELETE USING (public.is_owner_or_admin(agency_id));

DROP TRIGGER IF EXISTS tr_client_whatsapp_prefs_updated ON public.client_whatsapp_prefs;
CREATE TRIGGER tr_client_whatsapp_prefs_updated
  BEFORE UPDATE ON public.client_whatsapp_prefs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
