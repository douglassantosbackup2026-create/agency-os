import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const [agencyName, setAgencyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { agency_name: agencyName, display_name: name },
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    // try seed automatically
    try {
      await supabase.functions.invoke("seed-demo-data");
    } catch { /* ignore */ }
    setLoading(false);
    toast.success("Agência criada. Bem-vindo ao Retentio.");
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthShell title="Criar sua agência" subtitle="Você cria uma conta de owner com workspace próprio">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nome da agência" value={agencyName} onChange={setAgencyName} autoFocus />
        <Field label="Seu nome" value={name} onChange={setName} />
        <Field label="E-mail" type="email" value={email} onChange={setEmail} />
        <Field label="Senha" type="password" value={password} onChange={setPassword} />
        <button disabled={loading} className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar agência
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Já tem conta? <Link to="/login" className="text-primary hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
