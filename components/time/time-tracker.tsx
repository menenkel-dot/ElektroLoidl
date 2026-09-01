'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Clock, Coffee, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

export function TimeTracker() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);

  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: api.getCurrentUser });
  const isAdmin = currentUser?.role === 'admin';
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: api.getClients });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: api.getProjects });
  const { data: services } = useQuery({ queryKey: ['services'], queryFn: api.getServices });
  const { data: entries } = useQuery({ queryKey: ['timeEntries'], queryFn: () => api.getTimeEntries() });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: api.getUsers, enabled: isAdmin });

  const deleteMutation = useMutation({
    mutationFn: api.deleteTimeEntry,
    onSuccess: () => {
      toast.success('Zeiteintrag gelöscht');
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
    onError: (error: any) => toast.error('Fehler beim Löschen: ' + error.message),
  });

  const openCreateModal = () => {
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Soll dieser Zeiteintrag wirklich gelöscht werden?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Zeiterfassung</h2>
          <p className="mt-1 text-sm text-gray-500">Ihre Arbeitszeiten dokumentieren und verwalten.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
          Neue Buchung
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <ul role="list" className="divide-y divide-gray-100">
          {entries?.map((entry) => {
            const client = clients?.find(c => c.id === entry.clientId);
            const project = projects?.find(p => p.id === entry.projectId);
            const service = services?.find(s => s.id === entry.serviceId);
            const user = users?.find(u => u.id === entry.userId);
            
            return (
              <li key={entry.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col gap-2 sm:gap-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{entry.description}</p>
                      {user && (
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase">
                          {user.name}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center text-xs text-gray-500 gap-2 font-medium">
                      <span className="bg-gray-100 px-2 py-0.5 rounded">{client?.name}</span>
                      <span>&rarr;</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded">{project?.name}</span>
                      {service && (
                        <>
                          <span>&rarr;</span>
                          <span className="bg-gray-100 px-2 py-0.5 rounded">{service.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-t border-gray-100 pt-3 sm:border-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-light text-gray-900">{(entry.durationMinutes / 60).toFixed(2)} h</p>
                      <p className="text-xs text-gray-500 sm:mt-1 font-mono">
                        {format(parseISO(entry.date), 'dd.MM.', { locale: de })} &middot; {entry.startTime} - {entry.endTime}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }}
                          className="rounded-md p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                          title="Zeiteintrag bearbeiten"
                          aria-label="Zeiteintrag bearbeiten"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          disabled={deleteMutation.isPending}
                          className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Zeiteintrag löschen"
                          aria-label="Zeiteintrag löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {(!entries || entries.length === 0) && (
          <div className="p-12 text-center text-slate-500 italic">Keine Einträge vorhanden.</div>
        )}
      </div>

      {isModalOpen && (
        <EntryModal 
          onClose={() => setIsModalOpen(false)} 
          clients={clients || []}
          projects={projects || []}
          services={services || []}
          users={users || []}
          currentUser={currentUser}
          entry={editingEntry}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['project'] });
          }}
        />
      )}
    </div>
  );
}

function EntryModal({ onClose, clients, projects, services, users, currentUser, entry, onSuccess }: any) {
  const grossMinutes = entry
    ? (new Date(`1970-01-01T${entry.endTime}:00`).getTime() - new Date(`1970-01-01T${entry.startTime}:00`).getTime()) / 60000
    : 0;
  const [selectedTargetUserId, setSelectedTargetUserId] = useState(entry?.userId || '');
  const [clientId, setClientId] = useState(entry?.clientId || '');
  const [projectId, setProjectId] = useState(entry?.projectId || '');
  const [serviceId, setServiceId] = useState(entry?.serviceId || '');
  const [date, setDate] = useState(entry?.date || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(entry?.startTime || '08:00');
  const [endTime, setEndTime] = useState(entry?.endTime || '16:00');
  const [pauseMinutes, setPauseMinutes] = useState(entry ? String(Math.max(0, grossMinutes - entry.durationMinutes)) : '30');
  const [description, setDescription] = useState(entry?.description || '');
  const [materialRecordedConfirmed, setMaterialRecordedConfirmed] = useState(Boolean(entry));

  const targetUserId = selectedTargetUserId || currentUser?.id || '';

  const saveMutation = useMutation({
    mutationFn: (values: any) => entry ? api.updateTimeEntry(entry.id, values) : api.addTimeEntry(values),
    onSuccess: () => {
      toast.success(entry ? 'Zeiteintrag aktualisiert' : 'Zeiteintrag erfolgreich gespeichert');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Fehler beim Speichern: ' + error.message);
    }
  });

  const availableProjects = projects.filter((p: any) => p.clientId === clientId);
  const availableServices = services.filter((s: any) => s.projectId === projectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!targetUserId) {
      toast.error('Bitte wählen Sie einen Mitarbeiter aus.');
      return;
    }

    if (!materialRecordedConfirmed) {
      toast.error('Bitte bestätigen Sie, dass das benötigte Material erfasst wurde.');
      return;
    }

    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    
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
      serviceId: serviceId || null,
      date,
      startTime,
      endTime,
      durationMinutes: diff,
      description,
      materialRecordedConfirmed,
    });
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
            <div className="px-6 py-4 border-b border-slate-100">
               <h3 className="text-lg font-bold text-slate-900">{entry ? 'Zeiteintrag bearbeiten' : 'Zeiteintrag erstellen'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter</label>
                  <select required value={targetUserId} onChange={e => setSelectedTargetUserId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
                    <option value="">Bitte wählen...</option>
                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kunde</label>
                  <select required value={clientId} onChange={e => { setClientId(e.target.value); setProjectId(''); setServiceId(''); }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
                    <option value="">Bitte wählen...</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auftrag</label>
                  <select required disabled={!clientId} value={projectId} onChange={e => { setProjectId(e.target.value); setServiceId(''); }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white disabled:bg-gray-100">
                    <option value="">Bitte wählen...</option>
                    {availableProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leistung (optional)</label>
                <select disabled={!projectId} value={serviceId} onChange={e => setServiceId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white disabled:bg-gray-100">
                  <option value="">Keine spezielle Leistung</option>
                  {availableServices.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

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
