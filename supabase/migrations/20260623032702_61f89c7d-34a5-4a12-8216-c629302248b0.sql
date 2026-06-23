
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
  where (p_status is null or p_status = '' or s.status = p_status)
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
