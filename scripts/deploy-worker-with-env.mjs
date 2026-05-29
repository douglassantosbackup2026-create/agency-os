#!/usr/bin/env node
/**
 * Build + wrangler deploy com variáveis Supabase (lê .env ou .env.example).
 * Uso: node scripts/deploy-worker-with-env.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
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

const envPath = existsSync(resolve(root, ".env"))
  ? resolve(root, ".env")
  : resolve(root, ".env.example");
const fileEnv = loadEnvFile(envPath);
const merged = { ...fileEnv, ...process.env };

const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
];

const optionalSite =
  merged.VITE_PUBLIC_SITE_URL?.trim() ||
  merged.PUBLIC_SITE_URL?.trim() ||
  "https://tanstack-start-app.douglaspinheirosantos94.workers.dev";
for (const k of required) {
  if (!merged[k]?.trim()) {
    console.error(`Missing ${k} in ${envPath}`);
    process.exit(1);
  }
}
if (!merged.SUPABASE_URL) merged.SUPABASE_URL = merged.VITE_SUPABASE_URL;
if (!merged.SUPABASE_PUBLISHABLE_KEY) {
  merged.SUPABASE_PUBLISHABLE_KEY = merged.VITE_SUPABASE_PUBLISHABLE_KEY;
}

console.log("Using env from:", envPath);
console.log("Building…");
const build = spawnSync("npm", ["run", "build"], {
  cwd: root,
  stdio: "inherit",
  env: merged,
  shell: true,
});
if (build.status !== 0) process.exit(build.status ?? 1);

const varArgs = [
  ...required.flatMap((k) => ["--var", `${k}:${merged[k]}`]),
  "--var",
  `VITE_PUBLIC_SITE_URL:${optionalSite}`,
];
console.log("Deploying Worker with runtime vars…");
const deploy = spawnSync(
  "npx",
  ["wrangler", "deploy", ...varArgs],
  { cwd: root, stdio: "inherit", env: merged, shell: true },
);
process.exit(deploy.status ?? 1);
