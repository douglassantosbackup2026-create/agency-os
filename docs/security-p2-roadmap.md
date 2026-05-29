# Roadmap P2 — Segurança (longo prazo)

Itens planeados após P0/P1. Não bloqueiam deploy se P0 estiver completo.

## 1. Cifra de tokens em repouso

- Migrar `integrations.api_key_encrypted` / `refresh_token_encrypted` para **Supabase Vault** ou `pgsodium`.
- Renomear colunas para evitar falsa sensação (`access_token_ciphertext` + `key_id`).
- Rotação documentada; nunca logar valores em Edge Functions.

## 2. Rate limiting distribuído

- Tabela `api_rate_limits` + RPC `check_api_rate_limit` já criada na migration `20260529120100_api_rate_limits.sql`.
- ~~Substituir `Map` in-memory em rate limits~~ — **feito** (fase 3): `portal-rate-limit.ts` e `public-rate-limit.ts` usam RPC `check_api_rate_limit`.
- Cloudflare Rate Limiting / Turnstile em `/functions/v1/portal-*` e checkout.

## 3. Observabilidade

- Política de redaction: não logar `Authorization`, bodies OAuth, prompts LLM completos.
- Alertas em `ai_usage_events` (spike por `agency_id`).
- `supabase-db-lint` em CI sem `continue-on-error` quando projeto linkado.

## 4. Separação de produtos (opcional)

- Projeto Supabase dedicado ao funil **Diagnóstico Meta** vs **SaaS agência** — reduz blast radius das functions `verify_jwt=false`.

## 5. Pentest

- Auditoria externa anual após mudanças em RLS ou perímetro público.
