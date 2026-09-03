'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { workTimeApi, formatHours } from '@/lib/work-time-api';

export function ProjectTimeSummary({ projectId, userId }: { projectId: string; userId: string }) {
  const [page, setPage] = useState(0);
  const query = useQuery({ queryKey: ['timeEntries', 'project', projectId, userId, page], queryFn: () => workTimeApi.getProjectTimes(projectId, page) });
  const data = query.data;
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="border-b border-slate-100 px-6 py-5"><h3 className="text-base font-bold text-slate-900">Gebuchte Arbeitszeiten</h3></div>
    {query.isPending && <p className="p-6 text-sm text-slate-500">Arbeitszeiten werden geladen…</p>}
    {query.isError && <div role="alert" className="p-6 text-sm text-red-600">Arbeitszeiten konnten nicht geladen werden. <button className="underline" onClick={() => query.refetch()}>Erneut versuchen</button></div>}
    {data && <>
      <div className="space-y-3 border-b border-slate-100 p-6">
        <p className="text-xl font-bold text-slate-900">{formatHours(data.total_minutes / 60)} h <span className="text-sm font-normal text-slate-500">gesamt · {data.count} Buchungen</span></p>
        <ul className="flex flex-wrap gap-2">{data.members.map(member => <li key={member.user_id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">{member.name}: <strong>{formatHours(member.minutes / 60)} h</strong></li>)}</ul>
      </div>
      {data.count === 0 && <p className="p-6 text-sm text-slate-500">Noch keine Arbeitszeiten für diesen Auftrag gebucht.</p>}
      <div className="hidden md:block overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500"><tr>{['Datum', 'Mitarbeiter', 'Zeitraum', 'Dauer', 'Beschreibung'].map(label => <th scope="col" key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">{data.entries.map(entry => <tr key={entry.id}>
          <td className="whitespace-nowrap px-4 py-3">{format(parseISO(entry.date), 'dd.MM.yyyy')}</td><td className="px-4 py-3">{entry.name}</td>
          <td className="whitespace-nowrap px-4 py-3">{entry.start_time.slice(0,5)}–{entry.end_time.slice(0,5)}</td><td className="whitespace-nowrap px-4 py-3 font-semibold">{formatHours(entry.duration_minutes / 60)} h</td><td className="max-w-sm break-words px-4 py-3">{entry.description || '–'}</td>
        </tr>)}</tbody>
      </table></div>
      <ul className="divide-y divide-slate-100 md:hidden">{data.entries.map(entry => <li key={entry.id} className="space-y-1 p-5 text-sm text-slate-700">
        <div className="flex justify-between gap-3"><strong>{entry.name}</strong><strong className="whitespace-nowrap">{formatHours(entry.duration_minutes / 60)} h</strong></div>
        <p className="text-xs text-slate-500">{format(parseISO(entry.date),'dd.MM.yyyy')} · {entry.start_time.slice(0,5)}–{entry.end_time.slice(0,5)}</p>
        <p className="break-words">{entry.description || 'Keine Beschreibung'}</p>
      </li>)}</ul>
      {(data.count > 25 || page > 0) && <nav aria-label="Seiten der Auftragszeiten" className="flex items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm text-slate-700">
        <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border border-slate-200 px-3 py-2 disabled:opacity-40">Zurück</button>
        <span>Seite {page + 1} von {Math.max(page + 1, Math.ceil(data.count / 25))}</span>
        <button disabled={(page + 1) * 25 >= data.count} onClick={() => setPage(page + 1)} className="rounded border border-slate-200 px-3 py-2 disabled:opacity-40">Weiter</button>
      </nav>}
    </>}
  </section>;
}
