import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function FilterDrawer({
  open,
  onOpenChange,
  title,
  trigger,
  children,
  applyLabel = "Aplicar e fechar",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  applyLabel?: string;
}) {
  return (
    <>
      <div className="flex md:hidden">{trigger}</div>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[90vh] flex-col gap-0 p-0"
        >
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
            {children}
            <Button
              type="button"
              className="h-11 w-full"
              onClick={() => onOpenChange(false)}
            >
              {applyLabel}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
