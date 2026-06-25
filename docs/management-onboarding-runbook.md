# Runbook: onboarding gestão R$ 1.997

Pipeline pós-pagamento da gestão de tráfego Meta Ads. O funil de diagnóstico (R$ 37) permanece inalterado.

## Pré-requisitos

1. **`retentio_ops_config.diagnosis_funnel_agency_id`** = UUID da agência operadora  
   - Platform Admin → aba Funil → card **Agência do funil de gestão**  
   - Ou SQL: `UPDATE retentio_ops_config SET diagnosis_funnel_agency_id = '...' WHERE id = 1;`

2. Edge functions deployadas: `provision-management-client`, `submit-management-onboarding`, e alterações em pagamento.

## Fluxo do cliente (pós-pagamento)

| Etapa | Onde | SLA |
|-------|------|-----|
| Pagamento confirmado | `/gestao-obrigado` | Imediato |
| Formulário onboarding | `/gestao-onboarding?d=&s=` | Cliente: 5 min |
| WhatsApp (urgências) | Botão na página obrigado | Opcional |
| Portal | `/p/{portal_slug}` | Após provisionamento |

## Fluxo interno (agência)

| Etapa | Onde | SLA |
|-------|------|-----|
| Alerta `diagnosis_management_paid` | Cockpit / Alertas | Imediato (PIX + cartão) |
| Fila onboarding | Dashboard ou `/management-onboarding` | Revisar em 24h |
| Provisionar cliente | Botão **Provisionar** (1 clique) | Até 24h após pagamento |
| Checklist automático | Cliente → onboarding items | Pós-provisionar |
| Plano de ação | Action Center (do relatório IA) | Pós-provisionar |
| Go-live campanhas | Operação manual | 5 dias úteis |

## O que o provisionamento cria

- Registo em `clients` com `diagnosis_id`, MRR R$ 1.997, status `onboarding`
- `client_platform_accounts` com `meta_ad_account_id` do diagnóstico (se existir)
- 5 itens de `onboarding_checklist_items`
- Nota interna com link ao relatório
- Tarefas em `action_center` a partir de `analysis_json.actionPlan`
- Invocação best-effort de `compute-health-scores`

**Não copia** token OAuth do diagnóstico — a agência deve conectar Meta em Integrações e pedir acesso à BM.

## Renovação

- **Cartão:** cobrança automática MP; monitorar em Platform Admin → Assinantes Gestão
- **PIX:** link manual 3 dias antes (processo comercial existente)

## Comandos úteis

```bash
npx supabase db push --linked
npx supabase functions deploy provision-management-client submit-management-onboarding --use-api
npm run db:types
```

## Verificação

- Pagamento teste → alerta na agência configurada
- Fila em `/management-onboarding` mostra o diagnóstico
- Provisionar → cliente visível em `/clients` com banner de origem
