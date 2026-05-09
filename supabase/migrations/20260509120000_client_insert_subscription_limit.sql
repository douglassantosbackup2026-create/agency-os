-- Reforço: só membros autentificados ficam impedidos quando o limite de clientes chega ao teto da subscrição.
-- Inserções com service_role continuam sem RLS (ex.: ferramentas internas).

DROP POLICY IF EXISTS clients_insert ON public.clients;

CREATE POLICY clients_insert ON public.clients
  FOR INSERT
  WITH CHECK (
    public.is_member_of(agency_id)
    AND (
      SELECT COUNT(*)::int FROM public.clients c WHERE c.agency_id = agency_id
    ) < COALESCE(
      (
        SELECT s.max_clients
        FROM public.subscriptions s
        WHERE s.agency_id = agency_id
        LIMIT 1
      ),
      5
    )
  );
