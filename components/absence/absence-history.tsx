'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { api } from '@/lib/api';

const dateTime = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
});

const labels = {
  submitted: 'Eingereicht',
  edited: 'Bearbeitet',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  reopened: 'Erneut geöffnet',
};

function formatPeriod([start, end]: [string, string]) {
  return `${format(parseISO(start), 'dd.MM.yyyy')} – ${format(parseISO(end), 'dd.MM.yyyy')}`;
}

export function AbsenceHistory({ absenceId, typeLabels }: {
  absenceId: string;
  typeLabels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const history = useQuery({
    queryKey: ['absenceHistory', absenceId],
    queryFn: () => api.getAbsenceHistory(absenceId),
    enabled: open,
  });

  return (
    <details className="mt-3 text-sm" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="w-fit cursor-pointer font-medium text-slate-700">Historie</summary>
      {open && (
        <div className="mt-2 rounded-lg bg-slate-50 p-3 text-slate-600">
          {history.isPending ? <p role="status">Historie wird geladen …</p> : history.isError ? (
            <p role="alert">Die Historie konnte nicht geladen werden.{' '}
              <button type="button" className="underline" onClick={() => history.refetch()}>Erneut versuchen</button>
            </p>
          ) : history.data.length === 0 ? <p>Keine Historie erfasst.</p> : (
            <ol className="space-y-3">
              {history.data.map(({ id, action, occurred_at, actor_name, changes }) => (
                <li key={id} className="border-l-2 border-slate-200 pl-3">
                  <p className="font-semibold text-slate-900">{labels[action]}</p>
                  <p>
                    {occurred_at ? (
                      <><time dateTime={occurred_at}>{dateTime.format(new Date(occurred_at))} Uhr</time>
                        {' · '}{actor_name || 'Bearbeiter nicht erfasst'}</>
                    ) : actor_name ? (
                      <>{actor_name} · Zeitpunkt nicht erfasst</>
                    ) : 'Zeitpunkt und Bearbeiter nicht erfasst'}
                  </p>
                  {changes?.type && (
                    <p>Abwesenheitsart: {changes.type.map(type => typeLabels[type] || type).join(' → ')}</p>
                  )}
                  {changes?.period && (
                    <p>Zeitraum: {changes.period.map(formatPeriod).join(' → ')}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </details>
  );
}
