/** A document worth checking for AI use, before it has been downloaded. */
export interface Candidate {
  sourceName: string; // 'SEC EDGAR' | 'RNS' ...
  company: string;
  ticker: string | null;
  announcedOn: string; // YYYY-MM-DD
  title: string; // form type or RNS headline
  url: string; // index / listing link used to find the documents
}

/** A downloaded document's text, with the URL that will become source_url. */
export interface SourceDocument {
  candidate: Candidate;
  url: string;
  documentType: string;
  text: string;
}

export interface Source {
  name: string;
  listCandidates(date: string): Promise<Candidate[]>;
  fetchDocuments(candidate: Candidate): Promise<SourceDocument[]>;
}
