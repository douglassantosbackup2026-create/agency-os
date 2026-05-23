-- Make view honor caller RLS
ALTER VIEW public.campaign_audit_summary_by_client SET (security_invoker = true);

-- Revoke EXECUTE on internal SECURITY DEFINER helpers from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_member_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner_or_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_agency() FROM anon;
REVOKE EXECUTE ON FUNCTION public.count_open_alerts(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.max_alerts_for_agency(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_is_platform_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.platform_list_agencies_minimal() FROM anon;
REVOKE EXECUTE ON FUNCTION public.platform_overview_counts() FROM anon;