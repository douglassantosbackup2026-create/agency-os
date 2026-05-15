import { hero } from "@/content/diagnosis-landing";
import { landingPrimaryCtaClass } from "@/lib/landing-ui";
import { cn } from "@/lib/utils";

type Props = {
  onCheckout: () => void;
  loading: boolean;
};

export function DiagnosisStickyCta({ onCheckout, loading }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex gap-2 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 dark:shadow-[0_-8px_30px_rgba(0,0,0,0.35)] sm:hidden">
      <button
        type="button"
        disabled={loading}
        onClick={onCheckout}
        className={cn(landingPrimaryCtaClass, "flex-1")}
      >
        {loading ? "A redirecionar…" : hero.stickyCtaLabel}
      </button>
    </div>
  );
}
