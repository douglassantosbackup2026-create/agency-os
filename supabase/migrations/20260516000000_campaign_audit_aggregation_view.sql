-- Aggregated view: one row per agency+client with audit summary stats
CREATE OR REPLACE VIEW campaign_audit_summary_by_client AS
SELECT
  a.agency_id,
  a.client_id,
  c.name                                                       AS client_name,
  COUNT(*)                                                     AS total_audits,
  MAX(a.created_at)                                            AS last_audit_at,
  ROUND(AVG((a.result_json->>'overall_score')::numeric), 1)   AS avg_score,
  SUM(CASE WHEN a.result_json->>'overall_status' = 'critical'
           THEN 1 ELSE 0 END)                                  AS critical_count,
  COUNT(CASE WHEN s.user_action = 'task_created' THEN 1 END)  AS tasks_created,
  COUNT(CASE WHEN s.user_action = 'dismissed'    THEN 1 END)  AS dismissed_count
FROM campaign_ai_audits a
JOIN clients c ON c.id = a.client_id
LEFT JOIN campaign_ai_audit_recommendation_status s ON s.audit_id = a.id
GROUP BY a.agency_id, a.client_id, c.name;

-- Grant read access to authenticated users; RLS on underlying tables handles row-level isolation
ALTER VIEW campaign_audit_summary_by_client OWNER TO postgres;
GRANT SELECT ON campaign_audit_summary_by_client TO authenticated;
