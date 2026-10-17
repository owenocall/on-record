import * as cheerio from "cheerio";

const BLOCK_TAGS =
  /<\/?(p|div|br|tr|li|h[1-6]|table|section|article|header|footer|ul|ol|blockquote|td|th)\b[^>]*>/gi;

/** HTML -> plain text with one paragraph per line. Entities are decoded. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(BLOCK_TAGS, "\n");
  const text = cheerio.load(withBreaks).root().text();
  return text
    .split("\n")
    .map((line) => normalize(line))
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Canonical form used both for the text sent to the classifier and for
 * checking that a quote really appears in the source.
 */
export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‐‑‒–]/g, "-")
    .replace(/[  -​  　]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Case-sensitive acronyms; everything else case-insensitive.
const AI_ACRONYMS = /\b(AI|GenAI|LLMs?|ML)\b|\bAI-/;
const AI_TERMS =
  /artificial intelligence|machine learning|generative|large language model|agentic|chatbot|copilot|chatgpt|openai|anthropic|claude|gemini|computer vision|neural network|natural language processing|deep learning/i;

export function mentionsAi(paragraph: string): boolean {
  return AI_ACRONYMS.test(paragraph) || AI_TERMS.test(paragraph);
}

/**
 * Paragraphs that mention AI, with neighbours for context: the one before is
 * often the section heading (e.g. "Technology and innovation"), and SEC HTML
 * often splits a single sentence across several lines.
 * Returns "" when nothing mentions AI.
 */
export function aiPassages(text: string, maxChars = 30_000, context = 2): string {
  const paragraphs = text.split("\n");
  const keep = new Set<number>();
  paragraphs.forEach((p, i) => {
    if (!mentionsAi(p)) return;
    for (let j = Math.max(0, i - context); j <= Math.min(paragraphs.length - 1, i + context); j++) {
      keep.add(j);
    }
  });
  const out: string[] = [];
  let size = 0;
  let prev = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    const chunk = (i === prev + 1 ? "" : "[...]\n") + paragraphs[i];
    if (size + chunk.length > maxChars) break;
    out.push(chunk);
    size += chunk.length;
    prev = i;
  }
  return out.join("\n");
}

const BULLET = /^[•·▪●◦\-–]\s*/;

/**
 * A whole sentence: starts like a sentence and ends with closing punctuation.
 * A bullet point counts without a full stop, since bullets often lack one.
 */
export function isCompleteSentence(quote: string): boolean {
  const q = normalize(quote);
  if (q.length < 20) return false;
  if (BULLET.test(q)) return /^\p{Lu}|^\p{N}/u.test(q.replace(BULLET, ""));
  const startsWell = /^["“‘'(]?[\p{Lu}\p{N}]/u.test(q);
  const endsWell = /[.!?…]["”’')\]]*$/.test(q);
  return startsWell && endsWell;
}

const COMPANY_SUFFIX = /\b(plc|p\.l\.c\.|inc|incorporated|corp|corporation|co|company|ltd|limited|group|holdings?|sa|se|ag|nv|oyj|llc|the)\b\.?/g;

/** "Dunelm Group" and "Dunelm Group plc" are the same company. */
export function sameCompanyName(a: string, b: string): boolean {
  const key = (s: string) =>
    normalize(s).toLowerCase().replace(/[&,.()'’]/g, " ").replace(COMPANY_SUFFIX, " ").replace(/\s+/g, " ").trim();
  const ka = key(a);
  const kb = key(b);
  return ka.length > 0 && (ka === kb || ka.startsWith(`${kb} `) || kb.startsWith(`${ka} `));
}

export function containsQuote(source: string, quote: string): boolean {
  const q = normalize(quote);
  return q.length > 0 && normalize(source).includes(q);
}
