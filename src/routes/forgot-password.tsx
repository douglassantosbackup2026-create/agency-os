import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
  }

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Enviaremos um link para seu e-mail."
    >
      {sent ? (
        <div className="space-y-3 text-sm">
          <p>
            Se existe uma conta para{" "}
            <span className="font-medium">{email}</span>, você receberá um link
            em instantes.
          </p>
          <Link
            to="/login"
            className="inline-block text-primary hover:underline"
          >
            Voltar ao login
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Field
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
            autoFocus
          />
          <button
            disabled={loading}
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar link
          </button>
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              Voltar ao login
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
