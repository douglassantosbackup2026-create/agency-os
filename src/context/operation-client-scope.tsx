/* eslint-disable react-refresh/only-export-components -- context + provider para escopo de carteira */
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "retentio-operation-client-id";

function readStored(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v !== "" ? v : null;
  } catch {
    return null;
  }
}

function writeStored(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export type OperationClientScopeValue = {
  clientId: string | null;
  setClientId: (id: string | null) => void;
};

export const OperationClientScopeContext =
  createContext<OperationClientScopeValue | null>(null);

export function OperationClientScopeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [clientId, setClientIdState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readStored(),
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setClientIdState(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /** Primeira carga: ?client=uuid quando não há valor guardado. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (readStored()) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const c = params.get("client");
      if (c && /^[0-9a-f-]{36}$/i.test(c)) {
        setClientIdState(c);
        writeStored(c);
      }
    } catch {
      // ignore
    }
  }, []);

  const setClientId = useCallback((id: string | null) => {
    setClientIdState(id);
    writeStored(id);
  }, []);

  const value = useMemo(
    () => ({ clientId, setClientId }),
    [clientId, setClientId],
  );

  return (
    <OperationClientScopeContext.Provider value={value}>
      {children}
    </OperationClientScopeContext.Provider>
  );
}
