#!/usr/bin/env node
/**
 * Verificações operacionais de resiliência (local ou CI).
 * Uso: node scripts/resilience-health-check.mjs [--url https://worker.dev/login]
 */

const args = process.argv.slice(2);
const urlIdx = args.indexOf("--url");
const targetUrl = urlIdx >= 0 ? args[urlIdx + 1] : null;

async function measureTtfb(url) {
  const t0 = performance.now();
  const res = await fetch(url, { redirect: "follow" });
  const ttfb = Math.round(performance.now() - t0);
  return { status: res.status, ttfb };
}

async function main() {
  console.log("Resilience health check\n");

  if (targetUrl) {
    try {
      const { status, ttfb } = await measureTtfb(targetUrl);
      console.log(`GET ${targetUrl}`);
      console.log(`  status: ${status}`);
      console.log(`  time_to_first_byte_ms: ${ttfb}`);
      if (ttfb > 800) {
        console.warn("  WARN: TTFB > 800ms (meta do plano de resiliência)");
      }
    } catch (e) {
      console.error("Fetch failed:", e.message);
      process.exitCode = 1;
    }
  } else {
    console.log("Passe --url para medir TTFB de uma rota.");
  }

  console.log("\nSQL remoto: SELECT public.get_resilience_ops_snapshot();");
  console.log("Lighthouse: npm run perf:lighthouse");
  console.log("Doc: docs/ops-performance-validation.md");
}

main();
