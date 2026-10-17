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

// The URLs travel in the request's query string, which PostgREST caps at
// about 16KB, so batch by encoded length rather than by count.
const MAX_BATCH_CHARS = 6_000;

function batchesByLength(urls: string[]): string[][] {
  const batches: string[][] = [];
  let batch: string[] = [];
  let size = 0;
  for (const url of urls) {
    const len = encodeURIComponent(url).length + 3;
    if (batch.length > 0 && size + len > MAX_BATCH_CHARS) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(url);
    size += len;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

/** URLs from `urls` the scanner has already processed. */
export async function alreadyScanned(urls: string[]): Promise<Set<string>> {
  const seen = new Set<string>();
  for (const batch of batchesByLength(urls)) {
    const { data, error } = await db()
      .from("scanned_sources")
      .select("source_url")
      .in("source_url", batch);
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
