import * as cheerio from "cheerio";
import { config } from "../config.ts";
import { fetchText } from "../http.ts";
import { htmlToText } from "../text.ts";
import type { Candidate, Source, SourceDocument } from "./types.ts";

const ARCHIVES = "https://www.sec.gov/Archives/";
const FORMS = new Set(["8-K", "10-Q", "10-K"]);
const isWantedDocType = (type: string) => FORMS.has(type) || type.startsWith("EX-99");

function quarter(date: string): number {
  return Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1;
}

/**
 * Daily form index, fixed-width:
 * Form Type | Company Name | CIK | Date Filed | File Name
 */
export function parseFormIndex(idx: string, date: string): Candidate[] {
  const out: Candidate[] = [];
  for (const line of idx.split("\n")) {
    const form = line.slice(0, 17).trim();
    if (!FORMS.has(form)) continue;
    // Company names can contain runs of spaces, so read the tail by pattern.
    const m = line.match(/^(\S+)\s+(.+?)\s+(\d+)\s+(\d{8})\s+(edgar\/data\/\S+\.txt)\s*$/);
    if (!m) continue;
    const [, , company, , , file] = m;
    const accession = file.split("/").pop()!.replace(/\.txt$/, "");
    const dir = file.replace(/[^/]+\.txt$/, "") + accession.replace(/-/g, "");
    out.push({
      sourceName: "SEC EDGAR",
      company: company.trim(),
      ticker: null,
      announcedOn: date,
      title: form,
      url: `${ARCHIVES}${dir}/${accession}-index.htm`,
    });
  }
  return out;
}

/** Rows of the "Document Format Files" table: [type, absolute url]. */
export function parseFilingIndex(html: string): { type: string; url: string }[] {
  const $ = cheerio.load(html);
  const rows: { type: string; url: string }[] = [];
  $('table.tableFile[summary="Document Format Files"] tr').each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length < 4) return;
    const type = $(cells[3]).text().trim();
    const href = $(cells[2]).find("a").attr("href");
    if (!href) return;
    // Inline XBRL links look like /ix?doc=/Archives/...; link the raw document.
    const path = href.replace(/^\/ix\?doc=/, "");
    rows.push({ type, url: new URL(path, "https://www.sec.gov").toString() });
  });
  return rows;
}

export const sec: Source = {
  name: "SEC EDGAR",

  async listCandidates(date) {
    const ymd = date.replace(/-/g, "");
    const url = `${ARCHIVES}edgar/daily-index/${date.slice(0, 4)}/QTR${quarter(date)}/form.${ymd}.idx`;
    try {
      return parseFormIndex(await fetchText(url, config.secUserAgent), date);
    } catch (err) {
      // No index on weekends and holidays.
      if (String(err).includes(" 403 ") || String(err).includes(" 404 ")) return [];
      throw err;
    }
  },

  async fetchDocuments(candidate) {
    const index = await fetchText(candidate.url, config.secUserAgent);
    const docs: SourceDocument[] = [];
    for (const { type, url } of parseFilingIndex(index)) {
      if (!isWantedDocType(type) || !/\.html?$|\.txt$/i.test(url)) continue;
      const text = htmlToText(await fetchText(url, config.secUserAgent));
      docs.push({ candidate, url, documentType: type, text });
    }
    return docs;
  },
};
