'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, addDays, startOfWeek, parseISO, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';

export function ScheduleView() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });
  const { data: assignments } = useQuery({ queryKey: ['assignments'], queryFn: api.getAssignments });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: api.getProjects });

  const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 5 }).map((_, i) => addDays(startOfCurrentWeek, i));

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">Einsatzplan</h2>
          <p className="mt-2 text-[14px] text-slate-500">Mitarbeiter Aufträgen zuweisen.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white rounded-md shadow-sm border border-gray-200">
            <button onClick={() => setCurrentDate(addDays(currentDate, -7))} className="p-2 text-gray-500 hover:text-gray-700">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="px-4 text-sm font-medium">
              KW {format(currentDate, 'I', { locale: de })}
            </span>
            <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-2 text-gray-500 hover:text-gray-700">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Zuweisen
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header Row */}
          <div className="grid grid-cols-6 border-b border-gray-200 bg-gray-50">
            <div className="p-4 border-r border-gray-200 font-semibold text-gray-900 text-sm">Mitarbeiter</div>
            {days.map(day => (
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
                {days.map(day => {
                  const dayAssignments = assignments?.filter(a => a.userId === user.id && isSameDay(parseISO(a.date), day)) || [];
                  return (
                    <div key={day.toISOString()} className="p-2 border-r border-gray-200 relative min-h-[80px]">
                      {dayAssignments.map(asg => {
                        const project = projects?.find(p => p.id === asg.projectId);
                        return (
                          <div key={asg.id} className="bg-blue-50 border border-blue-200 rounded p-1.5 mb-1 text-xs text-blue-800">
                            <span className="font-semibold block truncate">{project?.name}</span>
                            <span className="truncate block opacity-80">{asg.details}</span>
                          </div>
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

      {isModalOpen && (
        <AssignmentModal 
          onClose={() => setIsModalOpen(false)}
          users={users || []}
          projects={projects || []}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['assignments'] })}
        />
      )}
    </div>
  );
}

function AssignmentModal({ onClose, users, projects, onSuccess }: any) {
  const [userId, setUserId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [details, setDetails] = useState('');

  const mutation = useMutation({
    mutationFn: api.addAssignment,
    onSuccess: () => {
      onSuccess();
      onClose();
    }
  });

  return (
        <div className="relative z-50">
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="relative transform overflow-hidden rounded-xl bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">Mitarbeiter zuweisen</h3>
            <form onSubmit={e => { e.preventDefault(); mutation.mutate({ userId, projectId, date, details }); }} className="mt-6 space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Mitarbeiter</label>
                <select required value={userId} onChange={e => setUserId(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
                  <option value="">Bitte wählen...</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Auftrag</label>
                <select required value={projectId} onChange={e => setProjectId(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border bg-white">
                  <option value="">Bitte wählen...</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Datum</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Details / Anweisung</label>
                <input type="text" value={details} onChange={e => setDetails(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border" />
              </div>

              <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                <button type="submit" disabled={mutation.isPending} className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:col-start-2 disabled:opacity-50">
                  {mutation.isPending ? 'Speichert...' : 'Zuweisen'}
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
