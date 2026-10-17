import Link from "next/link";
import type { Note } from "@/lib/notes";

export function NoteCard({ note, linkTitle = true }: { note: Note; linkTitle?: boolean }) {
  const title = (
    <>
      {note.company}
      {note.ticker && <span className="ml-2 font-mono text-xs text-muted">{note.ticker}</span>}
    </>
  );

  return (
    <article className="border-t border-rule py-6">
      <h3 className="font-serif text-xl font-semibold leading-snug">
        {linkTitle ? (
          <Link href={`/notes/${note.id}`} className="hover:underline underline-offset-4">
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>

      <p className="mt-2 leading-relaxed">{note.ai_use}</p>

      {note.software.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Software named">
          {note.software.map((name) => (
            <li key={name} className="rounded-sm border border-rule px-2 py-0.5 font-mono text-xs">
              {name}
            </li>
          ))}
        </ul>
      )}

      <blockquote className="mt-4 border-l-2 border-accent pl-4 font-serif italic text-muted">
        &ldquo;{note.evidence_quote}&rdquo;
      </blockquote>

      <p className="mt-3 text-sm">
        <a
          href={note.source_url}
          className="text-accent underline underline-offset-4 hover:no-underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source: {note.source_name}
          {note.document_type ? `, ${note.document_type}` : ""}
        </a>
      </p>
    </article>
  );
}
