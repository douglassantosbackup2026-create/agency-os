import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/gestao-trafego",
      search: location.search,
    });
  },
});
