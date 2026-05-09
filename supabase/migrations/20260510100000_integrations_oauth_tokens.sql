-- OAuth: refresh token e expiração do access token (access continua em api_key_encrypted).
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.integrations.refresh_token_encrypted IS 'Refresh token OAuth (se existir); apenas para fluxos server-side.';
COMMENT ON COLUMN public.integrations.token_expires_at IS 'Quando o access token em api_key_encrypted expira; sincronização pode refrescar antes disso.';
