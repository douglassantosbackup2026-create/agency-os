# O que já existe

**Auth & estrutura:** login, signup, rota `_authenticated`, multi-tenant via `agencies` + `user_roles` + RLS, `handle_new_user` cria agência/perfil/owner.

**Telas:** dashboard, clients (lista + detalhe), alerts, health, reports, activity, settings, command palette.

**Banco:** agencies, profiles, user_roles, clients, campaigns, metrics_daily, alerts, health_scores, reports, integrations, whatsapp_logs, notifications, activities, tasks, notes, feature_flags — todas com RLS por agency.

**Edge functions:** `generate-report` (IA), `seed-demo-data`.

---

# O que falta (por prioridade)

## 1. Recuperação de senha & onboarding
- Tela `/forgot-password` + `/reset-password` (obrigatório p/ produção).
- Fluxo de onboarding pós-signup: nome da agência, logo, convidar membros, escolher integrações.

## 2. Dashboard "painel de guerra" real
Hoje é estático/básico. Falta:
- Cards: faturamento gerenciado, ROAS médio, spend total, clientes ativos, clientes em risco, alertas críticos, health geral, pacing mensal, receita estimada.
- Lista "campanhas em queda" e "campanhas escalando" (deltas vs período anterior em `metrics_daily`).
- Feed operacional realtime (Supabase Realtime em `activities` + `alerts`).
- Bloco de "ações recomendadas" (gerado por IA a partir de alerts abertos).

## 3. Health Score automático
Hoje há tabela mas não há cálculo. Criar:
- Edge function `compute-health-scores` (cron diário): agrega performance, queda ROAS, alta CPA, dias sem otimização, frequência de acesso, estabilidade → grava `health_scores`.
- Timeline de deterioração no detalhe do cliente (gráfico simples).
- Recomendações IA por cliente.
- Cron via `pg_cron` + `pg_net`.

## 4. Motor de alertas inteligentes
- Edge function `evaluate-alerts` (cron horário): detecta ROAS caiu, CPA subiu, campanha parada, pacing desalinhado, criativo fadigado, queda CTR, gasto acelerado, sem contato há X dias.
- Na UI de `/alerts`: filtros (prioridade, tipo, cliente, status), busca, agrupamento, ação "resolver/atribuir", responsável.

## 5. Detalhe do cliente completo
Expandir `clients.$clientId` com abas: Overview, Métricas, Campanhas, Health (timeline), Histórico, Notas, Tarefas, Timeline operacional, Insights IA, Relatórios, Alertas, Comunicação. Hoje provavelmente só tem overview básico.

## 6. Relatórios IA
- Listagem de reports já gerados, filtro por cliente/período.
- Botão "gerar novo insight" chamando `generate-report`.
- Visualização formatada (resumo executivo / positivos / problemas / oportunidades / próximos passos / versão amigável).
- Ações: copiar, enviar por WhatsApp, exportar PDF.

## 7. Portal do cliente (white-label)
**Não existe.** Criar rota pública `/p/$portalSlug` (sem auth ou com magic link):
- Métricas simplificadas, evolução, campanhas, insights IA, relatórios, timeline de entregas, próximos passos.
- Tema usa `agencies.primary_color` + `logo_url`.

## 8. WhatsApp alerts
- Edge function `send-whatsapp` (Evolution API ready, secret `EVOLUTION_API_URL`/`KEY`).
- Tela de templates (resumo diário, semanal, alerta crítico).
- UI em `/settings` para fila + logs (`whatsapp_logs` já existe).
- Cron para resumos diário/semanal.

## 9. Integrações reais
Hoje só há tabela `integrations`. Implementar OAuth/API key para:
- Meta Ads, Google Ads, TikTok Ads, GA4, OpenAI, WhatsApp.
- Edge functions `sync-meta`, `sync-google`, etc., gravando em `metrics_daily` e `campaigns`.
- UI: status de conexão, última sync, botão "sincronizar agora".

## 10. Área administrativa
Rota `_authenticated/admin` (gate por role `owner`):
- Gerenciar membros (convidar, remover, mudar role) — tabela `user_roles` já existe.
- Feature flags (toggles).
- Logs de atividade da agência.
- Métricas SaaS internas (uso, clientes, MRR somado).

## 11. White-label completo
Em `/settings`:
- Upload logo, cor primária, nome, favicon (storage bucket `branding`).
- Custom domain (campo já existe em `agencies`).
- Aplicar tema dinâmico no portal do cliente.

## 12. Billing / planos / assinaturas
Falta tabela `subscriptions` + integração Stripe (limites por plano: nº clientes, nº alertas, integrações).

## 13. UX premium
- Skeletons em todas as telas com loading.
- Toasts realtime para alertas novos.
- Quick actions no command palette (criar cliente, criar tarefa, gerar relatório).
- Busca global (clientes, campanhas, alertas).
- Animações suaves (framer-motion ou tailwind).

## 14. Storage buckets
Criar `branding` (público) e `reports` (privado, RLS por agency).

---

# Sugestão de ordem de execução

**Fase 1 (MVP utilizável internamente):** 1, 2, 3, 4, 5
**Fase 2 (valor pro cliente final):** 6, 7, 8
**Fase 3 (escala/comercial):** 9, 10, 11, 12
**Fase 4 (polish):** 13, 14

Cada fase é um conjunto grande — recomendo aprovar uma fase por vez, não tudo de uma vez, pra manter qualidade e poder validar.

---

# Pergunta antes de começar

Por qual fase quer começar? Sugiro **Fase 1** (motor de health score + alertas + dashboard real + detalhe do cliente) — é o que faz a plataforma deixar de ser "casca" e virar produto operacional.
