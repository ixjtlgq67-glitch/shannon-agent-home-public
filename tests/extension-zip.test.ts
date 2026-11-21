import { describe, expect, it } from "vitest";
import { buildExtensionZip, stampOrigin } from "@/lib/shannon/extension-zip";

describe("extension download", () => {
  it("writes this site’s address into the zip and leaves the token for the reader", async () => {
    expect(stampOrigin('globalThis.SHANNON_ORIGIN = "";', "https://shannon.example")).toBe(
      'globalThis.SHANNON_ORIGIN = "https://shannon.example";',
    );
    const zip = await buildExtensionZip("https://shannon.example");
    expect(zip.subarray(0, 2).toString()).toBe("PK");
    const text = zip.toString("latin1");
    expect(text).toContain('globalThis.SHANNON_ORIGIN = "https://shannon.example";');
    expect(text).toContain("manifest.json");
    expect(text).toContain("Save token");
    expect(text).not.toContain('SHANNON_ORIGIN = ""');
  });

  it("refuses to bake a non-http address into the extension", async () => {
    await expect(buildExtensionZip("javascript:alert(1)")).rejects.toThrow(/http/);
  });
});
