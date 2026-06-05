import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { reportFunnelError } from "@/lib/report-error";

type Props = { children: ReactNode };

type State = { hasError: boolean; message: string; retryKey: number };

function obrigadoHrefFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const d = params.get("d")?.trim();
  const s = params.get("s")?.trim();
  if (!d || !s) return null;
  return `/obrigado?d=${encodeURIComponent(d)}&s=${encodeURIComponent(s)}`;
}

export class DiagnosisFunnelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "", retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportFunnelError("diagnosis.funnel_boundary", {
      error,
      componentStack: info.componentStack,
    });
  }

  private retry = (): void => {
    this.setState((s) => ({
      hasError: false,
      message: "",
      retryKey: s.retryKey + 1,
    }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const statusHref = obrigadoHrefFromLocation();
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold">
              Erro ao mostrar esta página do diagnóstico
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.message ||
                "Ocorreu um problema inesperado. Pode tentar novamente ou voltar ao início."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button type="button" className="h-11 px-6" onClick={this.retry}>
                Tentar novamente
              </Button>
              {statusHref ? (
                <Button variant="outline" asChild className="h-11">
                  <Link to={statusHref}>Status do pedido</Link>
                </Button>
              ) : null}
              <Button variant="outline" asChild className="h-11">
                <Link to="/">Início</Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div key={this.state.retryKey}>{this.props.children}</div>
    );
  }
}
