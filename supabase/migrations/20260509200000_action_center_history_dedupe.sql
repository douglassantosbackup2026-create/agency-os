-- Histórico de ações, canonical_key para dedupe e eventos de auditoria.

ALTER TABLE public.action_center
  ADD COLUMN IF NOT EXISTS canonical_key TEXT;

CREATE INDEX IF NOT EXISTS idx_action_center_agency_canonical
  ON public.action_center(agency_id, canonical_key)
  WHERE canonical_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.action_center_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.action_center(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'status_change', 'assignee_change', 'note')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_center_events_action
  ON public.action_center_events(action_id, created_at DESC);

ALTER TABLE public.action_center_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_center_events_select ON public.action_center_events
  FOR SELECT USING (public.is_member_of(agency_id));
CREATE POLICY action_center_events_insert ON public.action_center_events
  FOR INSERT WITH CHECK (public.is_member_of(agency_id));
CREATE POLICY action_center_events_delete ON public.action_center_events
  FOR DELETE USING (public.is_owner_or_admin(agency_id));

CREATE OR REPLACE FUNCTION public.tr_action_center_events_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.action_center_events (action_id, agency_id, actor_id, event_type, payload)
    VALUES (
      NEW.id,
      NEW.agency_id,
      auth.uid(),
      'created',
      jsonb_build_object(
        'status', NEW.status,
        'assigned_to', NEW.assigned_to,
        'title', NEW.title
      )
    );
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.action_center_events (action_id, agency_id, actor_id, event_type, payload)
      VALUES (
        NEW.id,
        NEW.agency_id,
        auth.uid(),
        'status_change',
        jsonb_build_object('from', OLD.status, 'to', NEW.status)
      );
    END IF;
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      INSERT INTO public.action_center_events (action_id, agency_id, actor_id, event_type, payload)
      VALUES (
        NEW.id,
        NEW.agency_id,
        auth.uid(),
        'assignee_change',
        jsonb_build_object('from', OLD.assigned_to, 'to', NEW.assigned_to)
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_action_center_events_ins ON public.action_center;
CREATE TRIGGER tr_action_center_events_ins
  AFTER INSERT ON public.action_center
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_action_center_events_fn();

DROP TRIGGER IF EXISTS tr_action_center_events_upd ON public.action_center;
CREATE TRIGGER tr_action_center_events_upd
  AFTER UPDATE ON public.action_center
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_action_center_events_fn();
