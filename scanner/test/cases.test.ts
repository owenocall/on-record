// The test cases from CLAUDE.md. These hit the network. The classifier part
// also calls the Claude API and is skipped when ANTHROPIC_API_KEY is unset.
import assert from "node:assert/strict";
import { test } from "node:test";
import { rns } from "../src/sources/rns.ts";
import { aiPassages, containsQuote } from "../src/text.ts";
import type { Candidate } from "../src/sources/types.ts";

const CASES: { candidate: Candidate; mustFind: RegExp }[] = [
  {
    candidate: {
      sourceName: "RNS",
      company: "Vertu Motors",
      ticker: "VTU",
      announcedOn: "2026-10-14",
      title: "Interim Results",
      url: "https://www.investegate.co.uk/announcement/rns/vertu-motors--vtu/interim-results/9821324",
    },
    mustFind: /piloting .Opportune./,
  },
  {
    candidate: {
      sourceName: "RNS",
      company: "Town Centre Securities",
      ticker: "TOWN",
      announcedOn: "2026-10-15",
      title: "Final results for the year ended 30 June 2026",
      url: "https://www.investegate.co.uk/announcement/rns/town-centre-securities--town/final-results-for-the-year-ended-30-june-2026/9823603",
    },
    mustFind: /deployed AI-driven route planning/,
  },
];

for (const { candidate, mustFind } of CASES) {
  test(`${candidate.company}: listed on its day`, async () => {
    const listed = await rns.listCandidates(candidate.announcedOn);
    assert.ok(listed.some((c) => c.url === candidate.url), "announcement missing from daily listing");
  });

  test(`${candidate.company}: AI passage reaches the classifier`, async () => {
    const [doc] = await rns.fetchDocuments(candidate);
    const passages = aiPassages(doc.text);
    assert.match(passages, mustFind);
    // Investegate's own AI summary panel must not leak in.
    assert.doesNotMatch(doc.text, /AI Summary Disclaimer|Summary by AI/);
  });

  test(
    `${candidate.company}: classified as a concrete AI use`,
    { skip: !process.env.ANTHROPIC_API_KEY && "ANTHROPIC_API_KEY not set" },
    async () => {
      const { classify } = await import("../src/classify.ts");
      const docs = await rns.fetchDocuments(candidate);
      const outcome = await classify(candidate, docs);
      assert.equal(outcome.kind, "note", JSON.stringify(outcome));
      if (outcome.kind !== "note") return;
      assert.ok(containsQuote(docs[0].text, outcome.note.evidence_quote));
      assert.equal(outcome.note.source_url, candidate.url);
      console.log(`  ${candidate.company}: ${outcome.note.ai_use} | ${outcome.note.software.join(", ")}\n  "${outcome.note.evidence_quote}"`);
    },
  );
}
