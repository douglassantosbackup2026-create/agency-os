import { memo } from "react";
import { Loader2 } from "lucide-react";
import {
  landingPrimaryCtaClass,
  landingPrimaryCtaLargeClass,
} from "@/lib/landing-ui";
import { cn } from "@/lib/utils";

type DiagnosisCtaProps = {
  label: React.ReactNode;
  sublabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  size?: "default" | "large";
};

function DiagnosisCtaInner({
  label,
  sublabel,
  loading,
  disabled,
  onClick,
  className,
  size = "default",
}: DiagnosisCtaProps) {
  const baseClass =
    size === "large" ? landingPrimaryCtaLargeClass : landingPrimaryCtaClass;

  return (
    <div className={cn("flex flex-col items-stretch gap-2", className)}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={onClick}
        className={cn(baseClass, !sublabel && "flex-row gap-2")}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />A redirecionar…
          </span>
        ) : (
          <>
            <span className="text-center leading-snug">{label}</span>
            {sublabel ? (
              <span className="mt-1 text-center text-xs font-semibold opacity-90 sm:text-sm">
                {sublabel}
              </span>
            ) : null}
          </>
        )}
      </button>
    </div>
  );
}

export const DiagnosisCta = memo(DiagnosisCtaInner);
