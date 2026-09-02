'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Calendar, CheckCircle, XCircle, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

// Definition der Typen für bessere Typsicherheit
type AbsenceType = 'vacation' | 'sick' | 'comp_time';

interface Absence {
  id: string;
  userId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface AbsenceUser {
  id: string;
  name: string;
  role: string;
}

const typeLabels: Record<AbsenceType, string> = {
  vacation: 'Urlaub',
  sick: 'Krankheit',
  comp_time: 'Zeitausgleich',
};

export function AbsenceView() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  
  // Wir casten die Daten explizit auf unseren Typ
  const { data: absences, isLoading } = useQuery<Absence[]>({ 
    queryKey: ['absences'], 
    queryFn: () => api.getAbsences(),
  });
  
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: api.getCurrentUser });
  const isAdmin = currentUser?.role === 'admin';
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: api.getUsers, enabled: isAdmin });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateAbsenceStatus(id, status),
    onSuccess: () => {
      toast.success('Status aktualisiert');
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteAbsence,
    onSuccess: () => {
      toast.success('Abwesenheitsantrag gelöscht');
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => toast.error('Fehler beim Löschen: ' + error.message),
  });

  const openCreateModal = () => {
    setEditingAbsence(null);
    setIsModalOpen(true);
  };

  const handleDelete = (absence: Absence) => {
    const balanceNote = absence.status === 'approved'
      ? ' Bereits verrechnete Kontingente werden automatisch zurückgebucht.'
      : '';
    if (window.confirm(`Soll diese Abwesenheit wirklich gelöscht werden?${balanceNote}`)) {
      deleteMutation.mutate(absence.id);
    }
  };

  if (isLoading) return <div className="text-slate-500">Lade Abwesenheiten...</div>;

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Abwesenheiten</h2>
          <p className="mt-1 text-sm text-gray-500">Urlaub, Krankheit und Zeitausgleich verwalten.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          {isAdmin ? 'Abwesenheit eintragen' : 'Antrag stellen'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <ul role="list" className="divide-y divide-gray-100">
          {absences?.map((absence) => {
            const user = users?.find(u => u.id === absence.userId);
            const userName = user?.name || (absence.userId === currentUser?.id ? currentUser.name : 'Unbekannt');
            const canEditPending = absence.status === 'pending' && (isAdmin || absence.userId === currentUser?.id);
            const canDelete = isAdmin || (absence.status === 'pending' && absence.userId === currentUser?.id);
            const label = typeLabels[absence.type] || absence.type;
            
            return (
              <li key={absence.id} className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      absence.type === 'vacation' ? 'bg-blue-100 text-blue-600' : 
                      absence.type === 'sick' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{userName}</p>
                      <p className="text-sm text-gray-500">
                        {label} &middot; {format(parseISO(absence.startDate), 'dd.MM.yyyy')} - {format(parseISO(absence.endDate), 'dd.MM.yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      absence.status === 'approved' ? 'bg-green-100 text-green-800' :
                      absence.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {absence.status === 'approved' ? 'Genehmigt' :
                       absence.status === 'rejected' ? 'Abgelehnt' : 'Ausstehend'}
                    </span>
                    {(canEditPending || canDelete) && (
                      <div className="flex gap-1">
                        {canEditPending && (
                          <button
                            type="button"
                            onClick={() => { setEditingAbsence(absence); setIsModalOpen(true); }}
                            className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                            title="Antrag bearbeiten"
                            aria-label="Antrag bearbeiten"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(absence)}
                            disabled={deleteMutation.isPending}
                            className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            title="Abwesenheit löschen"
                            aria-label="Abwesenheit löschen"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    )}
                    {isAdmin && absence.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: absence.id, status: 'approved' })}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Genehmigen"
                        >
                          <CheckCircle className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: absence.id, status: 'rejected' })}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Ablehnen"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {(!absences || absences.length === 0) && (
          <div className="p-12 text-center text-slate-500 italic">Keine Einträge vorhanden.</div>
        )}
      </div>

      {isModalOpen && (
        <AbsenceModal 
          onClose={() => setIsModalOpen(false)} 
          absence={editingAbsence}
          currentUser={currentUser}
          users={users || []}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['absences'] });
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AbsenceModal({ onClose, onSuccess, absence, currentUser, users }: {
  onClose: () => void;
  onSuccess: () => void;
  absence: Absence | null;
  currentUser: AbsenceUser | undefined;
  users: AbsenceUser[];
}) {
  const [type, setType] = useState<AbsenceType>(absence?.type || 'vacation');
  const [startDate, setStartDate] = useState(absence?.startDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(absence?.endDate || new Date().toISOString().split('T')[0]);
  const [userId, setUserId] = useState(absence?.userId || currentUser?.id || '');
  const isAdmin = currentUser?.role === 'admin';
  const selectableUsers = users
    .filter(user => user.role === 'employee' || user.id === currentUser?.id)
    .sort((a, b) => {
      if (a.id === currentUser?.id) return -1;
      if (b.id === currentUser?.id) return 1;
      return a.name.localeCompare(b.name, 'de');
    });

  const saveMutation = useMutation({
    mutationFn: (values: any) => absence ? api.updateAbsence(absence.id, values) : api.addAbsence(values),
    onSuccess: () => {
      toast.success(absence ? 'Antrag aktualisiert' : 'Antrag eingereicht');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error('Fehler: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(endDate) < new Date(startDate)) {
      toast.error('Das Enddatum muss nach dem Startdatum liegen.');
      return;
    }
    if (!absence && isAdmin && !userId) {
      toast.error('Bitte wählen Sie einen Mitarbeiter aus.');
      return;
    }
    saveMutation.mutate({ userId, type, startDate, endDate });
  };

  return (
    <div className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
            <div className="px-6 py-4 border-b border-slate-100">
               <h3 className="text-lg font-bold text-slate-900">
                 {absence ? 'Abwesenheitsantrag bearbeiten' : isAdmin ? 'Abwesenheit eintragen' : 'Abwesenheitsantrag'}
               </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!absence && isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="absence-user">Mitarbeiter</label>
                  <select
                    id="absence-user"
                    required
                    value={userId}
                    onChange={event => setUserId(event.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white"
                  >
                    {selectableUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name}{user.id === currentUser?.id ? ' (Ich)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">Der Eintrag wird zunächst als ausstehend gespeichert.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                <select 
                  value={type} 
                  onChange={e => setType(e.target.value as AbsenceType)} 
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white"
                >
                  <option value="vacation">Urlaub</option>
                  <option value="sick">Krankheit</option>
                  <option value="comp_time">Zeitausgleich</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
                  <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="submit" disabled={saveMutation.isPending} className="flex-1 justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saveMutation.isPending
                    ? 'Wird gespeichert...'
                    : absence
                      ? 'Änderungen speichern'
                      : isAdmin
                        ? 'Abwesenheit eintragen'
                        : 'Antrag stellen'}
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
