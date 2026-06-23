## Objetivo

Fechar a brecha apontada pelo scanner: hoje membros restritos por `client_member_scopes` conseguem ler dados de clientes fora do seu escopo em várias tabelas, e podem inserir `whatsapp_logs` para qualquer cliente da agência. Vou alinhar essas políticas ao padrão já usado em `campaigns`, `metrics_daily`, `alerts` (combinação `is_member_of(agency_id) AND user_can_access_client(client_id)`).

## Mudanças (uma migração só)

### 1. Tabelas com `client_id` por linha
Atualizar SELECT/INSERT/UPDATE para exigir também `user_can_access_client(client_id)`:

- `ga4_daily` (client_id NOT NULL)
- `ga4_funnel_daily` (NOT NULL)
- `ga4_channel_daily` (NOT NULL)
- `ga4_tracking_health_daily` (NOT NULL)
- `sync_runs` (nullable → usar `(client_id IS NULL OR user_can_access_client(client_id))`)
- `ai_jobs` (nullable, só SELECT existe; INSERT continua negado)

### 2. `action_center_events` (sem client_id direto)
Filtrar via join na ação-mãe:

```
EXISTS (
  SELECT 1 FROM public.action_center ac
  WHERE ac.id = action_id
    AND (ac.client_id IS NULL OR public.user_can_access_client(ac.client_id))
)
```

Aplicado a SELECT e ao WITH CHECK do INSERT.

### 3. `agency_briefings` (dados agregados, sem client_id)
São briefings de toda a agência. Para não vazar visão consolidada a um membro restrito, restringir SELECT/UPDATE/INSERT a membros **sem escopo** ativo na agência (ou owner/admin):

```
is_member_of(agency_id) AND (
  is_owner_or_admin(agency_id)
  OR NOT EXISTS (
    SELECT 1 FROM public.client_member_scopes s
    WHERE s.user_id = auth.uid() AND s.agency_id = agency_briefings.agency_id
  )
)
```

### 4. `whatsapp_logs` INSERT
Trocar `WITH CHECK is_member_of(agency_id)` por `is_member_of(agency_id) AND user_can_access_client(client_id)` para casar com SELECT/UPDATE já corretos.

## Riscos e mitigações

- Edge functions e jobs server-side usam `service_role`, que ignora RLS — não afetados.
- Server functions que correm como utilizador autenticado restrito passarão a ver só os clientes do escopo, que é exatamente o comportamento pretendido.
- Não há código que escreva `whatsapp_logs` para um cliente fora do escopo do utilizador no fluxo normal; a mudança só bloqueia abuso direto.
- Não toco nas policies `_delete` (já são `is_owner_or_admin`) nem em outras tabelas fora do escopo do scanner.

## Entrega

Uma única migração `supabase/migrations/*` que faz `DROP POLICY` + `CREATE POLICY` para cada item acima. Sem alterações de código de aplicação.
