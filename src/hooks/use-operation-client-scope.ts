import { useContext } from "react";
import {
  OperationClientScopeContext,
  type OperationClientScopeValue,
} from "@/context/operation-client-scope";

export function useOperationClientScope(): OperationClientScopeValue {
  const ctx = useContext(OperationClientScopeContext);
  if (!ctx) {
    throw new Error(
      "useOperationClientScope deve estar dentro de OperationClientScopeProvider",
    );
  }
  return ctx;
}
