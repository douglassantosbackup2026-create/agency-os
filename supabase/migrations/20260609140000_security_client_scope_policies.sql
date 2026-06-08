-- Propagate client_member_scopes to child tables via user_can_access_client().

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'campaigns',
    'metrics_daily',
    'health_scores',
    'alerts',
    'reports',
    'notes',
    'tasks',
    'client_platform_accounts',
    'onboarding_checklist_items',
    'creative_assets',
    'meeting_reports',
    'competitor_watchlist',
    'competitor_snapshots',
    'campaign_ai_audits',
    'ga4_campaign_daily',
    'campaign_ai_audit_recommendation_status',
    'client_whatsapp_prefs',
    'action_center'
  ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'client_id'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);

    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated
       USING (
         public.is_member_of(agency_id)
         AND public.user_can_access_client(client_id)
       )',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated
       WITH CHECK (
         public.is_member_of(agency_id)
         AND public.user_can_access_client(client_id)
       )',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated
       USING (
         public.is_member_of(agency_id)
         AND public.user_can_access_client(client_id)
       )
       WITH CHECK (
         public.is_member_of(agency_id)
         AND public.user_can_access_client(client_id)
       )',
      t, t
    );
  END LOOP;
END $$;

-- creative_reviews has creative_asset_id, not client_id — scope via parent asset.
DROP POLICY IF EXISTS creative_reviews_select ON public.creative_reviews;
DROP POLICY IF EXISTS creative_reviews_insert ON public.creative_reviews;
DROP POLICY IF EXISTS creative_reviews_update ON public.creative_reviews;

CREATE POLICY creative_reviews_select ON public.creative_reviews
  FOR SELECT TO authenticated
  USING (
    public.is_member_of(agency_id)
    AND public.user_can_access_client(
      (SELECT ca.client_id FROM public.creative_assets ca WHERE ca.id = creative_asset_id)
    )
  );

CREATE POLICY creative_reviews_insert ON public.creative_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of(agency_id)
    AND public.user_can_access_client(
      (SELECT ca.client_id FROM public.creative_assets ca WHERE ca.id = creative_asset_id)
    )
  );

CREATE POLICY creative_reviews_update ON public.creative_reviews
  FOR UPDATE TO authenticated
  USING (
    public.is_member_of(agency_id)
    AND public.user_can_access_client(
      (SELECT ca.client_id FROM public.creative_assets ca WHERE ca.id = creative_asset_id)
    )
  )
  WITH CHECK (
    public.is_member_of(agency_id)
    AND public.user_can_access_client(
      (SELECT ca.client_id FROM public.creative_assets ca WHERE ca.id = creative_asset_id)
    )
  );
