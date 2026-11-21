import { headers } from "next/headers";
import { appOrigin } from "@/lib/config";
import { buildExtensionZip } from "@/lib/shannon/extension-zip";

export async function GET() {
  const origin = appOrigin(await headers());
  const zip = await buildExtensionZip(origin);
  return new Response(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="shannon-extension.zip"',
      "cache-control": "no-store",
    },
  });
}
