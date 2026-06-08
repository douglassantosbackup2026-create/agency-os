export function gestaoCheckoutSearch(params: {
  diagnosisId: string;
  secretSlug: string;
  gapFormatted?: string | null;
}): { d: string; s: string; gap?: string } {
  return {
    d: params.diagnosisId,
    s: params.secretSlug,
    ...(params.gapFormatted ? { gap: params.gapFormatted } : {}),
  };
}
