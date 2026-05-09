/** Classes Tailwind partilhadas para filtros (drawer mobile vs barra desktop). */
export const FILTER_SELECT_TRIGGER_CLASSES = {
  /** Select no sheet inferior — controles tocáveis */
  drawer: "h-11 w-full",
  /** Dropdown “Cliente” na barra desktop (ações / alertas) */
  barClient: "h-9 min-w-[160px] max-w-[280px] shrink-0",
  /** `<select>` nativo em painéis laterais (ex.: relatórios) */
  nativeSidebar:
    "h-9 w-full rounded-md border border-border bg-background px-2 text-sm",
} as const;
