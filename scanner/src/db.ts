import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.ts";
import type { Note } from "./classify.ts";

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  client ??= createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
  return client;
}

/** URLs from `urls` the scanner has already processed. */
export async function alreadyScanned(urls: string[]): Promise<Set<string>> {
  const seen = new Set<string>();
  for (let i = 0; i < urls.length; i += 200) {
    const { data, error } = await db()
      .from("scanned_sources")
      .select("source_url")
      .in("source_url", urls.slice(i, i + 200));
    if (error) throw error;
    for (const row of data) seen.add(row.source_url);
  }
  return seen;
}

export async function markScanned(url: string, outcome: string): Promise<void> {
  const { error } = await db()
    .from("scanned_sources")
    .upsert({ source_url: url, outcome }, { onConflict: "source_url" });
  if (error) throw error;
}

/** Inserts as 'pending'. A source_url that already exists is left untouched. */
export async function insertNote(note: Note): Promise<void> {
  const { error } = await db()
    .from("notes")
    .upsert({ ...note, status: "pending" }, { onConflict: "source_url", ignoreDuplicates: true });
  if (error) throw error;
}
