/**
 * Login via UI (Supabase) + Lighthouse por URL na mesma página Puppeteer.
 * Requer: LIGHTHOUSE_BASE_URL ou PERF_BASE_URL, PERF_TEST_EMAIL, PERF_TEST_PASSWORD
 * Opcional: PERF_URLS (lista separada por vírgulas de paths, ex. /dashboard,/reports)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import lighthouse, { desktopConfig } from "lighthouse/core/index.js";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "lighthouse-reports");

const DEFAULT_PATHS = [
  "/dashboard",
  "/clients",
  "/reports",
  "/actions",
  "/ai-review",
  "/integrations",
];

function normalizeBase(url) {
  return url.replace(/\/$/, "");
}

function pathToSlug(routePath) {
  const p = routePath.startsWith("/") ? routePath.slice(1) : routePath;
  return p.replace(/\//g, "-") || "root";
}

function scoreFromCategory(cat) {
  if (!cat || typeof cat.score !== "number") return null;
  return Math.round(cat.score * 100);
}

async function ensureLoggedOutFromLogin(page, baseUrl) {
  try {
    await page.goto(`${baseUrl}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  } catch {
    /* primeira tentativa falhou — login pode precisar retry */
  }
}

async function login(page, baseUrl, email, password) {
  await page.setViewport({ width: 1350, height: 900 });

  await ensureLoggedOutFromLogin(page, baseUrl);

  await page.waitForSelector('input[type="email"]', { timeout: 60000 });

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);

  await Promise.all([
    page.waitForFunction(() => !window.location.pathname.startsWith("/login"), {
      timeout: 120000,
    }),
    page.click("form button"),
  ]);
}

async function main() {
  const baseRaw =
    process.env.LIGHTHOUSE_BASE_URL?.trim() ||
    process.env.PERF_BASE_URL?.trim() ||
    "";
  const email = process.env.PERF_TEST_EMAIL?.trim() || "";
  const password = process.env.PERF_TEST_PASSWORD?.trim() || "";

  if (!baseRaw || !email || !password) {
    console.error(
      "Variáveis em falta: defina LIGHTHOUSE_BASE_URL (ou PERF_BASE_URL), PERF_TEST_EMAIL e PERF_TEST_PASSWORD.",
    );
    process.exit(1);
  }

  const baseUrl = normalizeBase(baseRaw);
  const perfUrlsRaw = process.env.PERF_URLS?.trim();
  const paths =
    perfUrlsRaw && perfUrlsRaw.length > 0
      ? perfUrlsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : DEFAULT_PATHS;

  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  });

  const page = await browser.newPage();

  try {
    await login(page, baseUrl, email, password);
  } catch (err) {
    console.error("Falha no login:", err?.message || err);
    await browser.close();
    process.exit(1);
  }

  const summary = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    paths,
    pages: [],
  };

  const lhFlags = {
    logLevel: process.env.LIGHTHOUSE_LOG_LEVEL || "error",
    output: "json",
    disableStorageReset: true,
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
  };

  let hadError = false;

  try {
    for (const routePath of paths) {
      const fullUrl = `${baseUrl}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
      const slug = pathToSlug(
        routePath.startsWith("/") ? routePath : `/${routePath}`,
      );

      try {
        console.error(`Lighthouse: ${fullUrl}`);
        const runnerResult = await lighthouse(
          fullUrl,
          lhFlags,
          desktopConfig,
          page,
        );

        if (!runnerResult?.lhr) {
          throw new Error("Runner sem LHR");
        }

        const { lhr } = runnerResult;
        const outFile = path.join(OUT_DIR, `${slug}.json`);
        await fs.writeFile(outFile, JSON.stringify(lhr, null, 2), "utf8");

        const cats = lhr.categories || {};
        summary.pages.push({
          path: routePath.startsWith("/") ? routePath : `/${routePath}`,
          url: fullUrl,
          performance: scoreFromCategory(cats.performance),
          accessibility: scoreFromCategory(cats.accessibility),
          bestPractices: scoreFromCategory(cats["best-practices"]),
          seo: scoreFromCategory(cats.seo),
        });
      } catch (err) {
        hadError = true;
        console.error(`Erro em ${fullUrl}:`, err?.message || err);
        summary.pages.push({
          path: routePath.startsWith("/") ? routePath : `/${routePath}`,
          url: fullUrl,
          error: String(err?.message || err),
        });
      }
    }
  } finally {
    await browser.close();
  }

  await fs.writeFile(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  console.error(`Relatórios em ${OUT_DIR}`);
  process.exit(hadError ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
