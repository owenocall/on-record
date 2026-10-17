# On Record

A daily filing of company AI announcements. Each note has: date, company,
specific use of AI, any software named, and a link to the source.

## Stack
- Next.js (App Router, TypeScript, Tailwind) on Vercel
- Supabase (Postgres) for storage
- GitHub Actions runs the daily scanner
- Scanner lives in /scanner, separate from the website
- Website lives in /web (Vercel project Root Directory: web)

## Rules
- Every note MUST include an exact quoted sentence from the source as evidence.
- source_url is unique. Never insert duplicates.
- Nothing is public until status = 'published'. Scanner only writes 'pending'.
- Secrets live in .env.local and GitHub secrets only. Never hard-code or commit keys.
- Only count concrete uses of AI ("deployed", "piloting", "using X for Y").
  Ignore vague statements like "we are investing in AI".
- Sources, in priority order: SEC EDGAR (8-K, 10-Q, 10-K, exhibit 99), UK RNS,
  then wire services, then web search as a fallback.
- SEC requests need a descriptive User-Agent header including a contact email.

## Test cases the scanner must catch
- Vertu Motors interim results, 14 Oct 2026 (AI inside the CEO review)
- Town Centre Securities final results, 15 Oct 2026 (one paragraph under
  "Technology and innovation")
