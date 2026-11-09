'use client';

import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Clock, Coffee } from 'lucide-react';
import toast from 'react-hot-toast';

type TimeEntry = Awaited<ReturnType<typeof api.getTimeEntries>>[number];
type ClientRecord = Awaited<ReturnType<typeof api.getClients>>[number];
type ProjectRecord = Awaited<ReturnType<typeof api.getProjects>>[number];
type UserRecord = Pick<Awaited<ReturnType<typeof api.getUsers>>[number], 'id' | 'name'>;
type CurrentUser = Awaited<ReturnType<typeof api.getCurrentUser>>;

export function EntryModal({
  onClose, clients = [], projects = [], users, currentUser, entry, initialUserId, fixedProject,
}: {
  onClose: () => void;
  clients?: ClientRecord[];
  projects?: ProjectRecord[];
  users: UserRecord[];
  currentUser: CurrentUser | undefined;
  entry?: TimeEntry | null;
  initialUserId?: string;
  fixedProject?: { id: string; name: string; clientId: string; clientName: string };
}) {
  const queryClient = useQueryClient();
  const titleId = useId();
  const grossMinutes = entry
    ? (new Date(`1970-01-01T${entry.endTime}`).getTime() - new Date(`1970-01-01T${entry.startTime}`).getTime()) / 60000
    : 0;
  const [selectedTargetUserId, setSelectedTargetUserId] = useState(entry?.userId || initialUserId || '');
  const [selectedClientId, setClientId] = useState(entry?.clientId || '');
  const [selectedProjectId, setProjectId] = useState(entry?.projectId || '');
  const clientId = fixedProject?.clientId ?? selectedClientId;
  const projectId = fixedProject?.id ?? selectedProjectId;
  const [date, setDate] = useState(entry?.date || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(entry?.startTime || '07:00');
  const [endTime, setEndTime] = useState(entry?.endTime || '16:00');
  const [pauseMinutes, setPauseMinutes] = useState(entry ? String(Math.max(0, grossMinutes - entry.durationMinutes)) : '30');
  const [description, setDescription] = useState(entry?.description || '');
  const [materialRecordedConfirmed, setMaterialRecordedConfirmed] = useState(Boolean(entry));

  const isAdmin = currentUser?.role === 'admin';
  const targetUserId = isAdmin ? selectedTargetUserId : currentUser?.id || '';

  const saveMutation = useMutation({
    mutationFn: (values: { userId: string; clientId: string; projectId: string; serviceId: string | null;
      date: string; startTime: string; endTime: string; durationMinutes: number;
      description: string; materialRecordedConfirmed: boolean }) => entry ? api.updateTimeEntry(entry.id, values) : api.addTimeEntry(values),
    onSuccess: () => {
      toast.success(entry ? 'Zeiteintrag aktualisiert' : 'Zeiteintrag erfolgreich gespeichert');
      void Promise.all(['timeEntries', 'reportEntries', 'workBalances', 'projects', 'project'].map(key =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ));
      onClose();
    },
    onError: (error: Error) => {
      toast.error('Fehler beim Speichern: ' + error.message);
    }
  });

  const bookableProjects = projects.filter((project) =>
    !project.isArchived || (isAdmin && project.id === entry?.projectId),
  );
  const bookableClientIds = new Set(bookableProjects.map((project) => project.clientId));
  const availableClients = isAdmin
    ? clients
    : clients.filter((client) => bookableClientIds.has(client.id));
  const availableProjects = bookableProjects.filter((project) =>
    project.clientId === clientId,
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!targetUserId) {
      toast.error('Bitte wählen Sie einen Mitarbeiter aus.');
      return;
    }

    if (!materialRecordedConfirmed) {
      toast.error('Bitte bestätigen Sie, dass das benötigte Material erfasst wurde.');
      return;
    }

    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);

    if (end <= start) {
      toast.error('Die Endzeit muss nach der Startzeit liegen.');
      return;
    }

    // Brutto-Dauer in Minuten
    let diff = (end.getTime() - start.getTime()) / 60000;

    // Pausenabzug
    const pause = parseInt(pauseMinutes) || 0;
    diff = diff - pause;

    if (diff <= 0) {
      toast.error('Die Arbeitszeit inklusive Pause darf nicht 0 oder negativ sein.');
      return;
    }

    saveMutation.mutate({
      userId: targetUserId,
      clientId,
      projectId,
      serviceId: entry?.serviceId || null,
      date,
      startTime,
      endTime,
      durationMinutes: diff,
      description,
      materialRecordedConfirmed,
    });
  };

  return (
    <div className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
            <div className="px-6 py-4 border-b border-slate-100">
               <h3 id={titleId} className="text-lg font-bold text-slate-900">{entry ? 'Zeiteintrag bearbeiten' : 'Zeiteintrag erstellen'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter</label>
                  <select required value={targetUserId} onChange={e => setSelectedTargetUserId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
                    <option value="">Bitte wählen...</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}

              {fixedProject ? (
                <dl className="grid gap-3 rounded-lg border border-slate-200 p-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-500">Kunde</dt><dd className="break-words font-semibold">{fixedProject.clientName}</dd></div>
                  <div><dt className="text-slate-500">Auftrag</dt><dd className="break-words font-semibold">{fixedProject.name}</dd></div>
                </dl>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kunde</label>
                    <select required value={clientId} onChange={e => { setClientId(e.target.value); setProjectId(''); }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
                      <option value="">Bitte wählen...</option>
                      {availableClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Auftrag</label>
                    <select required disabled={!clientId} value={projectId} onChange={e => setProjectId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white disabled:bg-gray-100">
                      <option value="">Bitte wählen...</option>
                      {availableProjects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isArchived ? ' (archiviert)' : ''}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Pause (Min.)</label>
                   <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <Coffee className="h-4 w-4 text-gray-400" />
                      </div>
                      <input type="number" min="0" value={pauseMinutes} onChange={e => setPauseMinutes(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 pl-9 pr-3 border" />
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Von (Uhrzeit)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Clock className="h-4 w-4 text-gray-400" />
                    </div>
                    <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 pl-9 pr-3 border" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bis (Uhrzeit)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Clock className="h-4 w-4 text-gray-400" />
                    </div>
                    <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 pl-9 pr-3 border" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea required rows={2} value={description} onChange={e => setDescription(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" placeholder="Was wurde erledigt?" />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <input
                  type="checkbox"
                  required
                  checked={materialRecordedConfirmed}
                  onChange={event => setMaterialRecordedConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block font-semibold">Benötigtes Material erfasst</span>
                  <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">Der Zeiteintrag kann erst nach dieser Bestätigung gespeichert werden.</span>
                </span>
              </label>

              <div className="pt-4 flex gap-3">
                <button type="submit" disabled={saveMutation.isPending || !materialRecordedConfirmed} className="flex-1 justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
                  {saveMutation.isPending ? 'Speichert...' : 'Speichern'}
                </button>
                <button type="button" onClick={onClose} className="flex-1 justify-center rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
