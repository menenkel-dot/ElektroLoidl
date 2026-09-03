'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { workTimeApi, formatHours } from '@/lib/work-time-api';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Coffee, Pencil, Plus, Trash2, UserRound, Users } from 'lucide-react';
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

export function TimeTracker() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [createTargetUserId, setCreateTargetUserId] = useState('');
  const [viewMode, setViewMode] = useState<'own' | 'team'>('team');
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [selectedTeamUserId, setSelectedTeamUserId] = useState<string | null>(null);

  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: api.getCurrentUser });
  const isAdmin = currentUser?.role === 'admin';
  const effectiveViewMode = isAdmin ? viewMode : 'own';
  const selectedStartDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
  const selectedEndDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: api.getClients });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: api.getProjects });
  const { data: services } = useQuery({ queryKey: ['services'], queryFn: api.getServices });
  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['timeEntries', selectedStartDate, selectedEndDate],
    queryFn: () => api.getTimeEntries({ startDate: selectedStartDate, endDate: selectedEndDate }),
    enabled: Boolean(currentUser),
  });
  const balancesQuery = useQuery({
    queryKey: ['workBalances', currentUser?.id],
    queryFn: workTimeApi.getBalances,
    enabled: isAdmin,
  });
  const { data: users, isLoading: usersLoading } = useQuery({ queryKey: ['users'], queryFn: api.getUsers, enabled: isAdmin });
  const balanceLoading = usersLoading || balancesQuery.isLoading;

  const clientMap = useMemo(() => new Map((clients || []).map(client => [client.id, client])), [clients]);
  const projectMap = useMemo(() => new Map((projects || []).map(project => [project.id, project])), [projects]);
  const serviceMap = useMemo(() => new Map((services || []).map(service => [service.id, service])), [services]);
  const teamUsers = useMemo(() => (users || [])
    .filter(user => user.id !== currentUser?.id)
    .sort((left, right) => left.name.localeCompare(right.name, 'de')),
  [currentUser?.id, users]);
  const overtimeByUser = useMemo(() => new Map((balancesQuery.data || []).map(balance => [balance.user_id, balance.balance_hours])), [balancesQuery.data]);
  const selectedTeamUser = teamUsers.find(user => user.id === selectedTeamUserId);
  const visibleEntries = useMemo(() => {
    const targetUserId = effectiveViewMode === 'own' ? currentUser?.id : selectedTeamUserId;
    if (!targetUserId) return [];
    return (entries || []).filter(entry => entry.userId === targetUserId);
  }, [currentUser?.id, effectiveViewMode, entries, selectedTeamUserId]);

  const deleteMutation = useMutation({
    mutationFn: api.deleteTimeEntry,
    onSuccess: () => {
      toast.success('Zeiteintrag gelöscht');
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['workBalances'] });
    },
    onError: (error: any) => toast.error('Fehler beim Löschen: ' + error.message),
  });

  const openCreateModal = () => {
    setEditingEntry(null);
    setCreateTargetUserId(effectiveViewMode === 'team' ? selectedTeamUserId || '' : currentUser?.id || '');
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
          <p className="mt-1 text-sm text-gray-500">{isAdmin ? 'Arbeitszeiten übersichtlich nach Person und Monat verwalten.' : 'Ihre Arbeitszeiten nach Monat verwalten.'}</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
          Neue Buchung
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isAdmin ? (
          <div className="inline-flex self-start rounded-lg border border-slate-200 bg-slate-100 p-1" aria-label="Zeiterfassungsansicht auswählen">
            <button type="button" onClick={() => setViewMode('team')} aria-pressed={effectiveViewMode === 'team'} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${effectiveViewMode === 'team' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <Users className="h-4 w-4" /> Teamzeiten
            </button>
            <button type="button" onClick={() => setViewMode('own')} aria-pressed={effectiveViewMode === 'own'} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${effectiveViewMode === 'own' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <UserRound className="h-4 w-4" /> Meine Arbeitszeiten
            </button>
          </div>
        ) : <div />}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
            <button type="button" onClick={() => setSelectedMonth(previous => addMonths(previous, -1))} className="p-2 text-slate-500 hover:text-slate-800" aria-label="Vorheriger Monat"><ChevronLeft className="h-5 w-5" /></button>
            <span className="min-w-[150px] px-3 text-center text-sm font-semibold capitalize text-slate-700">{format(selectedMonth, 'MMMM yyyy', { locale: de })}</span>
            <button type="button" onClick={() => setSelectedMonth(previous => addMonths(previous, 1))} className="p-2 text-slate-500 hover:text-slate-800" aria-label="Nächster Monat"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <button type="button" onClick={() => setSelectedMonth(startOfMonth(new Date()))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">Heute</button>
        </div>
      </div>

      {effectiveViewMode === 'team' && isAdmin && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-base font-bold text-slate-900">Aktuelle Überstundenkonten</h3>
            <p className="mt-1 text-xs text-slate-500">Stand heute · Person auswählen, um die Buchungen des gewählten Monats zu öffnen.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {balanceLoading ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">Lade Überstundenkonten...</p>
            ) : balancesQuery.isError ? <p role="alert" className="p-5 text-sm text-red-600">Konten konnten nicht geladen werden. <button onClick={() => balancesQuery.refetch()} className="underline">Erneut versuchen</button></p> : teamUsers.map(user => {
              const balance = overtimeByUser.get(user.id) || 0;
              const isSelected = selectedTeamUserId === user.id;
              return (
                <button key={user.id} type="button" onClick={() => setSelectedTeamUserId(user.id)} aria-pressed={isSelected} className={`grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 text-left transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">{user.name}</span>
                    <span className="mt-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">{user.role === 'admin' ? 'Admin' : 'Mitarbeiter'}</span>
                  </span>
                  <span className={`text-lg font-bold tabular-nums ${balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-600' : 'text-slate-500'}`}>{balance > 0 ? '+' : ''}{formatHours(balance)} h</span>
                </button>
              );
            })}
            {!balanceLoading && teamUsers.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">Keine weiteren Benutzer vorhanden.</p>}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-slate-400" />
          <h3 className="text-base font-bold text-slate-900">{effectiveViewMode === 'own' ? 'Meine Buchungen' : selectedTeamUser ? `Buchungen von ${selectedTeamUser.name}` : 'Mitarbeiter auswählen'}</h3>
        </div>
        {effectiveViewMode === 'team' && !selectedTeamUser ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Wählen Sie oben eine Person aus, um deren Arbeitszeiten anzuzeigen.</div>
        ) : (
          <TimeEntryList
            entries={visibleEntries}
            clientMap={clientMap}
            projectMap={projectMap}
            serviceMap={serviceMap}
            isAdmin={isAdmin}
            isLoading={entriesLoading}
            deletePending={deleteMutation.isPending}
            onEdit={entry => { setEditingEntry(entry); setIsModalOpen(true); }}
            onDelete={handleDelete}
          />
        )}
      </section>

      {isModalOpen && (
        <EntryModal 
          onClose={() => setIsModalOpen(false)} 
          clients={clients || []}
          projects={projects || []}
          users={users || []}
          currentUser={currentUser}
          entry={editingEntry}
          initialUserId={createTargetUserId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            queryClient.invalidateQueries({ queryKey: ['workBalances'] });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['project'] });
          }}
        />
      )}
    </div>
  );
}

type TimeEntry = Awaited<ReturnType<typeof api.getTimeEntries>>[number];
type ClientRecord = Awaited<ReturnType<typeof api.getClients>>[number];
type ProjectRecord = Awaited<ReturnType<typeof api.getProjects>>[number];
type ServiceRecord = Awaited<ReturnType<typeof api.getServices>>[number];

function TimeEntryList({ entries, clientMap, projectMap, serviceMap, isAdmin, isLoading, deletePending, onEdit, onDelete }: {
  entries: TimeEntry[];
  clientMap: Map<string, ClientRecord>;
  projectMap: Map<string, ProjectRecord>;
  serviceMap: Map<string, ServiceRecord>;
  isAdmin: boolean;
  isLoading: boolean;
  deletePending: boolean;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: string) => void;
}) {
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, TimeEntry[]>();
    entries.forEach(entry => {
      const group = groups.get(entry.date);
      if (group) group.push(entry);
      else groups.set(entry.date, [entry]);
    });
    return Array.from(groups.entries());
  }, [entries]);

  if (isLoading) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Lade Arbeitszeiten...</div>;
  if (groupedEntries.length === 0) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Für diesen Monat sind keine Buchungen vorhanden.</div>;

  return (
    <div className="space-y-4">
      {groupedEntries.map(([date, dayEntries]) => {
        const dailyMinutes = dayEntries.reduce((total, entry) => total + entry.durationMinutes, 0);
        return (
          <div key={date} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
              <h4 className="text-sm font-bold capitalize text-slate-700">{format(parseISO(date), 'EEEE, dd. MMMM yyyy', { locale: de })}</h4>
              <span className="text-sm font-bold tabular-nums text-slate-900">{(dailyMinutes / 60).toFixed(2)} h</span>
            </div>
            <ul role="list" className="divide-y divide-slate-100">
              {dayEntries.map(entry => {
                const client = clientMap.get(entry.clientId);
                const project = projectMap.get(entry.projectId);
                const service = entry.serviceId ? serviceMap.get(entry.serviceId) : undefined;
                return (
                  <li key={entry.id} className="p-4 transition-colors hover:bg-slate-50 sm:px-5">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{entry.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                          <span className="rounded bg-slate-100 px-2 py-0.5">{client?.name || 'Unbekannter Kunde'}</span>
                          <span>→</span>
                          <span className="rounded bg-slate-100 px-2 py-0.5">{project?.name || 'Unbekannter Auftrag'}</span>
                          {service && <><span>→</span><span className="rounded bg-slate-100 px-2 py-0.5">{service.name}</span></>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                        <div className="sm:text-right">
                          <p className="text-base font-bold tabular-nums text-slate-900">{(entry.durationMinutes / 60).toFixed(2)} h</p>
                          <p className="mt-1 font-mono text-xs text-slate-500">{entry.startTime.substring(0, 5)}–{entry.endTime.substring(0, 5)}</p>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => onEdit(entry)} className="rounded-md p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600" title="Zeiteintrag bearbeiten" aria-label="Zeiteintrag bearbeiten"><Pencil className="h-4 w-4" /></button>
                            <button type="button" onClick={() => onDelete(entry.id)} disabled={deletePending} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Zeiteintrag löschen" aria-label="Zeiteintrag löschen"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function EntryModal({ onClose, clients, projects, users, currentUser, entry, initialUserId, onSuccess }: any) {
  const grossMinutes = entry
    ? (new Date(`1970-01-01T${entry.endTime}:00`).getTime() - new Date(`1970-01-01T${entry.startTime}:00`).getTime()) / 60000
    : 0;
  const [selectedTargetUserId, setSelectedTargetUserId] = useState(entry?.userId || initialUserId || '');
  const [clientId, setClientId] = useState(entry?.clientId || '');
  const [projectId, setProjectId] = useState(entry?.projectId || '');
  const [date, setDate] = useState(entry?.date || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(entry?.startTime || '08:00');
  const [endTime, setEndTime] = useState(entry?.endTime || '16:00');
  const [pauseMinutes, setPauseMinutes] = useState(entry ? String(Math.max(0, grossMinutes - entry.durationMinutes)) : '30');
  const [description, setDescription] = useState(entry?.description || '');
  const [materialRecordedConfirmed, setMaterialRecordedConfirmed] = useState(Boolean(entry));

  const isAdmin = currentUser?.role === 'admin';
  const targetUserId = isAdmin ? selectedTargetUserId : currentUser?.id || '';

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
                  <select required value={clientId} onChange={e => { setClientId(e.target.value); setProjectId(''); }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
                    <option value="">Bitte wählen...</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auftrag</label>
                  <select required disabled={!clientId} value={projectId} onChange={e => setProjectId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white disabled:bg-gray-100">
                    <option value="">Bitte wählen...</option>
                    {availableProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
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
