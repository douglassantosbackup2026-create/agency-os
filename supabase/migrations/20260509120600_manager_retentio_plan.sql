-- Gestor: frescor de dados (campo why nos alertas), stand-up snooze, tour de produto

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS why_line text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_completed_product_tour boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.standup_snoozes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  hidden_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agency_id, item_key)
);

CREATE TRIGGER tr_standup_snoozes_updated
  BEFORE UPDATE ON public.standup_snoozes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_standup_snoozes_lookup
  ON public.standup_snoozes(user_id, agency_id);

ALTER TABLE public.standup_snoozes ENABLE ROW LEVEL SECURITY;

CREATE POLICY standup_snoozes_select ON public.standup_snoozes FOR SELECT
  USING (user_id = auth.uid() AND public.is_member_of(agency_id));

CREATE POLICY standup_snoozes_insert ON public.standup_snoozes FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_member_of(agency_id));

CREATE POLICY standup_snoozes_update ON public.standup_snoozes FOR UPDATE
  USING (user_id = auth.uid() AND public.is_member_of(agency_id));

CREATE POLICY standup_snoozes_delete ON public.standup_snoozes FOR DELETE
  USING (user_id = auth.uid() AND public.is_member_of(agency_id));
