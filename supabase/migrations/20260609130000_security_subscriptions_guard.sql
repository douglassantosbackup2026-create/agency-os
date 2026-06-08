-- Block subscription limit self-escalation by authenticated users (service_role may update).

CREATE OR REPLACE FUNCTION public.subscriptions_guard_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.max_clients IS DISTINCT FROM OLD.max_clients
    OR NEW.max_alerts IS DISTINCT FROM OLD.max_alerts
    OR NEW.max_ai_tokens_per_day IS DISTINCT FROM OLD.max_ai_tokens_per_day
    OR NEW.max_ai_jobs_per_day IS DISTINCT FROM OLD.max_ai_jobs_per_day
  THEN
    RAISE EXCEPTION 'subscription plan limits cannot be modified by end users'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_guard_plan_limits ON public.subscriptions;
CREATE TRIGGER subscriptions_guard_plan_limits
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.subscriptions_guard_plan_limits();
