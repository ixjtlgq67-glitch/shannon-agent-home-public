import { isSupabaseConfigured } from "@/lib/config";
import { getMemoryStore } from "./memory";
import type { ProductStore } from "./types";
import { SupabaseStore } from "./supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getStore(): Promise<ProductStore> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) return new SupabaseStore(supabase);
  }
  return getMemoryStore();
}

export type { ProductStore } from "./types";
