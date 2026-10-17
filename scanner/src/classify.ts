import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config.ts";
import { aiPassages, containsQuote, isCompleteSentence, sameCompanyName } from "./text.ts";
import type { Candidate, SourceDocument } from "./sources/types.ts";

const Verdict = z.object({
  concrete_ai_use: z.boolean(),
  company: z.string(),
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

const SYSTEM = `You review excerpts from company filings and stock exchange announcements and decide whether the announcing company reports a concrete use of AI in running its own business.

Concrete means the company says it has deployed, is piloting, has rolled out, or is using a specific AI capability for a specific purpose in its own operations: serving its customers, running its processes, doing its research ("we deployed AI-driven route planning for our operations team", "we are piloting an AI sales tool in 18 dealerships", "our AI assistant resolves 80% of customer queries").

Not concrete, so answer false:
- Intentions and plans, including "will deploy" or "plans to roll out"; investment budgets; strategy language; risk factors; market commentary; the effect of AI on customers or the sector ("we are investing in AI", "AI may disrupt our industry").
- AI products or features the company sells or licenses to its customers ("our platform has AI built in", "we launched an AI-powered tool for clients", "our diagnostic test uses AI"). Selling AI is not using AI in the business.
- Another company's use of AI: a customer, supplier, takeover party or investee. Only the announcing company's own use counts.
- Trivial one-off uses, such as an image in a presentation made with an AI tool.

Exception: if the listed issuer is only a newswire or distribution service (e.g. "FinanceWire News"), judge the company the release is about.

If there is a concrete use:
- company: the name of the company using the AI, as the text names it.
- ai_use: one plain sentence saying what the AI is used for, in your own words. If there are several uses, cover the main ones briefly.
- software: product, tool or vendor names the text explicitly ties to the AI use (e.g. "Opportune", "Microsoft Copilot"). Empty if none are named. Never guess.
- evidence_quote: ONE complete sentence copied character-for-character from the excerpts that best shows the concrete use, from its first word to its closing punctuation. Excerpts sometimes break a sentence across several lines; quote the whole sentence, joining those lines with a single space. Do not shorten, paraphrase, fix typos or join separate sentences. A bullet point without a full stop counts as a sentence if you quote the whole bullet.
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
  if (!isCompleteSentence(verdict.evidence_quote)) {
    return { kind: "quote_mismatch", quote: `[incomplete sentence] ${verdict.evidence_quote}` };
  }

  // Keep the listing's name and ticker when the model names the same company;
  // otherwise (e.g. a release distributed by a newswire) use the model's name.
  const sameCompany = sameCompanyName(verdict.company, candidate.company);
  return {
    kind: "note",
    note: {
      announced_on: candidate.announcedOn,
      company: sameCompany ? candidate.company : verdict.company,
      ticker: sameCompany ? candidate.ticker : null,
      ai_use: verdict.ai_use,
      software: verdict.software,
      evidence_quote: verdict.evidence_quote,
      source_url: doc.url,
      source_name: candidate.sourceName,
      document_type: doc.documentType,
    },
  };
}
