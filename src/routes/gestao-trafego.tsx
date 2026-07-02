import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/gestao-trafego")({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/",
      search: location.search,
    });
  },
});
