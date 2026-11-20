import { isSupabaseConfigured } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SourceRecord } from "./types";

/** Private object storage, written with the signed-in user's JWT. Skipped when the save arrived by token. Paragraphs in Postgres stay the source of truth. */
export async function serviceUpload(source: SourceRecord): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = await createSupabaseServerClient();
  const { data } = await client.auth.getUser();
  if (!data.user) return;
  const body = source.paragraphs.map((paragraph) => `# ${paragraph.id}\n${paragraph.text}`).join("\n\n");
  const objectPath = `${source.user_id}/${source.source_id}/${source.source_version}.txt`;
  const { error } = await client.storage.from("frozen-sources").upload(objectPath, body, {
    contentType: "text/plain; charset=utf-8",
    upsert: false,
  });
  if (error) throw new Error(error.message);
}
