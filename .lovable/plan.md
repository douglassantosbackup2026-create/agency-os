
# Retentio — Sistema operacional para retenção de agências

Como o briefing deixou várias decisões em aberto e você pulou as perguntas, segui com defaults sensatos:

- **Nome:** **Retentio** (operacional, premium, fácil de lembrar — pode trocar depois)
- **Escopo desta entrega:** MVP enxuto funcional + estrutura modular para o resto
- **Integrações externas:** mockadas com seed realista, exceto **Relatórios IA** que rodam de verdade via Lovable AI Gateway
- **Backend:** Supabase via Lovable Cloud (precisa ser ativado — ver abaixo)

---

## ⚠️ Pré-requisito: ativar Lovable Cloud

O projeto precisa de banco, auth multi-tenant, realtime e IA. **Lovable Cloud está desativado.** Para implementar este plano, ative em: Connectors → Lovable Cloud → Tool Permissions → "Always allow" ou "Ask each time". Sem isso só consigo entregar a casca visual com dados mockados.

---

## Identidade visual

- Dark mode premium inspirado em Linear / Stripe / Vercel
- Tipografia: Inter (UI) + JetBrains Mono (números/métricas)
- Tokens em `oklch` no `src/styles.css`: superfície quase preta, accent elétrico discreto, semáforo (verde/âmbar/vermelho) para health & alertas
- Cards minimalistas, bordas sutis, espaçamento generoso, animações curtas (150–200ms)
- Sem gráficos pesados — sparklines e barras finas em vez de dashboards poluídos

---

## Arquitetura

**Stack:** TanStack Start + React + Tailwind v4 + shadcn + Supabase (Lovable Cloud) + Lovable AI Gateway.

**Multi-tenant:** todo registro carrega `agency_id`. RLS por agência + tabela separada `user_roles` (owner / admin / member) com função `has_role` security definer (evita recursão em RLS).

**Realtime:** feed operacional e alertas via Supabase Realtime channels.

---

## Schema do banco (fase 1)

`agencies`, `profiles`, `user_roles`, `clients`, `campaigns`, `metrics_daily` (spend / revenue / roas / cpa / ctr por dia), `health_scores` (snapshot diário + componentes), `alerts`, `activities` (timeline), `reports` (IA), `notes`, `tasks`, `integrations` (status mock), `settings` (white-label), `whatsapp_logs` (estrutura preparada), `notifications`, `feature_flags`.

Trigger `handle_new_user` cria profile + agência inicial no signup. Função `recalculate_health_score(client_id)` agrega métricas dos últimos 14 dias.

---

## Telas do MVP (fase 1 — entrego agora)

1. **Auth** — login / signup / reset / onboarding (nome da agência, logo opcional)
2. **Dashboard operacional** — faturamento gerenciado, ROAS médio, spend, clientes ativos, clientes em risco, alertas críticos, health geral, top campanhas escalando/caindo, pacing mensal, feed em tempo real, ações recomendadas
3. **Clientes** — lista com health score, MRR, status, tags, responsável, busca; detalhe com overview, métricas, campanhas, health timeline, notas, tarefas, alertas, relatórios IA
4. **Health Score** — visão consolidada + drilldown por componente (performance, otimização, comunicação, acesso, estabilidade), recomendações IA
5. **Central de Alertas** — feed priorizado, filtros, agrupamento, atribuir responsável, marcar resolvido, regras configuráveis
6. **Relatórios IA** — gera resumo executivo / pontos positivos / problemas / oportunidades / próximos passos a partir das métricas reais do cliente (Lovable AI, modelo `google/gemini-3-flash-preview`); botão "gerar novo", histórico, copiar, exportar
7. **Configurações** — perfil, agência, white-label (logo, cor primária, nome), integrações (UI + status mock), API keys, equipe
8. **Command palette** (⌘K) — busca global de clientes, campanhas, alertas, navegação rápida
9. **Sidebar premium** colapsável + header com busca e quick actions

---

## Estrutura preparada (stubs nesta fase)

Schema + rotas criadas, UI mínima, evolução em fases futuras:

- **Portal do cliente white-label** (`/portal/:slug`) — rota pública isolada, layout simples, métricas resumidas
- **WhatsApp Alerts** — tabelas `whatsapp_logs` + UI de templates/fila/status, integração Evolution API plugável
- **Área administrativa** — `/admin` para owners (contas, planos, feature flags, logs)
- **Roadmap modular**: AI agents, CRM, aprovações, financeiro, playbooks — pastas e tipos preparados, sem implementação profunda

---

## Seed data

Para parecer "produto real" no primeiro acesso: 1 agência, 8 clientes fictícios com 30 dias de métricas, alertas variados, 2 relatórios IA pré-gerados, atividades no feed.

---

## Detalhes técnicos

- TanStack Start file-based routing, rotas em `src/routes/` (index, login, signup, _authenticated/dashboard, _authenticated/clients, _authenticated/clients/$id, _authenticated/alerts, _authenticated/health, _authenticated/reports, _authenticated/settings/*, portal/$slug, admin)
- Server functions (`createServerFn` + `requireSupabaseAuth`) para queries sensíveis e geração de IA
- RLS em todas tabelas; service role só em rotas server isoladas
- Componentes shadcn customizados; sem libs de chart pesadas (recharts apenas pontual em sparklines)
- Realtime hooks para alerts e activities
- Skeleton states em todas listas; loading otimista em mutations

---

## Fora deste primeiro entregável

Estes ficam na estrutura mas não implementados a fundo agora — peça em sessões seguintes:

- Integrações reais Meta/Google/TikTok/GA (precisam OAuth + cron de sync)
- Evolution API conectada de verdade
- Domínio customizado white-label
- Billing / Stripe
- n8n webhooks operacionais

---

## Próximo passo

Ative o Lovable Cloud e me avise — então sigo com a implementação na ordem: schema → auth → seed → dashboard → clientes → health → alertas → relatórios IA → settings/white-label → command palette → polish.
