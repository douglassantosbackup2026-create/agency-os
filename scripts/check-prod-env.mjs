#!/usr/bin/env node
/** Fail CI/build when production env vars for Supabase are missing. */
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const isBuild =
  process.argv.includes("build") ||
  process.env.npm_lifecycle_event === "build";

if (!isBuild) process.exit(0);

const url = process.env.VITE_SUPABASE_URL?.trim();
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!url || !key) {
  console.error(
    "[security] VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórios para npm run build.",
  );
  process.exit(1);
}

console.log("[security] Supabase env vars present for production build.");
