# Runbook: onboarding gestão R$ 1.997

Pipeline pós-pagamento da gestão de tráfego Meta Ads. O funil de diagnóstico (R$ 37) permanece inalterado.

## Pré-requisitos

1. **`retentio_ops_config.diagnosis_funnel_agency_id`** = UUID da agência operadora (**Agency Opus**)  
   - Platform Admin → aba Funil → card **Agência do funil de gestão**  
   - Ou SQL: `UPDATE retentio_ops_config SET diagnosis_funnel_agency_id = '...' WHERE id = 1;`

2. Edge functions deployadas: `provision-management-client`, `submit-management-onboarding`, e alterações em pagamento.

## Fluxo do cliente (pós-pagamento)

| Etapa | Onde | SLA |
|-------|------|-----|
| Pagamento confirmado | `/gestao-obrigado` | Imediato |
| Formulário onboarding | `/gestao-onboarding?d=&s=` | Cliente: 5 min |
| WhatsApp (urgências) | Botão na página obrigado | Opcional |
| Portal | `/p/{portal_slug}` | Após provisionamento (poll automático na página obrigado) |

## Fluxo interno (agência)

| Etapa | Onde | SLA |
|-------|------|-----|
| Alerta `diagnosis_management_paid` | Cockpit / Alertas | Imediato (PIX + cartão) |
| Tarefa automática | Central de Ações (`management_paid_onboarding`) | Imediato |
| Fila onboarding | Menu **Onboarding gestão** ou Dashboard | Revisar em **24h** |
| Provisionar cliente | Botão **Provisionar** (1 clique) | Até 24h após pagamento |
| Checklist automático | Cliente → onboarding items | Pós-provisionar |
| Plano de ação | Action Center (do `actionPlan` do diagnóstico) | Pós-provisionar |
| 1º relatório IA | Fila `ai_jobs` (best-effort) | Pós-provisionar; revisar em `/ai-review` |
| Go-live campanhas | Operação manual | **5 dias úteis** |

### Papéis na equipa

| Papel | Fila / formulário / WhatsApp | Provisionar |
|-------|------------------------------|-------------|
| **member** | Sim | Não (botão desabilitado) |
| **owner / admin** | Sim | Sim |
| **platform admin** | Sim | Sim |

Members fazem triagem comercial; owners/admins executam o 1 clique de provisionamento.

## Handoff e observabilidade

- **Platform Admin → Handoff:** timeline de `diagnosis_handoff_events` (cliques WhatsApp, formulário, etc.)
- **Platform Admin → Assinantes Gestão:** filtro **Sem clique WhatsApp** para priorizar follow-up
- Coluna `management_whatsapp_clicked_at` em diagnósticos pagos

Eventos registados em `gestao-obrigado` via `log-management-handoff` e no envio do formulário (`onboarding_submitted`).

## O que o provisionamento cria

- Registo em `clients` com `diagnosis_id`, MRR R$ 1.997, status `onboarding`
- `client_platform_accounts` com `meta_ad_account_id` do diagnóstico (se existir)
- 5 itens de `onboarding_checklist_items`
- Nota interna com link ao relatório `/diagnostico/{id}?s={secret}`
- Tarefas em `action_center` a partir de `analysis_json.actionPlan`
- Invocação best-effort de `compute-health-scores`
- Job `ai_jobs` tipo `report` (`monthly_manager`) se orçamento IA da agência permitir

**Não copia** token OAuth do diagnóstico — a agência deve conectar Meta em **Integrações** e pedir acesso à BM.

## Pós-provisionamento (SOP)

1. **Integrações** → OAuth Meta da agência  
2. Pedir acesso à BM do cliente (checklist `platform_access`)  
3. **Sync** (`sync-platform`) para popular métricas  
4. Revisar 1º relatório em **Revisão IA** (`/ai-review`) — pode estar vazio até haver sync  
5. Enviar link do **portal** (`/p/{portal_slug}`) ao cliente  

### SLA resumido

- **24h:** provisionar no cockpit + contacto inicial  
- **5 dias úteis:** go-live operacional (acessos, sync, primeiros ajustes)

## Renovação

- **Cartão:** cobrança automática MP; monitorar em Platform Admin → Assinantes Gestão  
- **PIX:** link manual 3 dias antes (processo comercial existente)

## Provisionamento via API

A fonte de verdade é a edge function `provision-management-client` (não há RPC SQL duplicada — evita drift). A UI e o Platform Admin invocam a function com `{ diagnosis_id }`.

## Comandos úteis

```bash
npx supabase db push --linked --yes
npx supabase functions deploy provision-management-client --use-api
npm run db:types
npm test -- --run src/lib/management-onboarding-pipeline.test.ts
npm run ops:management-paid-smoke
```

## Verificação

- Pagamento teste → alerta + tarefa na agência configurada  
- Menu **Onboarding gestão** visível para membros da agência do funil  
- Fila em `/management-onboarding` mostra o diagnóstico  
- Provisionar → cliente em `/clients` com banner de origem  
- Platform Admin → Handoff mostra eventos; filtro sem WhatsApp funciona  
- Após provisionar → `ai_jobs` pendente (se orçamento OK)
