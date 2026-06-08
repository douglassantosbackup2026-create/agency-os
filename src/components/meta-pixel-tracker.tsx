import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { trackMetaPageView, trackRoutePixelEvents } from "@/lib/meta-pixel";

/** Dispara PageView e eventos estáticos por rota em cada navegação SPA. */
export function MetaPixelTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });

  useEffect(() => {
    trackMetaPageView();
    trackRoutePixelEvents(pathname);
  }, [pathname, searchStr]);

  return null;
}
