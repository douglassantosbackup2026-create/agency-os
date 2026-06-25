-- Rebrand: agência operadora do funil → Agency Opus
UPDATE public.agencies
SET name = 'Agency Opus',
    slug = 'agency-opus'
WHERE id = (
  SELECT diagnosis_funnel_agency_id
  FROM public.retentio_ops_config
  WHERE id = 1
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.agencies
  WHERE slug = 'agency-opus'
    AND id <> (
      SELECT diagnosis_funnel_agency_id
      FROM public.retentio_ops_config
      WHERE id = 1
      LIMIT 1
    )
);

-- Se slug já estiver ocupado por outra agência, atualiza só o nome
UPDATE public.agencies
SET name = 'Agency Opus'
WHERE id = (
  SELECT diagnosis_funnel_agency_id
  FROM public.retentio_ops_config
  WHERE id = 1
  LIMIT 1
)
AND EXISTS (
  SELECT 1 FROM public.agencies
  WHERE slug = 'agency-opus'
    AND id <> (
      SELECT diagnosis_funnel_agency_id
      FROM public.retentio_ops_config
      WHERE id = 1
      LIMIT 1
    )
);
