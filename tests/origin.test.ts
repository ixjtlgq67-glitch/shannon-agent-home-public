import { describe, expect, it } from "vitest";
import { joinOrigin, publicOrigin } from "@/lib/config";

function headers(values: Record<string, string | undefined>) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

describe("public origin", () => {
  it("uses the forwarded public host instead of the bind address", () => {
    expect(
      publicOrigin(
        headers({
          host: "0.0.0.0:43123",
          "x-forwarded-host": "aug-boolean-possession-centres.trycloudflare.com",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://aug-boolean-possession-centres.trycloudflare.com");
  });

  it("uses PUBLIC_URL when every host header is loopback", () => {
    const previous = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = "https://shannon.example";
    try {
      expect(publicOrigin(headers({ host: "0.0.0.0:43123", "x-forwarded-proto": "http" }))).toBe("https://shannon.example");
    } finally {
      if (previous === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previous;
    }
  });

  it("never emits 0.0.0.0", () => {
    const previous = process.env.PUBLIC_URL;
    delete process.env.PUBLIC_URL;
    try {
      const origin = publicOrigin(headers({ host: "0.0.0.0:43123" }));
      expect(origin).not.toContain("0.0.0.0");
      expect(joinOrigin(origin, "/get-the-button")).toBe(`${origin}/get-the-button`);
    } finally {
      if (previous === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previous;
    }
  });
});
