UPDATE public.diagnoses
SET status = 'processing',
    failed_reason = NULL,
    updated_at = now()
WHERE id = '7e8e3d16-306f-4960-ace3-56de6a3f0b6a';

-- Limpa o facts_json antigo para forçar refetch completo (objective vinha vazio no sample cacheado)
UPDATE public.diagnosis_reports
SET facts_json = NULL,
    analysis_json = NULL,
    updated_at = now()
WHERE diagnosis_id = '7e8e3d16-306f-4960-ace3-56de6a3f0b6a';