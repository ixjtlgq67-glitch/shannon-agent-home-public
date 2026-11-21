import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { assertRegistryIntact } from "@/lib/shannon/registry";
import { assertPublicHttpUrl } from "@/lib/shannon/freeze";

describe("copied agent home", () => {
  it("still matches the published prompt checksums", () => {
    expect(assertRegistryIntact()).toBe(20);
  });

  it("enables row level security on every product table", () => {
    const sql = readFileSync(new URL("../supabase/migrations/20261120120000_init.sql", import.meta.url), "utf8");
    for (const table of [
      "profiles",
      "declared_uses",
      "sources",
      "paragraphs",
      "runs",
      "proposals",
      "decisions",
      "register_entries",
      "audit_log",
      "cost_events",
      "concepts",
      "chat_messages",
    ]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`));
    }
    expect(sql).toMatch(/auth\.uid\(\)/);
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it("refuses private and non-http urls", () => {
    expect(() => assertPublicHttpUrl("http://127.0.0.1/secret")).toThrow(/private/i);
    expect(() => assertPublicHttpUrl("http://169.254.169.254/latest")).toThrow(/private/i);
    expect(() => assertPublicHttpUrl("file:///etc/passwd")).toThrow(/http/i);
    expect(assertPublicHttpUrl("https://example.com/essay").hostname).toBe("example.com");
  });
});
