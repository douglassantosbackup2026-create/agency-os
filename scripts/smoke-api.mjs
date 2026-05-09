/**
 * Smoke HTTP das Edge Functions públicas (sem imprimir segredos).
 * Uso: node scripts/smoke-api.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
if (!fs.existsSync(envPath)) {
  console.log("API smoke: ignorado (sem .env)");
  process.exit(0);
}

const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 1) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  env[k] = v;
}

const base = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
const key =
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || "";

if (!base || !key) {
  console.log(
    "API smoke: ignorado (faltam VITE_SUPABASE_URL / chave publicável no .env)",
  );
  process.exit(0);
}

const url = `${base}/functions/v1/portal-data?slug=ab`;
const res = await fetch(url, { headers: { apikey: key } });
console.log(
  "API smoke portal-data (slug curto — esperado 4xx cliente): HTTP",
  res.status,
);

if (res.status >= 500) process.exit(1);
if (res.status === 401 || res.status === 403) {
  console.error("Resposta auth inesperada para função pública com apikey.");
  process.exit(1);
}
