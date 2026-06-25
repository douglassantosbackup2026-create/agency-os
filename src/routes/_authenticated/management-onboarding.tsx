import { createFileRoute } from "@tanstack/react-router";
import { ManagementOnboardingQueue } from "@/components/management/ManagementOnboardingQueue";

export const Route = createFileRoute("/_authenticated/management-onboarding")({
  component: ManagementOnboardingPage,
});

function ManagementOnboardingPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Onboarding gestão R$ 1.997</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fila operacional pós-pagamento — provisionar clientes no cockpit em 1
          clique.
        </p>
      </div>
      <ManagementOnboardingQueue limit={50} />
    </div>
  );
}
