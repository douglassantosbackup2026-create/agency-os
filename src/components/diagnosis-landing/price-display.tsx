import { memo } from "react";
import { PRICE_ANCHOR_LABEL, PRICE_LABEL } from "@/content/diagnosis-landing";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  anchorClassName?: string;
  uppercase?: boolean;
};

function PriceDisplayInner({ className, anchorClassName, uppercase }: Props) {
  const de = uppercase ? "DE" : "de";
  const por = uppercase ? "POR" : "por";
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span>{de}</span>
      <span className={cn("line-through opacity-70", anchorClassName)}>
        {PRICE_ANCHOR_LABEL}
      </span>
      <span>{por}</span>
      <span>{PRICE_LABEL}</span>
    </span>
  );
}

export const PriceDisplay = memo(PriceDisplayInner);
