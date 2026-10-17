// Polite fetching: one throttle per host, retries on 429/5xx.

const lastRequestAt = new Map<string, number>();

// Minimum gap between requests to the same host. SEC allows 10 req/s.
const MIN_GAP_MS: Record<string, number> = {
  "www.sec.gov": 150,
  "www.investegate.co.uk": 500,
};
const DEFAULT_GAP_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function throttle(host: string): Promise<void> {
  const gap = MIN_GAP_MS[host] ?? DEFAULT_GAP_MS;
  // Reserve the next slot synchronously so concurrent callers queue up.
  const now = Date.now();
  const slot = Math.max(now, (lastRequestAt.get(host) ?? 0) + gap);
  lastRequestAt.set(host, slot);
  if (slot > now) await sleep(slot - now);
}

export async function fetchText(
  url: string,
  userAgent: string,
  attempts = 4,
): Promise<string> {
  const host = new URL(url).host;
  for (let attempt = 1; ; attempt++) {
    await throttle(host);
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, "Accept-Encoding": "gzip, deflate" },
    });
    if (res.ok) return res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= attempts) {
      throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
    }
    await sleep(2 ** attempt * 1000);
  }
}
