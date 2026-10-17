// Offline checks, using quotes and names from the 15 Oct 2026 scan.
import assert from "node:assert/strict";
import { test } from "node:test";
import { isCompleteSentence, sameCompanyName } from "../src/text.ts";

test("complete sentences pass", () => {
  for (const q of [
    "For example, we have deployed AI-driven route planning for our operations team, to optimise branch visits, taking into account journey times, fuel consumption and site utilisation data.",
    "Stater Bros, a leading independent supermarket chain headquartered in Southern California, will deploy Eagle Eye’s AI-powered personalisation solution, Personalised Challenges, in support of its continued growth strategy.",
    "•Introduced Charley, a new AI-powered assistant that provides U.S. retail clients with conversational access to Schwab’s tools and insights",
    "“AI-powered customer experience is now live.”",
  ]) {
    assert.ok(isCompleteSentence(q), q);
  }
});

test("fragments are rejected", () => {
  for (const q of [
    "We have also launched an AI-backed inFoods® IBS Trigger Food Navigator designed",
    "The Company combines rigorous, expert-led",
    "and provides sales colleagues with a tailored summary, recommended actions and guidance.",
    "Source(s): Image",
  ]) {
    assert.ok(!isCompleteSentence(q), q);
  }
});

test("company names match despite suffixes", () => {
  assert.ok(sameCompanyName("Dunelm Group plc", "Dunelm Group"));
  assert.ok(sameCompanyName("Town Centre Securities PLC", "Town Centre Securities"));
  assert.ok(sameCompanyName("The Charles Schwab Corporation", "Charles Schwab Corp"));
  assert.ok(!sameCompanyName("Crowded", "FinanceWire News"));
  assert.ok(!sameCompanyName("System1 Group", "Brave Bison Group"));
});
