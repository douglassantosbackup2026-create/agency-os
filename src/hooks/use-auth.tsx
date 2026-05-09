import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AgencyContext = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
} | null;

type AuthCtx = {
  session: Session | null;
  user: User | null;
  agency: AgencyContext;
  /** Mensagem quando o carregamento da agência falhou (rede/PostgREST), não confundir com «sem agência». */
  agencyLoadError: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAgency: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [agency, setAgency] = useState<AgencyContext>(null);
  const [agencyLoadError, setAgencyLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAgency = async (userId: string) => {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "agency_id, agencies:agency_id(id, name, slug, logo_url, primary_color)",
      )
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      setAgencyLoadError(error.message);
      setAgency(null);
      return;
    }
    setAgencyLoadError(null);
    setAgency(
      (profile as unknown as { agencies: AgencyContext })?.agencies ?? null,
    );
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadAgency(s.user.id), 0);
      } else {
        setAgency(null);
        setAgencyLoadError(null);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        if (data.session?.user) {
          loadAgency(data.session.user.id).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    agency,
    agencyLoadError,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshAgency: async () => {
      if (session?.user) await loadAgency(session.user.id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
