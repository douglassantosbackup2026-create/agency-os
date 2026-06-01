export type PresentationNavItem = {
  id: string;
  label: string;
};

type Props = {
  items: PresentationNavItem[];
};

export function DiagnosisPresentationNav({ items }: Props) {
  if (items.length < 2) return null;

  return (
    <nav className="presentation-toc no-print" aria-label="Índice da apresentação">
      {items.map((it) => (
        <a key={it.id} href={`#${it.id}`} className="presentation-toc-link">
          {it.label}
        </a>
      ))}
    </nav>
  );
}
