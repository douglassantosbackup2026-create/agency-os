export const ONBOARDING_CHECKLIST_STEPS = [
  { key: "platform_access", title: "Solicitar acessos às plataformas" },
  { key: "budget_goal", title: "Configurar budget e meta do cliente" },
  { key: "portal_sent", title: "Enviar link do portal ao cliente" },
  { key: "first_report", title: "Gerar primeiro relatório IA" },
  {
    key: "diagnostic_run",
    title: "Diagnóstico inicial de saúde da carteira",
  },
] as const;

export type OnboardingStepKey =
  (typeof ONBOARDING_CHECKLIST_STEPS)[number]["key"];

export const ONBOARDING_STEP_KEYS: readonly OnboardingStepKey[] =
  ONBOARDING_CHECKLIST_STEPS.map((s) => s.key);
