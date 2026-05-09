import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/report-error";

type Props = { children: ReactNode };

type State = { hasError: boolean; message: string };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError("AppErrorBoundary", {
      error,
      componentStack: info.componentStack,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold">Algo deu errado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.message}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                className="h-11 px-6"
                onClick={() =>
                  this.setState({ hasError: false, message: "" })
                }
              >
                Tentar novamente
              </Button>
              <Button variant="outline" asChild className="h-11">
                <Link to="/">Início</Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
