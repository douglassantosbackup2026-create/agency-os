# O que já existe (atualizado)

**Auth & estrutura:** login, signup, `/forgot-password`, `/reset-password`, rota `_authenticated`, multi-tenant (`agencies`, `user_roles`, RLS), onboarding em `/onboarding` pós-signup.

**Telas:** dashboard (cards, momentum de campanhas 14d, ações recomendadas, Realtime), clients lista + detalhe, alerts (filtros/busca/atribuir), health, reports (PDF, WhatsApp, filtros), activity, settings (logo bucket branding), whatsapp, integrations, admin (gate owner/admin, feature flags, demo subscriptions), command palette, portal público `/p/$portalSlug`.

**Banco:** schema completo incl. `subscriptions`, `whatsapp_templates`, buckets `branding`/`reports` (migrations recentes). RLS reforça `max_clients` no insert na tabela `clients` quando inserções vêm pela API com JWT.

**Edge functions:** `generate-report`, `seed-demo-data`, `compute-health-scores`, `evaluate-alerts`, `sync-platform`, `send-whatsapp`, `whatsapp-summary`, `portal-data`, `invite-member`; auth compartilhada em `_shared/cron-auth.ts` (cron secret + JWT).

**Integrações dados:** Meta Ads pode sincronizar via Marketing API + campanhas/metrics por campanha quando token + conta estão configurados; Google Ads / TikTok / GA4 podem usar paths de API onde token + IDs estão configurados (ver código e README); outros casos continuam simulados.

**CI:** `.github/workflows/ci.yml`, testes Vitest em `src/lib/format.test.ts`, README com env e crons.

---

# O que ainda falta ou está parcial

## Integrações de plataforma (profundidade)

- Fluxos OAuth oficiais (redirect browser, refresh tokens) para Meta/Google/TikTok/GA em vez de apenas colar credenciais manuais.
- Pipelines e modelos completos por plataforma (campanhas, conjuntos de anúncios, períodos configuráveis).

## Operação em produção

- Aplicar no **painel SQL** os jobs **`pg_cron`** do projeto com placeholders substituídos — ver `supabase/cron-jobs.example.sql`.
- Produção: `PORTAL_ALLOWED_ORIGINS`, rotação de chaves onde aplicável.

## Detalhe do cliente / relatórios / alertas

- Cliente `clients.$clientId`: evolução contínua (insights IA dedicados, tarefas, timeline).
- Relatórios: refinamentos UX além dos filtros básicos.
- Alertas: agrupamentos e tipologia mais rica (opcional).

## Billing

- Cobrança (checkout, gateway) **adiada**: sem Stripe por decisão atual; admin usa plano demo/manual e `subscriptions` na base.

## UX

- Polish contínuo: skeletons nas rotas finas, command palette/busca cada vez mais rica.

---

# Sugestão de ordem

1. Dados reais (OAuth + integrações + crons estáveis).
2. Profundidade detalhe cliente + relatórios + alertas.
3. Enforcement de limites e billing quando houver produto pago.
4. UX premium.
