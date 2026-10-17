import * as cheerio from "cheerio";
import { config } from "../config.ts";
import { fetchText } from "../http.ts";
import { htmlToText } from "../text.ts";
import type { Candidate, Source } from "./types.ts";

// UK regulatory announcements (RNS and other approved feeds) via Investegate,
// which publishes a plain daily listing.
const LISTING = "https://www.investegate.co.uk/today-announcements/";

// Routine headlines that never describe a use of AI. Skipping them saves
// several hundred requests a day.
const ROUTINE =
  /^(transaction(s)? in own shares|holding\(s\) in company|form 8\.3|form 8 \(|form 38\.5|director\/pdmr|pdmr|total voting rights|block ?listing|net asset value|nav\b|price monitoring|additional listing|result of agm|result of general meeting|notice of (agm|gm|general meeting|annual general meeting)|publication of (a )?(prospectus|supplement|final terms)|issue of equity|statement re|tr-1|director declaration|change of adviser|redemption|interest rate|dividend declaration|monthly factsheet|portfolio update)/i;

/** Rows from one listing page. */
export function parseListing(html: string, date: string): Candidate[] {
  const $ = cheerio.load(html);
  const out: Candidate[] = [];
  $("tr").each((_, tr) => {
    const link = $(tr).find("a.announcement-link");
    const url = link.attr("href");
    if (!url) return;
    // "Town Centre Securities (TOWN)"
    const companyText = $(tr).find('a[href*="/company/"]').last().text().trim();
    const m = companyText.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    out.push({
      sourceName: "RNS",
      company: m ? m[1] : companyText,
      ticker: m ? m[2] : null,
      announcedOn: date,
      title: link.text().trim(),
      url,
    });
  });
  return out;
}

/**
 * Just the announcement. The page also carries Investegate's own
 * "Summary by AI" panel and disclaimer, which must not be scanned.
 */
export function extractAnnouncement(html: string): string {
  const start = html.indexOf('class="art-board py-3 news-window"');
  if (start < 0) throw new Error("announcement body not found");
  let end = html.indexOf("This information is provided by RNS", start);
  if (end < 0) end = html.indexOf('<div class="modal', start);
  return htmlToText(html.slice(html.indexOf(">", start) + 1, end < 0 ? undefined : end));
}

export const rns: Source = {
  name: "RNS",

  async listCandidates(date) {
    const all: Candidate[] = [];
    for (let page = 1; page <= 50; page++) {
      const html = await fetchText(`${LISTING}${date}?page=${page}`, config.webUserAgent);
      const rows = parseListing(html, date);
      if (rows.length === 0) break;
      all.push(...rows);
    }
    return all.filter((c) => !ROUTINE.test(c.title));
  },

  async fetchDocuments(candidate) {
    const html = await fetchText(candidate.url, config.webUserAgent);
    return [
      { candidate, url: candidate.url, documentType: candidate.title, text: extractAnnouncement(html) },
    ];
  },
};
