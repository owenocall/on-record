-- Notes: one row per source document that shows a concrete use of AI.
create table if not exists public.notes (
  id              uuid primary key default gen_random_uuid(),
  announced_on    date        not null,
  company         text        not null,
  ticker          text,
  ai_use          text        not null,
  software        text[]      not null default '{}',
  evidence_quote  text        not null check (length(trim(evidence_quote)) > 0),
  source_url      text        not null unique,
  source_name     text        not null,          -- 'SEC EDGAR', 'RNS', ...
  document_type   text,                          -- '8-K', 'EX-99.1', 'Interim Results', ...
  status          text        not null default 'pending'
                  check (status in ('pending', 'published', 'rejected')),
  created_at      timestamptz not null default now(),
  published_at    timestamptz
);

create index if not exists notes_published_idx
  on public.notes (announced_on desc) where status = 'published';

-- Every document the scanner has already looked at, AI or not, so re-runs
-- don't pay to classify the same document twice.
create table if not exists public.scanned_sources (
  source_url  text primary key,
  scanned_at  timestamptz not null default now(),
  outcome     text not null check (outcome in ('note', 'no_ai_use', 'quote_mismatch'))
);

-- Public (anon) readers only ever see published notes. The scanner uses the
-- service role key, which bypasses RLS.
alter table public.notes enable row level security;
alter table public.scanned_sources enable row level security;

drop policy if exists "published notes are public" on public.notes;
create policy "published notes are public"
  on public.notes for select
  to anon, authenticated
  using (status = 'published');
