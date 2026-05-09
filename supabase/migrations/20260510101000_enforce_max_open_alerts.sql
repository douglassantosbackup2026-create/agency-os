-- Impede ultrapassar subscriptions.max_alerts para alertas com status open (fallback 100).

CREATE OR REPLACE FUNCTION public.count_open_alerts(_agency uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.alerts a
  WHERE a.agency_id = _agency AND a.status = 'open';
$$;

CREATE OR REPLACE FUNCTION public.max_alerts_for_agency(_agency uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT s.max_alerts FROM public.subscriptions s WHERE s.agency_id = _agency LIMIT 1),
    100
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_max_open_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim int;
  open_ct int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'open'::public.alert_status THEN
      RETURN NEW;
    END IF;
    lim := public.max_alerts_for_agency(NEW.agency_id);
    open_ct := public.count_open_alerts(NEW.agency_id);
    IF open_ct >= lim THEN
      RAISE EXCEPTION 'Limite de alertas abertos (%) atingido para esta agência', lim
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'open'::public.alert_status
       AND NEW.status IS DISTINCT FROM 'open'::public.alert_status THEN
      RETURN NEW;
    END IF;
    IF NEW.status = 'open'::public.alert_status
       AND OLD.status IS DISTINCT FROM 'open'::public.alert_status THEN
      lim := public.max_alerts_for_agency(NEW.agency_id);
      open_ct := public.count_open_alerts(NEW.agency_id);
      IF open_ct >= lim THEN
        RAISE EXCEPTION 'Limite de alertas abertos (%) atingido para esta agência', lim
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_alerts_max_open ON public.alerts;
CREATE TRIGGER tr_alerts_max_open
  BEFORE INSERT OR UPDATE ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_open_alerts();
