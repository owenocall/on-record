import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoteCard } from "@/components/NoteCard";
import { formatDate, getNote } from "@/lib/notes";

export const revalidate = 3600;

export async function generateMetadata(props: PageProps<"/notes/[id]">): Promise<Metadata> {
  const note = await getNote((await props.params).id);
  if (!note) return {};
  return { title: `${note.company}, ${formatDate(note.announced_on)}`, description: note.ai_use };
}

export default async function NotePage(props: PageProps<"/notes/[id]">) {
  const note = await getNote((await props.params).id);
  if (!note) notFound();

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        <time dateTime={note.announced_on}>{formatDate(note.announced_on)}</time>
      </p>
      <NoteCard note={note} linkTitle={false} />
      <p className="mt-8 text-sm">
        <Link href="/" className="underline underline-offset-4 hover:no-underline">
          All notes
        </Link>
      </p>
    </>
  );
}
