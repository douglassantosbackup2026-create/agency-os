import {
  createFileRoute,
  Link,
  useNavigate,
  redirect,
} from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message,
      );
      return;
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthShell
      title="Entrar no Retentio"
      subtitle="Acesse o painel da sua agência"
    >
      <form onSubmit={submit} className="space-y-3">
        <Field
          label="E-mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoFocus
        />
        <Field
          label="Senha"
          type="password"
          value={password}
          onChange={setPassword}
        />
        <Button
          type="submit"
          disabled={loading}
          className="mt-2 h-11 w-full text-sm font-semibold"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </form>
      <div className="mt-4 flex items-center justify-between text-sm">
        <Link
          to="/forgot-password"
          className="text-muted-foreground hover:text-foreground"
        >
          Esqueci minha senha
        </Link>
        <Link to="/signup" className="text-primary hover:underline">
          Criar agência
        </Link>
      </div>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid-bg absolute inset-0 -z-10 opacity-40" />
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <Link to="/retentio" className="mb-8 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-bold">
            R
          </div>
          <span className="font-semibold">Retentio</span>
        </Link>
        <div className="surface-card rounded-2xl border border-border p-6 shadow-xl">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  type = "text",
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        required
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none ring-ring focus:border-primary/60 focus:ring-2"
      />
    </label>
  );
}
