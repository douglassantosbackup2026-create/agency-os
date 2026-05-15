/**
 * Processa screenshots brutos → public/landing/*.webp + *.png + manifest.json
 * Uso: node scripts/process-landing-screenshots.mjs <pasta-com-png-longos>
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const UUID_MAP = [
  { needle: "81756B59", base: "onboarding-config", maxWidth: 1400 },
  { needle: "93AF8741", base: "hero-cockpit-clientes", maxWidth: 1600 },
  { needle: "6CC53EA0", base: "central-acoes", maxWidth: 1400 },
  { needle: "334C3909", base: "central-alertas", maxWidth: 1400 },
  { needle: "35564B04", base: "feed-operacional", maxWidth: 1400 },
  { needle: "815AFCFC", base: "health-score", maxWidth: 1400 },
  { needle: "F024E6D1", base: "relatorios-ia", maxWidth: 1400 },
  { needle: "39E926E8", base: "intel-concorrentes", maxWidth: 1400 },
];

async function main() {
  const sourceDir = process.argv[2];
  if (
    !sourceDir ||
    !fs.statSync(sourceDir, { throwIfNoEntry: false })?.isDirectory()
  ) {
    console.error(
      "Uso: node scripts/process-landing-screenshots.mjs <pasta-com-png>",
    );
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), "public", "landing");
  fs.mkdirSync(outDir, { recursive: true });

  const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith(".png"));
  const manifest = {};

  for (const { needle, base, maxWidth } of UUID_MAP) {
    const srcName = files.find((f) => f.includes(needle));
    if (!srcName) {
      console.warn(`Aviso: não encontrado PNG contendo ${needle}`);
      continue;
    }
    const inputPath = path.join(sourceDir, srcName);
    const resized = () =>
      sharp(inputPath).resize({
        width: maxWidth,
        withoutEnlargement: true,
      });

    const webpPath = path.join(outDir, `${base}.webp`);
    const pngPath = path.join(outDir, `${base}.png`);

    await resized().webp({ quality: 86 }).toFile(webpPath);
    await resized().png({ compressionLevel: 9 }).toFile(pngPath);

    const meta = await sharp(webpPath).metadata();
    manifest[base] = {
      webp: `/landing/${base}.webp`,
      png: `/landing/${base}.png`,
      width: meta.width,
      height: meta.height,
    };
    console.log(`${base}: ${meta.width}x${meta.height}`);
  }

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  console.log("OK → public/landing/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
