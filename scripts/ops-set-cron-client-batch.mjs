#!/usr/bin/env node
/**
 * Define CRON_CLIENT_BATCH_SIZE nas Edge Functions (Supabase CLI).
 * Uso: node scripts/ops-set-cron-client-batch.mjs [tamanho]
 * Default: 25
 */
import { spawnSync } from "node:child_process";

const size = process.argv[2] ?? "25";
const r = spawnSync(
  "npx",
  ["supabase", "secrets", "set", `CRON_CLIENT_BATCH_SIZE=${size}`, "--project-ref", "uvuotaxikuxejfeitlaw"],
  { stdio: "inherit", shell: true },
);
process.exit(r.status ?? 1);
