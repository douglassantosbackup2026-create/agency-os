# Fallback de IA no diagnóstico (Claude → GPT-5 → Gemini)

Hoje a `process-diagnosis` chama só Anthropic. Se a chave fica sem créditos (foi o caso real), o diagnóstico fica em `failed` e não há recuperação automática. Vamos adicionar fallback em cadeia para 3 providers, com chaves diretas.

## Providers e ordem

1. **Anthropic Claude** (`ANTHROPIC_API_KEY`, já existe) — `claude-sonnet-4-20250514`
2. **OpenAI GPT-5** (`OPENAI_API_KEY`, **nova secret**) — `gpt-5`
3. **Google Gemini** (`GEMINI_API_KEY`, **nova secret**) — `gemini-2.5-pro`

A próxima é tentada apenas se a anterior falhar com um erro **recuperável**: HTTP 401/402/429/5xx, timeout, JSON inválido ou resposta que não passa em `validateAnalysis`. Erros de input (4xx que não sejam os acima) não disparam fallback — são bug nosso.

## Mudanças

### 1. `supabase/functions/process-diagnosis/index.ts`

- Extrair o prompt `system` + `user` para constantes partilhadas (já existem, só reorganizar).
- Criar `callAnthropic(facts)`, `callOpenAI(facts)`, `callGemini(facts)` — cada uma devolve `unknown` (JSON parseado) ou lança `Error` com a razão.
  - Cada chamada com `AbortController` + timeout (~60s) para não pendurar a função.
  - Parser tolerante (reusar `extractJsonFromClaude`, que já lida com fences ```json).
- Substituir o atual `runClaude(facts)` por `runWithFallback(facts)`:
  - Tenta os 3 em ordem; regista qual foi usado e a razão de falha dos anteriores.
  - Se todos falharem, lança erro agregado.
- Guardar metadados em `diagnosis_reports`:
  - `ai_provider_used` (`anthropic` | `openai` | `gemini`) → adicionar como chave dentro de `analysis_json` (`__meta`) ou nova coluna (ver secção DB).
  - Log estruturado por tentativa: `{ provider, ok, status, ms, error_trunc }`.

### 2. Secrets (via tool `add_secret`)

- `OPENAI_API_KEY` — pedir ao utilizador (link: https://platform.openai.com/api-keys).
- `GEMINI_API_KEY` — pedir ao utilizador (link: https://aistudio.google.com/apikey).

Não mexer em `ANTHROPIC_API_KEY` nem em `LOVABLE_API_KEY`.

### 3. Sem mudanças de schema obrigatórias

O provider usado fica dentro de `analysis_json.__meta.provider`. Se quiseres consulta dedicada, posso adicionar coluna `diagnosis_reports.ai_provider text` numa migração separada — não é bloqueante.

### 4. UI

Nenhuma alteração na `/obrigado`. O comportamento de “processando → completo” não muda; só fica mais robusto. Opcional (não incluído): mostrar “Análise gerada por X” no relatório final em `/diagnostico/:id` — pergunto antes de adicionar.

## Detalhes técnicos por provider

```text
Anthropic   POST https://api.anthropic.com/v1/messages
            headers: x-api-key, anthropic-version: 2023-06-01
            body:    { model, max_tokens, system, messages:[{role:user,content}] }
            parse:   body.content[].text (type==="text")

OpenAI      POST https://api.openai.com/v1/chat/completions
            headers: Authorization: Bearer ...
            body:    { model:"gpt-5", messages:[{role:system},{role:user}],
                       response_format:{type:"json_object"} }
            parse:   body.choices[0].message.content (já JSON string)

Gemini      POST https://generativelanguage.googleapis.com/v1beta/
                  models/gemini-2.5-pro:generateContent?key=...
            body:    { systemInstruction:{parts:[{text:system}]},
                       contents:[{role:"user",parts:[{text:user}]}],
                       generationConfig:{responseMimeType:"application/json"} }
            parse:   body.candidates[0].content.parts[0].text
```

Todos passam pelo mesmo `validateAnalysis` (exige `score:number` e `summary:string`).

## Recuperação do diagnóstico já em `failed`

Depois do deploy + secrets, faço um `UPDATE diagnoses SET status='processing', failed_reason=NULL WHERE id='7e8e3d16-...'` (via migração ou tool de DB) para que o polling em `/obrigado` o reprocesse automaticamente com o novo fallback.

## Riscos

- **Custo**: se Anthropic ficar sempre a falhar, todo o tráfego vai para OpenAI. Considera monitorar billing.
- **Diferença de tom entre providers**: o prompt é o mesmo e a estrutura JSON é validada, mas o texto livre (`summary`, `actionPlan[].action`) pode variar. Aceitável para um fallback.
- **Gemini 2.5 Pro JSON mode**: às vezes devolve com markdown apesar do `responseMimeType`. O parser tolera fences.
