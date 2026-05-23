import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

type Props<T> = {
  items: T[];
  /** Altura estimada de cada linha em px (heurística — não precisa ser exato). */
  estimateSize: number;
  /** Limite abaixo do qual a virtualização não é aplicada (overhead não compensa). */
  threshold?: number;
  /** Quantidade de linhas renderizadas além do viewport (para evitar pop-in ao rolar). */
  overscan?: number;
  /** Altura máxima do container virtual (px). Acima desse valor o scroll passa a ser interno. */
  maxHeight?: number;
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
  className?: string;
};

/**
 * Lista virtualizada com fallback automático. Quando `items.length < threshold`,
 * renderiza tudo de uma vez (sem o overhead do virtualizer). Acima disso,
 * usa @tanstack/react-virtual com scroll interno limitado por `maxHeight`.
 */
export function VirtualList<T>({
  items,
  estimateSize,
  threshold = 50,
  overscan = 8,
  maxHeight = 1200,
  renderItem,
  getKey,
  className,
}: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Sempre chama o hook (ordem dos hooks tem que ser estável).
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  if (items.length < threshold) {
    return (
      <div className={className}>
        {items.map((item, i) => (
          <div key={getKey(item, i)}>{renderItem(item, i)}</div>
        ))}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className={className}
      style={{ maxHeight, overflowY: "auto", contain: "strict" }}
    >
      <div style={{ height: totalSize, width: "100%", position: "relative" }}>
        {virtualItems.map((vi) => {
          const item = items[vi.index];
          return (
            <div
              key={getKey(item, vi.index)}
              ref={virtualizer.measureElement}
              data-index={vi.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
              }}
            >
              {renderItem(item, vi.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
