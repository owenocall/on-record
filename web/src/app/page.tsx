import { NoteCard } from "@/components/NoteCard";
import { byDate, formatDate, isConfigured, latestNotes } from "@/lib/notes";

// New notes are published by hand after review; an hour's delay is fine.
export const revalidate = 3600;

export default async function Home() {
  const notes = await latestNotes();

  return (
    <>
      <p className="max-w-prose text-lg leading-relaxed text-muted">
        Companies saying, on the record, how they use AI. Each note comes from a regulatory filing or
        announcement, quotes the source exactly and links to it.
      </p>

      {notes.length === 0 ? (
        <p className="mt-12 border-t border-rule pt-6 text-muted">
          {isConfigured() ? "No notes published yet." : "Supabase is not configured."}
        </p>
      ) : (
        byDate(notes).map(([date, dayNotes]) => (
          <section key={date} className="mt-12" aria-labelledby={`d-${date}`}>
            <h2 id={`d-${date}`} className="font-mono text-xs uppercase tracking-widest text-muted">
              <time dateTime={date}>{formatDate(date)}</time>
            </h2>
            {dayNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </section>
        ))
      )}
    </>
  );
}
