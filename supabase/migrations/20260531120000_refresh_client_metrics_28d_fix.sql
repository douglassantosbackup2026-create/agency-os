-- Corrige refresh_client_metrics_28d: refresh global documentado; sync não força refresh por cliente.

CREATE OR REPLACE FUNCTION public.refresh_client_metrics_28d(p_client_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- MV não suporta refresh parcial por linha; p_client_id reservado para evolução (tabela snap).
  -- Cron noturno: refresh_client_metrics_28d(NULL).
  PERFORM 1;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_metrics_28d;
END;
$$;

COMMENT ON FUNCTION public.refresh_client_metrics_28d(uuid) IS
  'Atualiza client_metrics_28d (refresh concurrent global). p_client_id ignorado até migração para tabela snap.';
