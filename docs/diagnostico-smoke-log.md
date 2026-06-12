# Smoke manual — funil Diagnóstico Meta

Registar uma linha por execução (staging ou produção).

| Data | Ambiente | Operador | Resultado | Notas |
|------|----------|----------|-----------|-------|
| 2026-05-29 | prod (Worker) | automação | parcial | Landing `/` + `/checkout` 200 via `ops:diagnosis-health`; fluxo MP/OAuth requer credenciais no operador |
| 2026-06-12 | prod | _pendente_ | _pendente_ | Pré-lançamento Meta Ads: rodar E2E completo + validar Pixel `Purchase` no Events Manager antes de ligar campanhas |

## Checklist (15 min)

1. `/` → `/checkout` → preferência MP (sandbox ou valor mínimo).
2. Webhook aprova → `/obrigado?d=&s=` — poll `diagnosis-status` até `awaiting_connection` ou além.
3. OAuth Meta → `processing` → `completed` — relatório em `/diagnostico/$id`.
4. Upsell gestão (se elegível) → `create-management-checkout` → `/gestao-obrigado`.

Referência: [`diagnostico-meta-runbook.md`](diagnostico-meta-runbook.md).
