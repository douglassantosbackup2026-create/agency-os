import type { CSSProperties, ElementType, ReactNode } from "react";

export function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="surface-card rounded-xl border border-border p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div
        className={`mt-2 font-mono text-xl font-semibold tabular ${accent ?? ""}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`surface-card rounded-xl border border-border ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {action}
    </div>
  );
}

export function Empty({
  label,
  action,
}: {
  label: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium tabular ${accent ?? ""}`}>
        {value}
      </span>
    </div>
  );
}

export function PriorityDot({ p }: { p: string }) {
  const map: Record<string, string> = {
    critical: "bg-destructive",
    high: "bg-warning",
    medium: "bg-info",
    low: "bg-muted-foreground",
  };
  return (
    <div
      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${map[p] ?? "bg-muted-foreground"}`}
    />
  );
}

export function RiskDot({ risk }: { risk: string }) {
  const map: Record<string, string> = {
    low: "bg-success",
    medium: "bg-warning",
    high: "bg-destructive",
  };
  return (
    <div
      className={`h-2 w-2 shrink-0 rounded-full ${map[risk] ?? "bg-muted-foreground"}`}
    />
  );
}

export function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-2">
      <div
        className={`h-full ${color}`}
        style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
      />
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-surface px-2 py-1 text-xs uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

export function PageSkeleton(props?: {
  preset?: "dashboard" | "compact" | "split";
}) {
  const preset = props?.preset ?? "dashboard";
  if (preset === "compact") {
    return (
      <div className="space-y-4 p-6">
        <div className="space-y-2">
          <Shimmer className="h-7 w-48" />
          <Shimmer className="h-3 w-72" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer
              key={i}
              className="h-36 rounded-xl"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (preset === "split") {
    return (
      <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3 border-r border-border p-4">
          <Shimmer className="h-9 w-full rounded-md" />
          <Shimmer className="h-20 w-full rounded-lg" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Shimmer key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
        <div className="space-y-4 p-6">
          <Shimmer className="h-9 w-2/3 max-w-md" />
          <Shimmer className="min-h-[280px] w-full rounded-xl" />
          <Shimmer className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <Shimmer className="h-7 w-48" />
        <Shimmer className="h-3 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer
            key={i}
            className="h-20 rounded-xl"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Shimmer
          className="h-80 rounded-xl lg:col-span-2"
          style={{ animationDelay: "120ms" }}
        />
        <Shimmer
          className="h-80 rounded-xl"
          style={{ animationDelay: "180ms" }}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Shimmer
          className="h-48 rounded-xl"
          style={{ animationDelay: "240ms" }}
        />
        <Shimmer
          className="h-48 rounded-xl"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}

export function Shimmer({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-surface ${className}`}
      style={style}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-foreground/[0.04] to-transparent" />
    </div>
  );
}
