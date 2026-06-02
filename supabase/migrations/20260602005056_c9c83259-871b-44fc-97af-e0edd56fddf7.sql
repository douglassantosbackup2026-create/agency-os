
-- 1) Privilege escalation: attach guard triggers on profiles
DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

DROP TRIGGER IF EXISTS profiles_guard_platform_admin_ins ON public.profiles;
CREATE TRIGGER profiles_guard_platform_admin_ins
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_guard_platform_admin_insert();

-- 2) Function search_path mutable
ALTER FUNCTION public.diagnoses_touch_updated_at() SET search_path = public;

-- 3) Materialized views exposed via Data API: revoke from anon/authenticated
REVOKE ALL ON public.client_metrics_28d FROM anon, authenticated;
REVOKE ALL ON public.campaign_audit_summary_by_client_mv FROM anon, authenticated;

-- 4) Realtime channel authorization (topic must end with an agency the user belongs to,
--    or be an ai-job:<id> topic — ai_jobs RLS still gates the row payload).
DROP POLICY IF EXISTS "Authenticated read agency topics" ON realtime.messages;
CREATE POLICY "Authenticated read agency topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    realtime.topic() LIKE 'ai-job:%'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND realtime.topic() LIKE '%:' || ur.agency_id::text
  )
);
