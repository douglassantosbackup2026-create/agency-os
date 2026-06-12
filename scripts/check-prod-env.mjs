#!/usr/bin/env node
/** Fail CI/build when production env vars for Supabase are missing. */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const isBuild =
  process.argv.includes("build") ||
  process.env.npm_lifecycle_event === "build";

if (!isBuild) process.exit(0);

// Fallback to .env / .env.example so local + Lovable builds work without
// requiring the env vars to be exported in the shell.
const fileEnv = existsSync(resolve(root, ".env"))
  ? loadEnvFile(resolve(root, ".env"))
  : loadEnvFile(resolve(root, ".env.example"));

const url =
  process.env.VITE_SUPABASE_URL?.trim() || fileEnv.VITE_SUPABASE_URL?.trim();
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!url || !key) {
  console.error(
    "[security] VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórios para npm run build.",
  );
  process.exit(1);
}

console.log("[security] Supabase env vars present for production build.");
