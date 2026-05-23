import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const dir = path.join(process.cwd(), 'public/landing');
const sizes = [640, 1024, 1600];
const bases = fs.readdirSync(dir)
  .filter(f => f.endsWith('.png'))
  .map(f => f.replace(/\.png$/, ''));

for (const base of bases) {
  const png = path.join(dir, `${base}.png`);
  const meta = await sharp(png).metadata();
  const maxW = meta.width ?? 1600;

  // AVIF full-size
  await sharp(png).avif({ quality: 60, effort: 4 }).toFile(path.join(dir, `${base}.avif`));

  // Responsive variants (avif + webp) — but only sizes <= original width
  for (const w of sizes) {
    if (w >= maxW) continue;
    await sharp(png).resize({ width: w }).avif({ quality: 60, effort: 4 })
      .toFile(path.join(dir, `${base}-${w}.avif`));
    await sharp(png).resize({ width: w }).webp({ quality: 82 })
      .toFile(path.join(dir, `${base}-${w}.webp`));
  }
  console.log('ok', base, `(orig ${maxW}px)`);
}
