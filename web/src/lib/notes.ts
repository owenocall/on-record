import "server-only";
import { createClient } from "@supabase/supabase-js";

export interface Note {
  id: string;
  announced_on: string; // YYYY-MM-DD
  company: string;
  ticker: string | null;
  ai_use: string;
  software: string[];
  evidence_quote: string;
  source_url: string;
  source_name: string;
  document_type: string | null;
}

const COLUMNS =
  "id, announced_on, company, ticker, ai_use, software, evidence_quote, source_url, source_name, document_type";

// Anon key: row level security only lets it read published notes. The status
// filter below is belt and braces.
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const isConfigured = () => db() !== null;

export async function latestNotes(limit = 200): Promise<Note[]> {
  const client = db();
  if (!client) return [];
  const { data, error } = await client
    .from("notes")
    .select(COLUMNS)
    .eq("status", "published")
    .order("announced_on", { ascending: false })
    .order("company")
    .limit(limit);
  if (error) throw error;
  return data;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getNote(id: string): Promise<Note | null> {
  const client = db();
  if (!client || !UUID.test(id)) return null;
  const { data, error } = await client
    .from("notes")
    .select(COLUMNS)
    .eq("status", "published")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Notes grouped by announcement date, newest first. */
export function byDate(notes: Note[]): [string, Note[]][] {
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    const list = groups.get(note.announced_on) ?? [];
    list.push(note);
    groups.set(note.announced_on, list);
  }
  return [...groups];
}
