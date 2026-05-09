import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8)
      return toast.error("Senha deve ter ao menos 8 caracteres.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada.");
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthShell title="Definir nova senha" subtitle="Escolha uma senha forte.">
      <form onSubmit={submit} className="space-y-3">
        <Field
          label="Nova senha"
          type="password"
          value={password}
          onChange={setPassword}
          autoFocus
        />
        <button
          disabled={loading}
          className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar nova senha
        </button>
      </form>
    </AuthShell>
  );
}
