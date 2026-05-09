import { Button } from "@/components/ui/button";

export function QueryErrorState({
  title = "Não foi possível carregar os dados",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button type="button" className="h-11 px-6" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
