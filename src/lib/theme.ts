export const THEME_STORAGE_KEY = "theme";

export type ThemeMode = "light" | "dark";

export function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** Snapshot: classe `dark` no elemento raiz (após script inicial ou setTheme). */
export function getSnapshotTheme(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("retentio-theme"));
}

export function toggleTheme() {
  setTheme(getSnapshotTheme() === "dark" ? "light" : "dark");
}

export function subscribeTheme(onStoreChange: () => void) {
  const handler = () => onStoreChange();
  window.addEventListener("retentio-theme", handler);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMq = () => {
    if (getStoredTheme() === null) {
      if (mq.matches) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      onStoreChange();
    }
  };
  mq.addEventListener("change", onMq);
  return () => {
    window.removeEventListener("retentio-theme", handler);
    mq.removeEventListener("change", onMq);
  };
}
