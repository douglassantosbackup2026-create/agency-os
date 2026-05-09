DROP POLICY IF EXISTS agencies_insert ON public.agencies;
CREATE POLICY agencies_insert ON public.agencies FOR INSERT
  WITH CHECK (false);