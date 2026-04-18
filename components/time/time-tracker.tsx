'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

export function TimeTracker() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: api.getCurrentUser });
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: api.getClients });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: api.getProjects });
  const { data: services } = useQuery({ queryKey: ['services'], queryFn: api.getServices });
  const { data: entries } = useQuery({ queryKey: ['timeEntries'], queryFn: api.getTimeEntries });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Zeiterfassung</h2>
          <p className="mt-1 text-sm text-gray-500">Ihre Arbeitszeiten dokumentieren und verwalten.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
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
                  <div className="text-left sm:text-right flex items-center justify-between sm:block border-t sm:border-0 border-gray-100 pt-3 sm:pt-0">
                    <p className="text-lg font-light text-gray-900">{(entry.durationMinutes / 60).toFixed(2)} h</p>
                    <p className="text-xs text-gray-500 sm:mt-1 font-mono">
                      {format(parseISO(entry.date), 'dd.MM.', { locale: de })} &middot; {entry.startTime} - {entry.endTime}
                    </p>
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
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['timeEntries'] })}
        />
      )}
    </div>
  );
}

function EntryModal({ onClose, clients, projects, services, users, currentUser, onSuccess }: any) {
  const [targetUserId, setTargetUserId] = useState(currentUser?.id || '');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [description, setDescription] = useState('');

  // Sync userId if currentUser loads after modal open
  useEffect(() => {
    if (currentUser?.id && !targetUserId) {
      setTargetUserId(currentUser.id);
    }
  }, [currentUser, targetUserId]);

  const addMutation = useMutation({
    mutationFn: api.addTimeEntry,
    onSuccess: () => {
      toast.success('Zeiteintrag erfolgreich gespeichert');
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

    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    
    if (end <= start) {
      toast.error('Die Endzeit muss nach der Startzeit liegen.');
      return;
    }

    let diff = (end.getTime() - start.getTime()) / 60000;
    
    // Automatische Pausenabzug bei > 6h
    if (diff > 360) {
        diff -= 30;
    }

    addMutation.mutate({
      userId: targetUserId,
      clientId,
      projectId,
      serviceId: serviceId || null,
      date,
      startTime,
      endTime,
      durationMinutes: diff,
      description
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
               <h3 className="text-lg font-bold text-slate-900">Zeiteintrag erstellen</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter</label>
                  <select required value={targetUserId} onChange={e => setTargetUserId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
                    <option value="">Bitte wählen...</option>
                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}

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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leistung (optional)</label>
                <select disabled={!projectId} value={serviceId} onChange={e => setServiceId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white disabled:bg-gray-100">
                  <option value="">Keine spezielle Leistung</option>
                  {availableServices.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
                </div>
                <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
                    <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
                    <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea required rows={2} value={description} onChange={e => setDescription(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" placeholder="Was wurde erledigt?" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="submit" disabled={addMutation.isPending} className="flex-1 justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {addMutation.isPending ? 'Speichert...' : 'Speichern'}
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