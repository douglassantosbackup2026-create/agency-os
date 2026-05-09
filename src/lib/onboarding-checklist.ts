export const ONBOARDING_CHECKLIST_STEPS = [
  {
    key: "platform_access",
    title: "Solicitar acessos às plataformas",
    impact:
      "Depois disto: imports e sync passam a trazer dados reais para alertas e cockpit.",
  },
  {
    key: "budget_goal",
    title: "Configurar budget e meta do cliente",
    impact:
      "Depois disto: pacing e alertas de orçamento passam a ter referência correta.",
  },
  {
    key: "portal_sent",
    title: "Enviar link do portal ao cliente",
    impact: "Depois disto: cliente vê valor no portal e reduz churn percetivo.",
  },
  {
    key: "first_report",
    title: "Gerar primeiro relatório IA",
    impact:
      "Depois disto: tens artefacto de valor para reunião e registo no histórico.",
  },
  {
    key: "diagnostic_run",
    title: "Diagnóstico inicial de saúde da carteira",
    impact:
      "Depois disto: Health Score e priorização ficam acionáveis na operação.",
  },
] as const;

export type OnboardingStepKey =
  (typeof ONBOARDING_CHECKLIST_STEPS)[number]["key"];

export const ONBOARDING_STEP_KEYS: readonly OnboardingStepKey[] =
  ONBOARDING_CHECKLIST_STEPS.map((s) => s.key);
