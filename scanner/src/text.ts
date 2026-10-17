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

export function containsQuote(source: string, quote: string): boolean {
  const q = normalize(quote);
  return q.length > 0 && normalize(source).includes(q);
}
