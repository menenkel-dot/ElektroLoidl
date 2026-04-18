'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

const typeLabels = {
  vacation: 'Urlaub',
  sick: 'Krankheit',
  comp_time: 'Zeitausgleich'
};

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800'
};

const statusLabels = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt'
};

export function AbsenceView() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: userProfile } = useQuery({ queryKey: ['currentUser'], queryFn: api.getCurrentUser });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });
  const { data: absences, isLoading } = useQuery({ queryKey: ['absences'], queryFn: api.getAbsences });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: 'approved' | 'rejected' }) => api.updateAbsenceStatus(id, status),
    onSuccess: () => {
      toast.success('Status aktualisiert');
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  const isAdmin = userProfile?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Abwesenheiten</h2>
          <p className="mt-1 text-sm text-gray-500">
            {isAdmin ? 'Alle Anträge der Mitarbeiter verwalten.' : 'Deine Urlaubsanträge und Krankmeldungen.'}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Neuer Antrag
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Lade Anträge...</div>
        ) : absences?.length === 0 ? (
          <div className="p-12 text-center text-slate-500 italic">Keine Anträge vorhanden.</div>
        ) : (
          <ul role="list" className="divide-y divide-gray-100">
            {absences?.map((absence) => {
              const user = users?.find(u => u.id === absence.userId);
              
              return (
                <li key={absence.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-slate-500">{user?.name?.charAt(0) || '?'}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{user?.name || 'Unbekannt'}</p>
                        <p className="text-sm text-gray-500">
                          {typeLabels[absence.type]} &middot; {format(parseISO(absence.startDate), 'dd.MM.yyyy')} - {format(parseISO(absence.endDate), 'dd.MM.yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[absence.status]}`}>
                        {statusLabels[absence.status]}
                      </span>
                      {isAdmin && absence.status === 'pending' && (
                        <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                           <button 
                            onClick={() => statusMutation.mutate({ id: absence.id, status: 'approved' })} 
                            className="p-1.5 rounded-full text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Genehmigen"
                           >
                             <Check className="h-5 w-5" />
                           </button>
                           <button 
                            onClick={() => statusMutation.mutate({ id: absence.id, status: 'rejected' })} 
                            className="p-1.5 rounded-full text-red-600 hover:bg-red-50 transition-colors"
                            title="Ablehnen"
                           >
                             <X className="h-5 w-5" />
                           </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isModalOpen && (
        <AbsenceModal 
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['absences'] });
            queryClient.invalidateQueries({ queryKey: ['currentUser'] });
          }}
        />
      )}
    </div>
  );
}

function AbsenceModal({ onClose, onSuccess }: any) {
  const [type, setType] = useState<'vacation' | 'sick' | 'comp_time'>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const mutation = useMutation({
    mutationFn: api.addAbsence,
    onSuccess: () => {
      toast.success('Antrag erfolgreich gestellt');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Fehler: ' + error.message);
    }
  });

  return (
    <div className="relative z-50">
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="relative transform overflow-hidden rounded-xl bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">Abwesenheit beantragen</h3>
            <form onSubmit={e => { e.preventDefault(); mutation.mutate({ type, startDate, endDate }); }} className="mt-6 space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Art</label>
                <select required value={type} onChange={e => setType(e.target.value as any)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
                  <option value="vacation">Urlaub</option>
                  <option value="sick">Krankheit</option>
                  <option value="comp_time">Zeitausgleich</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Von</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bis</label>
                  <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
                </div>
              </div>

              <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                <button type="submit" disabled={mutation.isPending} className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:col-start-2 disabled:opacity-50">
                  {mutation.isPending ? 'Speichert...' : 'Beantragen'}
                </button>
                <button type="button" onClick={onClose} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0">
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