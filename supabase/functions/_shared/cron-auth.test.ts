/**
 * Contract: assertCronOrUser / assertCronOrOwnerAdmin return null when authorized,
 * Response when denied. Callers must use `if (denied) return denied` — never `if (!denied)`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("cron-auth caller contract", () => {
  it("diagnosis-followup uses isCronAuthenticated (cron-only)", () => {
    const src = readFileSync(join(root, "diagnosis-followup/index.ts"), "utf8");
    expect(src).toMatch(/isCronAuthenticated/);
    expect(src).not.toMatch(/assertCronOrUser/);
    expect(src).toMatch(/if \(!\(await isCronAuthenticated/);
  });

  it("process-diagnosis uses isCronAuthenticated (cron-only)", () => {
    const src = readFileSync(join(root, "process-diagnosis/index.ts"), "utf8");
    expect(src).toMatch(/isCronAuthenticated/);
    expect(src).not.toMatch(/assertCronOrUser/);
  });

  it("assertCronOrUser returns null when authorized (documented in cron-auth.ts)", () => {
    const src = readFileSync(join(root, "_shared/cron-auth.ts"), "utf8");
    expect(src).toMatch(/return null/);
  });
});
