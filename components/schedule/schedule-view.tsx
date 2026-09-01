'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChevronLeft, ChevronRight, Plus, Clock, Plane, HeartPulse, History, Trash2 } from 'lucide-react';
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isWithinInterval, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

const typeLabels = {
  vacation: { label: 'Urlaub', icon: Plane, color: 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100' },
  sick: { label: 'Krank', icon: HeartPulse, color: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100' },
  comp_time: { label: 'ZA', icon: History, color: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100' }
};

export function ScheduleView() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });
  const { data: assignments } = useQuery({ queryKey: ['assignments'], queryFn: api.getAssignments });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: api.getProjects });
  const { data: absences } = useQuery({ queryKey: ['absences'], queryFn: api.getAbsences });

  const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }).map((_, i) => addDays(startOfCurrentWeek, i));
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
  });
  const today = new Date();
  const userMap = useMemo(() => new Map((users || []).map(user => [user.id, user])), [users]);
  const projectMap = useMemo(() => new Map((projects || []).map(project => [project.id, project])), [projects]);

  const assignmentsForDay = (day: Date, userId?: string) => (assignments || []).filter(assignment => {
    if (userId && assignment.userId !== userId) return false;
    return isWithinInterval(day, {
      start: parseISO(assignment.startDate),
      end: parseISO(assignment.endDate),
    });
  });

  const absencesForDay = (day: Date, userId?: string) => (absences || []).filter(absence => {
    if (absence.status !== 'approved' || (userId && absence.userId !== userId)) return false;
    return isWithinInterval(day, {
      start: parseISO(absence.startDate),
      end: parseISO(absence.endDate),
    });
  });

  const changePeriod = (direction: -1 | 1) => {
    setCurrentDate(previous => viewMode === 'week'
      ? addDays(previous, direction * 7)
      : addMonths(previous, direction));
  };

  const periodLabel = viewMode === 'week'
    ? `KW ${format(currentDate, 'I', { locale: de })} · ${format(weekDays[0], 'dd.MM.')} - ${format(weekDays[4], 'dd.MM.yyyy')}`
    : format(currentDate, 'MMMM yyyy', { locale: de });

  const handleOpenModal = (assignment: any = null) => {
    setEditingAssignment(assignment);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">Einsatzplan</h2>
          <p className="mt-2 text-[14px] text-slate-500">Mitarbeiter Aufträgen mit Uhrzeit zuweisen.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1" aria-label="Kalenderansicht auswählen">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              aria-pressed={viewMode === 'week'}
              className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${viewMode === 'week' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Woche
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              aria-pressed={viewMode === 'month'}
              className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${viewMode === 'month' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Monat
            </button>
          </div>
          <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-sm">
            <button type="button" onClick={() => changePeriod(-1)} className="p-2 text-gray-500 hover:text-gray-700" aria-label={viewMode === 'week' ? 'Vorherige Woche' : 'Vorheriger Monat'}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-[190px] px-3 text-center text-[13px] font-semibold capitalize text-slate-700">
              {periodLabel}
            </span>
            <button type="button" onClick={() => changePeriod(1)} className="p-2 text-gray-500 hover:text-gray-700" aria-label={viewMode === 'week' ? 'Nächste Woche' : 'Nächster Monat'}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <button type="button" onClick={() => setCurrentDate(new Date())} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
            Heute
          </button>
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Zuweisen
          </button>
        </div>
      </div>

      {viewMode === 'week' ? (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="min-w-[1000px]">
          {/* Header Row */}
          <div className="grid grid-cols-6 border-b border-gray-200 bg-gray-50">
            <div className="p-4 border-r border-gray-200 font-semibold text-gray-900 text-sm">Mitarbeiter</div>
            {weekDays.map(day => (
              <div key={day.toISOString()} className="p-4 border-r border-gray-200 text-center">
                <p className="text-xs text-gray-500 uppercase">{format(day, 'EEEE', { locale: de })}</p>
                <p className="font-medium text-gray-900">{format(day, 'dd.MM.')}</p>
              </div>
            ))}
          </div>
          
          {/* User Rows */}
          <div className="divide-y divide-gray-100">
            {users?.map(user => (
              <div key={user.id} className="grid grid-cols-6 hover:bg-gray-50/50">
                <div className="p-4 border-r border-gray-200 flex items-center gap-3 bg-white">
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                     <span className="text-slate-500 font-semibold text-xs">{user.name.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{user.name}</span>
                </div>
                {weekDays.map(day => {
                  const dayAssignments = assignmentsForDay(day, user.id);
                  const dayAbsences = absencesForDay(day, user.id);

                  return (
                    <div key={day.toISOString()} className="p-2 border-r border-gray-200 relative min-h-[100px]">
                      {/* Zeige Abwesenheiten */}
                      {dayAbsences.map(abs => {
                        const style = typeLabels[abs.type as keyof typeof typeLabels] || typeLabels.vacation;
                        const Icon = style.icon;
                        return (
                          <div 
                            key={abs.id}
                            className={`flex items-center gap-1.5 rounded p-2 mb-2 text-xs font-bold border ${style.color} shadow-sm transition-colors`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{style.label}</span>
                          </div>
                        );
                      })}

                      {/* Zeige Zuweisungen */}
                      {dayAssignments.map(asg => {
                        const project = projects?.find(p => p.id === asg.projectId);
                        return (
                          <button 
                            key={asg.id} 
                            onClick={() => handleOpenModal(asg)}
                            className="w-full text-left block bg-blue-50 border border-blue-200 rounded p-2 mb-2 text-xs text-blue-800 shadow-sm hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-1 font-bold mb-1">
                              <Clock className="w-3 h-3" />
                              {asg.startTime ? asg.startTime.substring(0, 5) : 'Ganztag'}
                              {asg.endTime && ` - ${asg.endTime.substring(0, 5)}`}
                            </div>
                            <span className="font-semibold block truncate">{project?.name}</span>
                            <span className="truncate block opacity-80 mt-1 italic">{asg.details}</span>
                          </button>
                        )
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'].map(dayName => (
                <div key={dayName} className="border-r border-slate-200 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 last:border-r-0">
                  {dayName}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dayAssignments = assignmentsForDay(day);
                const dayAbsences = absencesForDay(day);
                const belongsToMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, today);

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[155px] border-slate-200 p-2 ${index % 7 === 6 ? '' : 'border-r'} ${index >= calendarDays.length - 7 ? '' : 'border-b'} ${belongsToMonth ? 'bg-white' : 'bg-slate-50/70'}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${isToday ? 'bg-blue-600 text-white' : belongsToMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                        {format(day, 'd')}
                      </span>
                      {dayAssignments.length > 0 && (
                        <span className="text-[10px] font-semibold text-slate-400">{dayAssignments.length} Einsatz{dayAssignments.length === 1 ? '' : 'e'}</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {dayAbsences.map(absence => {
                        const style = typeLabels[absence.type as keyof typeof typeLabels] || typeLabels.vacation;
                        const Icon = style.icon;
                        return (
                          <div key={absence.id} className={`flex items-center gap-1 rounded border px-1.5 py-1 text-[10px] font-bold ${style.color}`}>
                            <Icon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{userMap.get(absence.userId)?.name || 'Mitarbeiter'} · {style.label}</span>
                          </div>
                        );
                      })}
                      {dayAssignments.map(assignment => {
                        const user = userMap.get(assignment.userId);
                        const project = projectMap.get(assignment.projectId);
                        return (
                          <button
                            key={assignment.id}
                            type="button"
                            onClick={() => handleOpenModal(assignment)}
                            className="block w-full rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-left text-[10px] text-blue-900 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-100"
                            title={`${user?.name || 'Mitarbeiter'} · ${project?.name || 'Auftrag'}`}
                          >
                            <span className="block truncate font-bold">{user?.name || 'Mitarbeiter'}</span>
                            <span className="block truncate font-semibold">{project?.name || 'Unbekannter Auftrag'}</span>
                            <span className="mt-0.5 flex items-center gap-1 text-blue-700">
                              <Clock className="h-2.5 w-2.5" />
                              {assignment.startTime ? assignment.startTime.substring(0, 5) : 'Ganztag'}
                              {assignment.endTime && ` - ${assignment.endTime.substring(0, 5)}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <AssignmentModal 
          assignment={editingAssignment}
          onClose={() => {
            setIsModalOpen(false);
            setEditingAssignment(null);
          }}
          users={users || []}
          projects={projects || []}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['assignments'] })}
        />
      )}
    </div>
  );
}

function AssignmentModal({ assignment, onClose, users, projects, onSuccess }: any) {
  const [userId, setUserId] = useState(assignment?.userId || '');
  const [projectId, setProjectId] = useState(assignment?.projectId || '');
  const initialStartDate = assignment?.startDate || new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(assignment?.endDate || initialStartDate);
  const [startTime, setStartTime] = useState(assignment?.startTime?.substring(0, 5) || '07:30');
  const [endTime, setEndTime] = useState(assignment?.endTime?.substring(0, 5) || '16:30');
  const [details, setDetails] = useState(assignment?.details || '');

  const mutation = useMutation({
    mutationFn: (data: any) => assignment ? api.updateAssignment(assignment.id, data) : api.addAssignment(data),
    onSuccess: () => {
      toast.success(assignment ? 'Einsatz aktualisiert' : 'Einsatz zugewiesen');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Fehler: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteAssignment(assignment.id),
    onSuccess: () => {
      toast.success('Einsatz gelöscht');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Fehler beim Löschen: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (endDate < startDate) {
      toast.error('Das Enddatum darf nicht vor dem Startdatum liegen.');
      return;
    }
    mutation.mutate({ userId, projectId, startDate, endDate, startTime, endTime, details });
  };

  return (
    <div className="relative z-50">
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="relative transform overflow-hidden rounded-xl bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold leading-6 text-gray-900">
                {assignment ? 'Einsatz bearbeiten' : 'Mitarbeiter zuweisen'}
              </h3>
              {assignment && (
                <button 
                  type="button" 
                  onClick={() => { if(confirm('Einsatz wirklich löschen?')) deleteMutation.mutate(); }}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Mitarbeiter</label>
                <select required value={userId} onChange={e => setUserId(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
                  <option value="">Bitte wählen...</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Auftrag</label>
                <select required value={projectId} onChange={e => setProjectId(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
                  <option value="">Bitte wählen...</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Von (Datum)</label>
                  <input type="date" required max={endDate} value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bis (Datum)</label>
                  <input type="date" required min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Von (Uhrzeit)</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bis (Uhrzeit)</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Details / Anweisung</label>
                <input type="text" value={details} onChange={e => setDetails(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" placeholder="z.B. Treffen am Lager" />
              </div>

              <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                <button type="submit" disabled={mutation.isPending} className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:col-start-2 disabled:opacity-50">
                  {mutation.isPending ? 'Speichert...' : assignment ? 'Speichern' : 'Zuweisen'}
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
