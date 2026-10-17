import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config.ts";
import { aiPassages, containsQuote } from "./text.ts";
import type { Candidate, SourceDocument } from "./sources/types.ts";

const Verdict = z.object({
  concrete_ai_use: z.boolean(),
  ai_use: z.string(),
  software: z.array(z.string()),
  evidence_quote: z.string(),
  document_index: z.number().int(),
});

export interface Note {
  announced_on: string;
  company: string;
  ticker: string | null;
  ai_use: string;
  software: string[];
  evidence_quote: string;
  source_url: string;
  source_name: string;
  document_type: string;
}

export type Outcome =
  | { kind: "note"; note: Note }
  | { kind: "no_ai_use" }
  | { kind: "quote_mismatch"; quote: string };

const SYSTEM = `You review excerpts from company filings and stock exchange announcements and decide whether the company reports a concrete use of AI in its own business.

Concrete means the company says it has deployed, is piloting, has rolled out, or is using a specific AI capability for a specific purpose ("we deployed AI-driven route planning for our operations team", "we are piloting an AI sales tool in 18 dealerships"). Not concrete: intentions, investment budgets, strategy language, risk factors, market commentary, or the effect of AI on customers or the sector ("we are investing in AI", "AI may disrupt our industry", "tenants are assessing the impact of AI").

If there is a concrete use:
- ai_use: one plain sentence saying what the AI is used for, in your own words. If there are several uses, cover the main ones briefly.
- software: product, tool or vendor names the text explicitly ties to the AI use (e.g. "Opportune", "Microsoft Copilot"). Empty if none are named. Never guess.
- evidence_quote: ONE complete sentence copied character-for-character from the excerpts that best shows the concrete use. Do not shorten, paraphrase, fix typos or join sentences.
- document_index: the number of the document the quote comes from.

If there is no concrete use, set concrete_ai_use to false, use empty strings and an empty list, and document_index 0.`;

const client = new Anthropic();

export async function classify(
  candidate: Candidate,
  docs: SourceDocument[],
): Promise<Outcome> {
  const excerpts = docs
    .map((d, i) => ({ i, d, passages: aiPassages(d.text) }))
    .filter((x) => x.passages);
  if (excerpts.length === 0) return { kind: "no_ai_use" };

  const body = excerpts
    .map(({ i, d, passages }) => `<document index="${i}" type="${d.documentType}">\n${passages}\n</document>`)
    .join("\n\n");

  const response = await client.beta.messages.parse({
    model: config.model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // Classification and extraction: low effort is enough and keeps daily cost down.
    output_config: { effort: "low", format: betaZodOutputFormat(Verdict) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Company: ${candidate.company}\nDocument: ${candidate.title}\n\n${body}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Classifier declined ${candidate.url}: ${response.stop_details?.category ?? "unknown"}`);
  }
  const verdict = response.parsed_output;
  if (!verdict) throw new Error(`Unparseable classifier output for ${candidate.url}`);
  if (!verdict.concrete_ai_use) return { kind: "no_ai_use" };

  // The quote must appear verbatim in the source, whatever the model says.
  const doc =
    docs.find((d, i) => i === verdict.document_index && containsQuote(d.text, verdict.evidence_quote)) ??
    docs.find((d) => containsQuote(d.text, verdict.evidence_quote));
  if (!doc) return { kind: "quote_mismatch", quote: verdict.evidence_quote };

  return {
    kind: "note",
    note: {
      announced_on: candidate.announcedOn,
      company: candidate.company,
      ticker: candidate.ticker,
      ai_use: verdict.ai_use,
      software: verdict.software,
      evidence_quote: verdict.evidence_quote,
      source_url: doc.url,
      source_name: candidate.sourceName,
      document_type: doc.documentType,
    },
  };
}
