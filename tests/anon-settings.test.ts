import { describe, expect, it } from "vitest";
import { anonymousFromSettings } from "@/lib/supabase/availability";

describe("anonymous auth detection", () => {
  it("reads the public auth settings flag", () => {
    expect(anonymousFromSettings({ external: { anonymous_users: true } })).toBe(true);
    expect(anonymousFromSettings({ external: { anonymous_users: false } })).toBe(false);
    expect(anonymousFromSettings({})).toBe(false);
    expect(anonymousFromSettings(null)).toBe(false);
  });
});
