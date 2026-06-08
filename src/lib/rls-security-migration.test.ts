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

  it("integrations_token_rls adds public view and secret guard", () => {
    const migDir = join(root, "supabase", "migrations");
    const files = readdirSync(migDir).filter((f) =>
      f.includes("integrations_token_rls"),
    );
    expect(files.length).toBe(1);
    const sql = readFileSync(join(migDir, files[0]!), "utf8");
    expect(sql).toMatch(/integrations_public/i);
    expect(sql).toMatch(/integrations_guard_secrets/i);
    expect(sql).toMatch(/is_owner_or_admin/i);
  });

  it("security_rpc_guards adds tenant guards and helpers", () => {
    const sql = readFileSync(
      join(root, "supabase", "migrations", "20260609120000_security_rpc_guards.sql"),
      "utf8",
    );
    expect(sql).toMatch(/user_can_access_client/i);
    expect(sql).toMatch(/count_agency_clients/i);
    expect(sql).toMatch(/auth_is_platform_admin/i);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/ai-job:%/i);
  });

  it("security_portal_slugs regenerates slugs with gen_random_bytes", () => {
    const sql = readFileSync(
      join(root, "supabase", "migrations", "20260609120100_security_portal_slugs.sql"),
      "utf8",
    );
    expect(sql).toMatch(/generate_portal_slug/i);
    expect(sql).toMatch(/gen_random_bytes/i);
    expect(sql).toMatch(/clients_assign_portal_slug/i);
  });

  it("security_subscriptions_guard blocks plan limit self-escalation", () => {
    const sql = readFileSync(
      join(root, "supabase", "migrations", "20260609130000_security_subscriptions_guard.sql"),
      "utf8",
    );
    expect(sql).toMatch(/subscriptions_guard_plan_limits/i);
    expect(sql).toMatch(/max_clients/i);
  });

  it("security_client_scope_policies uses user_can_access_client", () => {
    const sql = readFileSync(
      join(root, "supabase", "migrations", "20260609140000_security_client_scope_policies.sql"),
      "utf8",
    );
    expect(sql).toMatch(/user_can_access_client/i);
    expect(sql).toMatch(/campaigns/i);
    expect(sql).toMatch(/creative_reviews/i);
    expect(sql).toMatch(/creative_asset_id/i);
  });

  it("security_activities_scope applies user_can_access_client to activities", () => {
    const sql = readFileSync(
      join(root, "supabase", "migrations", "20260609150000_security_activities_scope.sql"),
      "utf8",
    );
    expect(sql).toMatch(/activities_select/i);
    expect(sql).toMatch(/user_can_access_client\(client_id\)/i);
  });
});
