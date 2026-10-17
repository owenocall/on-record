// Daily scanner. Usage:
//   npm run scan -- [--date YYYY-MM-DD] [--source sec|rns] [--dry-run] [--limit N]
// --date defaults to yesterday (UTC). --dry-run prints notes and skips the database.
import { parseArgs } from "node:util";
import { classify, type Outcome } from "./classify.ts";
import { alreadyScanned, insertNote, markScanned } from "./db.ts";
import { rns } from "./sources/rns.ts";
import { sec } from "./sources/sec.ts";
import type { Candidate, Source } from "./sources/types.ts";

// Priority order from CLAUDE.md.
const SOURCES: Source[] = [sec, rns];
const CONCURRENCY = 4;

function yesterday(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

async function scanCandidate(source: Source, c: Candidate): Promise<Outcome> {
  return classify(c, await source.fetchDocuments(c));
}

async function main() {
  const { values } = parseArgs({
    options: {
      date: { type: "string", default: yesterday() },
      source: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      limit: { type: "string" },
    },
  });
  const date = values.date!;
  const dryRun = values["dry-run"]!;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Bad --date ${date}`);

  const sources = SOURCES.filter((s) => !values.source || s.name.toLowerCase().startsWith(values.source));
  const totals = { notes: 0, noAi: 0, mismatches: 0, errors: 0 };

  for (const source of sources) {
    let candidates = await source.listCandidates(date);
    if (!dryRun) {
      const seen = await alreadyScanned(candidates.map((c) => c.url));
      candidates = candidates.filter((c) => !seen.has(c.url));
    }
    if (values.limit) candidates = candidates.slice(0, Number(values.limit));
    console.log(`${source.name} ${date}: ${candidates.length} documents to check`);

    await pool(candidates, CONCURRENCY, async (c) => {
      try {
        const outcome = await scanCandidate(source, c);
        if (outcome.kind === "note") {
          totals.notes++;
          console.log(`  NOTE ${c.company}: ${outcome.note.ai_use}\n       "${outcome.note.evidence_quote}"\n       ${outcome.note.source_url}`);
          if (!dryRun) await insertNote(outcome.note);
        } else if (outcome.kind === "quote_mismatch") {
          totals.mismatches++;
          console.warn(`  QUOTE NOT FOUND ${c.company} ${c.url}: "${outcome.quote}"`);
        } else {
          totals.noAi++;
        }
        if (!dryRun) await markScanned(c.url, outcome.kind);
      } catch (err) {
        // Not marked as scanned, so the next run retries it.
        totals.errors++;
        console.error(`  ERROR ${c.company} ${c.url}: ${err instanceof Error ? err.message : err}`);
      }
    });
  }

  console.log(
    `Done: ${totals.notes} notes, ${totals.noAi} without concrete AI use, ` +
      `${totals.mismatches} quote mismatches, ${totals.errors} errors`,
  );
  // A few fetch errors are normal; fail the run only if nothing worked.
  if (totals.errors > 0 && totals.notes + totals.noAi + totals.mismatches === 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
