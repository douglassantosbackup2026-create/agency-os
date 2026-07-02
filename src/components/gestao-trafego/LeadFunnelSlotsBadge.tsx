import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLeadSlotsBadge } from "@/content/gestao-lead-slots";

type LeadFunnelSlotsBadgeProps = {
  available: number;
  variant?: "inline" | "banner";
  loading?: boolean;
  className?: string;
};

export function LeadFunnelSlotsBadge({
  available,
  variant = "inline",
  loading = false,
  className,
}: LeadFunnelSlotsBadgeProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-full bg-muted px-3 py-1 text-xs",
          variant === "banner" ? "mb-4 h-9 w-full max-w-sm mx-auto" : "h-7 w-40",
          className,
        )}
      />
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "mb-4 flex items-center justify-center gap-2 rounded-lg border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-3 py-2",
          className,
        )}
      >
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
            available <= 0
              ? "bg-muted text-muted-foreground"
              : "bg-destructive/15 text-destructive",
          )}
        >
          {available > 0 ? <Flame className="h-3.5 w-3.5" /> : null}
          {formatLeadSlotsBadge(available)}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
          available <= 0
            ? "bg-muted text-muted-foreground"
            : "bg-destructive/15 text-destructive",
        )}
      >
        {available > 0 ? <Flame className="h-3.5 w-3.5" /> : null}
        {formatLeadSlotsBadge(available)}
      </span>
    </div>
  );
}
