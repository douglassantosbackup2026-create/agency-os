# Checklist operador — antes do primeiro utilizador real

Execute **staging**, depois **produção**. Não commitar valores de secrets neste documento.

## 1. Secrets das Edge Functions (Dashboard Supabase)

| Secret | Onde confirmar | Notas |
|--------|----------------|--------|
| `CRON_SECRET` | Edge Functions → Secrets | Obrigatório para `compute-health-scores`, `evaluate-alerts`, `whatsapp-summary`. Jobs `pg_cron`/`pg_net` devem enviar `Authorization: Bearer <CRON_SECRET>`. |
| `ALLOW_INSECURE_CRON_ANON` | **Não** definir em produção | Só desenvolvimento local. |
| `PORTAL_ALLOWED_ORIGINS` | Secrets compartilhados ou por função | Domínios do frontend que chamam `portal-data` (lista CSV). Evitar `*` em produção. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Automático / Secrets | Service role só server-side. |

## 2. Base de dados

- `npx supabase db push` (ou histórico Dashboard) inclui `20260517140000_fix_rls_critical_policies.sql`.
- Consultas em [`security-rls-checklist.md`](security-rls-checklist.md).

## 3. Smoke manual (5 min)

1. Login utilizador membro.
2. Dashboard carrega sem erro vermelho persistente.
3. Lista clientes carrega; criar cliente obedece ao limite do plano (toast se bloqueado).
4. Portal `/p/<slug-teste>` OK ou mensagem amigável se slug inválido.
5. Opcional: invocar uma função cron com header secreto e confirmar **200** (não 401).

## 4. Incidentes e suporte

- Runbook: [`runbook-operacao.md`](runbook-operacao.md).
- Definir canal interno (Slack/email) para falhas reportadas por utilizadores piloto.
