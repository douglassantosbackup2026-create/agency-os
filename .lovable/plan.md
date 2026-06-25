## Objetivo
Adicionar um botão de alternância de tema (dark/light) no header da landing do diagnóstico, removendo o `dark` forçado para que o header acompanhe o tema do restante do site.

## Mudanças

**`src/components/diagnosis-landing/diagnosis-landing-header.tsx`**
- Remover a classe `dark` fixa do `<header>`, mantendo apenas `sticky top-0 ...` com tokens semânticos (já usam `bg-background/85`, `text-foreground`, etc., então funcionam em ambos os modos).
- Inserir um botão de toggle de tema (ícone `Sun`/`Moon` do `lucide-react`) ao lado do CTA "R$ 37".
- O botão usa os helpers existentes em `src/lib/theme.ts`:
  - `useSyncExternalStore` com `subscribeTheme` + `getSnapshotTheme` para refletir o tema atual.
  - `toggleTheme()` no `onClick`.
- Acessibilidade: `aria-label` dinâmico ("Ativar modo claro" / "Ativar modo escuro"), `type="button"`, foco visível via classes já padronizadas.

## Notas técnicas
- Não é preciso criar um novo componente: o toggle fica inline no header (≈15 linhas). Caso já exista um `ThemeToggle` em `src/components/`, reaproveitamos em vez de duplicar — verificarei na fase de build.
- Nenhuma mudança em `styles.css`, conteúdo ou outros componentes da landing.
- O restante da página já é neutra a tema (usa tokens), então remover o `dark` forçado no header não quebra contraste.
