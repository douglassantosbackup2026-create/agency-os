export type MetaApiError = {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

export type MetaOAuthTokenResponse = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
};

export type Targeting = {
  age_min?: number;
  age_max?: number;
  genders?: number[];
  geo_locations?: Record<string, unknown>;
  interests?: Array<{ id: string; name: string }>;
  custom_audiences?: Array<{ id: string; name?: string }>;
  excluded_custom_audiences?: Array<{ id: string; name?: string }>;
  [key: string]: unknown;
};

export type AdAccount = {
  id: string;
  account_id: string;
  name: string;
  account_status?: number;
  currency?: string;
  timezone_name?: string;
  business_name?: string;
  [key: string]: unknown;
};

export type Campaign = {
  id: string;
  name: string;
  status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
  updated_time?: string;
  [key: string]: unknown;
};

export type AdSet = {
  id: string;
  name: string;
  status?: string;
  campaign_id?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: Targeting;
  optimization_goal?: string;
  billing_event?: string;
  [key: string]: unknown;
};

export type Ad = {
  id: string;
  name: string;
  status?: string;
  adset_id?: string;
  campaign_id?: string;
  creative?: Record<string, unknown>;
  [key: string]: unknown;
};

export type InsightsAction = {
  action_type?: string;
  value?: string;
};

export type Insights = {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  reach?: string;
  frequency?: string;
  actions?: InsightsAction[];
  action_values?: InsightsAction[];
  date_start?: string;
  date_stop?: string;
  [key: string]: unknown;
};

export type MetaTestStartResponse = {
  oauth_url: string;
  state: string;
};

/** Secrets do harness — guardados em localStorage (dev) e enviados como dev_config à Edge Function. */
export type MetaTestSecretsConfig = {
  meta_test_enabled: string;
  meta_test_oauth_state_secret: string;
  meta_app_id: string;
  meta_app_secret: string;
  public_site_url: string;
  meta_api_version?: string;
};

export type MetaTestSecretsCheckResponse = {
  harness_enabled: boolean;
  configured: Record<string, boolean>;
  missing: string[];
  source: "env" | "dev_config" | "mixed";
};

export type MetaTestGraphResponse<T> = {
  data: T;
  raw?: unknown;
};
