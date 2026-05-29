#!/usr/bin/env node
/**
 * TTFB das rotas públicas do funil Diagnóstico Meta.
 * Uso: node scripts/diagnosis-health-check.mjs [--url https://worker.dev]
 */
import { performance } from "node:perf_hooks";

const args = process.argv.slice(2);
const urlIdx = args.indexOf("--url");
const base = (
  urlIdx >= 0
    ? args[urlIdx + 1]
    : process.env.LIGHTHOUSE_BASE_URL ??
      process.env.PUBLIC_SITE_URL ??
      "https://tanstack-start-app.douglaspinheirosantos94.workers.dev"
).replace(/\/$/, "");

const paths = ["/", "/checkout", "/obrigado?d=00000000-0000-4000-8000-000000000000&s=smoke"];

async function measure(path) {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const t0 = performance.now();
  const res = await fetch(url, { redirect: "follow" });
  const ttfb = Math.round(performance.now() - t0);
  return { url, status: res.status, ttfb };
}

async function main() {
  console.log("Diagnosis funnel health —", base, "\n");
  const rows = [];
  for (const p of paths) {
    try {
      rows.push(await measure(p));
    } catch (e) {
      rows.push({ url: p, status: 0, ttfb: -1, error: e.message });
    }
  }
  for (const r of rows) {
    console.log(`${r.status}\t${r.ttfb}ms\t${r.url}`);
    if (r.ttfb > 800) console.warn("  WARN: TTFB > 800ms");
  }
  console.log("\nDoc: docs/diagnostico-performance.md");
}

main();
