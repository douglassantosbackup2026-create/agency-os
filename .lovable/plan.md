## Objetivo

Adicionar abas no `/platform-admin` para visualizar compradores do diagnóstico (R$ 37 one-shot) e assinantes da gestão de tráfego (recorrente), com PII completo (nome, e-mail, telefone, CPF) restrito a `is_platform_admin`.

## Layout final da página `/platform-admin`

Tabs no topo da página, abaixo do header "Administração da plataforma":

```text
[ Visão geral ] [ Funil Diagnóstico ] [ Compradores Diagnóstico ] [ Assinantes Gestão ]
```

- **Visão geral**: o que já existe hoje (KPIs de agências, lista de agências, integrações OAuth, referência).
- **Funil Diagnóstico**: a seção `PlatformDiagnosisSection` atual, intacta.
- **Compradores Diagnóstico** (nova): todos que pagaram R$ 37, com PII completo.
- **Assinantes Gestão** (nova): só quem ativou a gestão recorrente, com foco em MRR e status no Mercado Pago.

## Aba "Compradores Diagnóstico"

KPIs no topo:
- Total de compradores (histórico)
- Pagantes nos últimos 7 / 30 dias
- Receita 30d (soma `amount_cents`)
- % que converteu para gestão

Tabela paginada (50/página), busca por nome/e-mail/CPF, filtro por período:

| Coluna | Origem |
|---|---|
| Pago em | `diagnoses` (derivado: created_at do pagamento aprovado) |
| Nome | `payer_name` |
| E-mail | `payer_email` |
| Telefone | `payer_phone` |
| CPF | `payer_cpf` |
| Método | `payment_method` |
| Valor | `amount_cents` |
| Status diagnóstico | `status` |
| Virou gestão? | `management_status = 'paid'` → badge "Sim" |
| Ações | Link QA do relatório, copiar WhatsApp |

## Aba "Assinantes Gestão"

KPIs:
- Assinantes ativos (`management_subscriptions.status = 'authorized'`)
- MRR (soma `amount_cents` dos ativos)
- Novos no mês
- Cancelados no mês

Tabela:

| Coluna | Origem |
|---|---|
| Ativada em | `management_paid_at` |
| Nome | `payer_name` |
| E-mail | `payer_email` |
| Telefone | `payer_phone` |
| CPF | `payer_cpf` |
| Negócio | `management_business_name` |
| Website / IG | `management_website`, `management_instagram` |
| Valor mensal | `management_subscriptions.amount_cents` |
| Cartão | `card_last4` |
| Próxima cobrança | `next_payment_date` |
| Última cobrança | `last_charge_at` + `last_charge_status` |
| Status MP | `management_subscriptions.status` (authorized / paused / cancelled) |
| Ações | Cancelar (reutiliza `cancel-management-subscription`), copiar WhatsApp, ver charges |

## Detalhes técnicos

### Migration

Duas novas RPCs `security definer` que checam `auth_is_platform_admin()` e retornam PII completo:

```sql
create or replace function public.platform_diagnosis_buyers_list(
  p_limit int default 50,
  p_offset int default 0,
  p_search text default null,
  p_since timestamptz default null
) returns table (
  id uuid, created_at timestamptz, status text, secret_slug text,
  payer_name text, payer_email text, payer_phone text, payer_cpf text,
  payment_method text, amount_cents int,
  management_status text, management_paid_at timestamptz,
  completed_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.auth_is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select d.id, d.created_at, d.status, d.secret_slug,
         d.payer_name, d.payer_email, d.payer_phone, d.payer_cpf,
         d.payment_method, d.amount_cents,
         d.management_status, d.management_paid_at, d.completed_at
  from public.diagnoses d
  where d.payer_email is not null
    and (p_since is null or d.created_at >= p_since)
    and (
      p_search is null or p_search = '' or
      d.payer_email ilike '%'||p_search||'%' or
      d.payer_name  ilike '%'||p_search||'%' or
      d.payer_cpf   ilike '%'||p_search||'%'
    )
  order by d.created_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
end; $$;

create or replace function public.platform_management_subscribers_list(
  p_limit int default 50,
  p_offset int default 0,
  p_search text default null,
  p_status text default null
) returns table (
  diagnosis_id uuid, subscription_id uuid,
  management_paid_at timestamptz,
  payer_name text, payer_email text, payer_phone text, payer_cpf text,
  business_name text, website text, instagram text,
  amount_cents int, card_last4 text,
  sub_status text, next_payment_date timestamptz,
  last_charge_at timestamptz, last_charge_status text,
  cancelled_at timestamptz, mp_preapproval_id text
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.auth_is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select d.id, s.id,
         d.management_paid_at,
         d.payer_name, d.payer_email, d.payer_phone, d.payer_cpf,
         d.management_business_name, d.management_website, d.management_instagram,
         s.amount_cents, s.card_last4,
         s.status, s.next_payment_date,
         s.last_charge_at, s.last_charge_status,
         s.cancelled_at, s.mp_preapproval_id
  from public.management_subscriptions s
  join public.diagnoses d on d.id = s.diagnosis_id
  where (p_status is null or s.status = p_status)
    and (
      p_search is null or p_search = '' or
      d.payer_email ilike '%'||p_search||'%' or
      d.payer_name  ilike '%'||p_search||'%' or
      d.payer_cpf   ilike '%'||p_search||'%' or
      d.management_business_name ilike '%'||p_search||'%'
    )
  order by d.management_paid_at desc nulls last
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
end; $$;

create or replace function public.platform_management_subscribers_kpis()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.auth_is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'active_count', count(*) filter (where status='authorized'),
    'mrr_cents', coalesce(sum(amount_cents) filter (where status='authorized'),0),
    'new_this_month', count(*) filter (where created_at >= date_trunc('month', now())),
    'cancelled_this_month', count(*) filter (where cancelled_at >= date_trunc('month', now()))
  ) into v from public.management_subscriptions;
  return v;
end; $$;

grant execute on function public.platform_diagnosis_buyers_list(int,int,text,timestamptz) to authenticated;
grant execute on function public.platform_management_subscribers_list(int,int,text,text) to authenticated;
grant execute on function public.platform_management_subscribers_kpis() to authenticated;
```

Acesso é controlado pela checagem `auth_is_platform_admin()` dentro de cada função — não há grant a `anon`.

### Frontend

1. **`src/routes/_authenticated/platform-admin.tsx`** — embrulhar o conteúdo atual em `<Tabs>` do shadcn com 4 `TabsTrigger`. Conteúdo atual (overview/agencies/oauth + `<PlatformDiagnosisSection />`) vai para as duas primeiras abas.

2. **`src/components/platform-admin/PlatformDiagnosisBuyers.tsx`** (novo) — KPIs + tabela com busca, paginação e filtro de período. Usa `supabase.rpc('platform_diagnosis_buyers_list', ...)`. Botão "Copiar WhatsApp" formata `https://wa.me/55<phone>?text=...`. Botão "QA" abre `/diagnostico/{id}?s={secret}`.

3. **`src/components/platform-admin/PlatformManagementSubscribers.tsx`** (novo) — KPIs (RPC `platform_management_subscribers_kpis`) + tabela (`platform_management_subscribers_list`) com filtro de status (authorized/paused/cancelled), busca, paginação. Botão "Cancelar gestão" reutiliza `cancel-management-subscription` (mesmo fluxo já existente em `PlatformDiagnosisSection`).

4. **`src/lib/platform-admin-buyers.ts`** (novo) — tipos `DiagnosisBuyerRow`, `ManagementSubscriberRow`, helpers `centsToBrl`, `formatCpf`, `formatPhoneBR`, `subscriptionStatusLabel`.

Nenhuma alteração em `meta-pixel.ts`, checkout, ou lógica de pagamento. `PlatformDiagnosisSection` permanece inalterado (continua com e-mail mascarado pois é a visão operacional do funil).

## Fora de escopo

- Export CSV (pode ser adicionado depois se pedir)
- Detalhe drill-down de cada comprador
- Histórico de charges (`management_subscription_charges`) — só mostra última cobrança agregada

## Risco

- PII completo na UI: mitigado por `auth_is_platform_admin()` server-side; o front também já está sob `_authenticated` + redirect se não for platform admin.
- LGPD: registrar nos termos que platform admin tem acesso a dados de cliente para suporte (provavelmente já coberto).
