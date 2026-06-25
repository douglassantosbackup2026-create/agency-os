import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/retentio")({
  beforeLoad: () => {
    throw redirect({ to: "/agency-opus" });
  },
});
