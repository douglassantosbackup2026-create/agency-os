#!/usr/bin/env node
/** CI guard: production deploy scripts must not enable Meta test harness. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const scriptsDir = "scripts";
const offenders = [];

for (const name of readdirSync(scriptsDir)) {
  if (!name.endsWith(".mjs") && !name.endsWith(".sh")) continue;
  const path = join(scriptsDir, name);
  const text = readFileSync(path, "utf8");
  if (/META_TEST_ENABLED[^\n]*['"]true['"]/i.test(text)) {
    offenders.push(path);
  }
}

if (offenders.length > 0) {
  console.error(
    "[security] Deploy scripts must not set META_TEST_ENABLED=true:",
    offenders.join(", "),
  );
  process.exit(1);
}

console.log("[security] Deploy scripts OK (META_TEST_ENABLED not forced on).");
