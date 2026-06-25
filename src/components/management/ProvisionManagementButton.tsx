import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCanProvisionManagement } from "@/hooks/use-management-funnel-access";

const MEMBER_TOOLTIP =
  "Apenas owner ou admin da agência do funil pode provisionar clientes.";

export function ProvisionManagementButton({
  loading,
  disabled,
  onClick,
  size = "sm",
  className,
}: {
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  size?: "sm" | "default";
  className?: string;
}) {
  const { data: canProvision, isLoading: permLoading } =
    useCanProvisionManagement();
  const blocked = !permLoading && canProvision === false;
  const btn = (
    <Button
      type="button"
      size={size}
      className={className}
      disabled={loading || disabled || permLoading || blocked}
      onClick={onClick}
    >
      {loading ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : (
        <UserPlus className="mr-1 h-3 w-3" />
      )}
      Provisionar
    </Button>
  );

  if (!blocked) return btn;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{btn}</span>
        </TooltipTrigger>
        <TooltipContent>{MEMBER_TOOLTIP}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
