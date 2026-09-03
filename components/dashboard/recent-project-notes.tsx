'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { workTimeApi, type NoteCursor, type RecentProjectNote } from '@/lib/work-time-api';

function NoteCard({ note }: { note: RecentProjectNote }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = note.text.length > 240;
  return <li className="px-5 py-4">
    <div className="flex flex-wrap items-baseline justify-between gap-1">
      <Link href={`/projects/${note.project_id}#project-documentation`} className="font-semibold text-blue-600 hover:underline">{note.project_name}</Link>
      <time dateTime={note.created_at} className="text-xs text-slate-500">{new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(note.created_at))}</time>
    </div>
    <p className="mt-1 text-xs text-slate-500">{note.author_name}</p>
    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{isLong && !expanded ? `${note.text.slice(0, 240)}…` : note.text}</p>
    {isLong && <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="mt-2 text-sm font-medium text-blue-600">{expanded ? 'Weniger anzeigen' : 'Vollständige Notiz anzeigen'}</button>}
  </li>;
}

export function RecentProjectNotes({ userId }: { userId: string }) {
  const query = useInfiniteQuery({
    queryKey: ['recentProjectNotes', userId],
    initialPageParam: undefined as NoteCursor,
    queryFn: ({ pageParam }) => workTimeApi.getRecentNotes(pageParam),
    getNextPageParam: (page): NoteCursor => page.length > 10
      ? { before_time: page[9].created_at, before_id: page[9].id } : undefined,
    staleTime: 0,
  });
  const notes = query.data?.pages.flatMap(page => page.slice(0, 10)) || [];
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <h2 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">Letzte Auftragsnotizen</h2>
    {query.isPending && <p className="p-5 text-sm text-slate-500">Notizen werden geladen…</p>}
    {query.isError && <div role="alert" className="p-5 text-sm text-red-600">Notizen konnten nicht geladen werden. <button type="button" onClick={() => query.refetch()} className="underline">Erneut versuchen</button></div>}
    {!query.isPending && !query.isError && notes.length === 0 && <p className="p-5 text-sm text-slate-500">Noch keine Auftragsnotizen vorhanden.</p>}
    <ul className="divide-y divide-slate-100">{notes.map(note => <NoteCard key={note.id} note={note} />)}</ul>
    {query.hasNextPage && <div className="border-t border-slate-100 p-4 text-center"><button type="button" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{query.isFetchingNextPage ? 'Lädt…' : 'Mehr laden'}</button></div>}
  </section>;
}
