import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader } from "./dashboard";
import {
  ArrowRight,
  ExternalLink,
  Plug,
  Sparkles,
  UserPlus,
  Loader2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { agency } = useAuth();
  const slugHint = agency?.slug
    ? `/p/${agency.slug}`
    : "/p/seu-slug-do-cliente";

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  async function sendInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Informe o email.");
      return;
    }
    setInviting(true);
    const { error } = await supabase.functions.invoke("invite-member", {
      body: { email: inviteEmail.trim(), role: inviteRole },
    });
    setInviting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Convite enviado ou role atualizado.");
      setInviteEmail("");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Configuração inicial
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Você já pode usar o Retentio — estes passos deixam o workspace pronto
          para o time e para o cliente final.
        </p>
      </header>

      <Card>
        <CardHeader title="1. Marca & portal" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Defina nome, logo e cor primária para o painel white-label e para o
            portal público do cliente.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            Abrir configurações <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="2. Portal do cliente" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Cada cliente pode ter um{" "}
            <code className="rounded bg-surface px-1 font-mono text-xs">
              portal_slug
            </code>{" "}
            na ficha. O link público segue o formato{" "}
            <code className="rounded bg-surface px-1 font-mono text-xs">
              {slugHint}
            </code>
            .
          </p>
          <Link
            to="/clients"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            Gerenciar clientes <ExternalLink className="h-3 w-3 opacity-70" />
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="3. Convide o time" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Apenas perfis owner/admin conseguem concluir o convite. Em caso de
            erro, faça pela área Admin.
          </p>
          <form
            onSubmit={sendInvite}
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          >
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@equipe.com"
              className="h-10 min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Enviar convite
            </button>
          </form>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Abrir área administrativa para gestão de membros →
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="4. Integrações & dados reais" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Conecte Meta Ads ou Google Analytics com token válido para preencher
            métricas reais — ou use apenas sync simulado para demos.
          </p>
          <Link
            to="/integrations"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <Plug className="h-3.5 w-3.5" />
            Integrações e sincronização
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="5. Explorar com dados demo" />
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Gere métricas e alertas fictícios para validar dashboards e
            automações.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            Ir ao dashboard <Sparkles className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
