## Diagnóstico do problema

Verifiquei o estado real no banco para `d=7e8e3d16-…`:

- `diagnoses.status = processing` (há ~10+ min)
- `diagnosis_reports.facts_json` ✅ existe (factos da Meta já foram extraídos)
- `diagnosis_reports.analysis_json` ❌ vazio (análise Claude nunca correu)
- `process-diagnosis` edge function: **0 invocações nos logs**

### Causa raiz
A `meta-oauth-callback` dispara `process-diagnosis` **uma única vez** (fire-and-forget) logo após a ligação Meta. Essa execução faz só a **primeira etapa** (extrai factos da Meta API) e termina com `continue` — a análise Claude fica para a "próxima" invocação. Mas não existe cron job a chamar essa função periodicamente, então a segunda etapa nunca acontece e o diagnóstico fica preso para sempre.

## Plano de correção (só backend, sem mexer no UI)

### 1. `supabase/functions/process-diagnosis/index.ts`
Fazer cada iteração processar **ambas as etapas** numa única invocação:
- Se não há `facts_json` → extrai factos da Meta.
- A seguir, no **mesmo loop**, se não há `analysis_json` → chama Claude e marca `completed`.

Remover o `continue` que cortava entre as duas etapas. Mantém o limite de 3 diagnósticos por chamada e o tratamento de erros existente.

### 2. `supabase/functions/diagnosis-status/index.ts` — auto-trigger de recuperação
Quando o cliente faz polling e encontra um diagnóstico em `processing` há mais de ~30s sem `completed_at`, disparar `process-diagnosis` em fire-and-forget (com `CRON_SECRET`), igual ao que `meta-oauth-callback` já faz. Isto:
- Desbloqueia automaticamente o caso atual do utilizador (assim que ele recarregar a página o polling força o processamento).
- Serve de rede de segurança caso a chamada inicial pós-OAuth falhe por timeout/rede.

Throttle: só dispara a cada N segundos (ex.: usar um campo simples como verificar se `updated_at` da última tentativa é antigo, ou simplesmente deixar disparar — o próprio `process-diagnosis` é idempotente porque verifica `status='processing'` e a existência de `facts_json`/`analysis_json`).

### 3. Deploy + recuperação imediata
- Deploy de `process-diagnosis` e `diagnosis-status`.
- Chamada manual única a `process-diagnosis` via curl para concluir o diagnóstico `7e8e3d16-…` agora mesmo, sem o utilizador ter que esperar mais.

## Fora de escopo
- Não vou mexer no UI de `/obrigado`.
- Não vou criar um cron job persistente (a auto-recuperação via polling já garante robustez sem nova infra).
