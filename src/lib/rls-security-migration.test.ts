import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("RLS security migration contract", () => {
  it("fix_rls_critical_policies.sql removes portal leak and locks INSERT policies", () => {
    const migDir = join(root, "supabase", "migrations");
    const files = readdirSync(migDir).filter((f) =>
      f.endsWith("_fix_rls_critical_policies.sql"),
    );
    expect(files.length).toBe(1);
    const sql = readFileSync(join(migDir, files[0]!), "utf8");
    expect(sql).toMatch(/DROP POLICY IF EXISTS clients_public_portal/i);
    expect(sql).toMatch(/roles_insert/i);
    expect(sql).toMatch(/WITH CHECK \(false\)/);
    expect(sql).toMatch(/agencies_insert/i);
  });
});
