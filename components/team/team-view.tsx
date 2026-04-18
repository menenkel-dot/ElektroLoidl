'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { User, Mail, Plus, Shield, UserCircle, CheckCircle2, Clock, Calendar } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const MENU_ITEMS = [
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'clients', name: 'Kunden' },
  { id: 'projects', name: 'Aufträge & Budgets' },
  { id: 'schedule', name: 'Einsatzplan' },
  { id: 'time', name: 'Zeiterfassung' },
  { id: 'absence', name: 'Abwesenheiten' },
  { id: 'team', name: 'Team' },
  { id: 'reports', name: 'Berichte' },
];

export function TeamView() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });

  if (isLoading) return <div className="text-slate-500">Lade Team...</div>;

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">Team</h2>
          <p className="mt-2 text-[14px] text-slate-500">Mitarbeiter verwalten und Berechtigungen festlegen.</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-[14px] font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Mitarbeiter einladen
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users?.map(user => (
          <div key={user.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col group">
            <div className="p-6 flex-1">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-400">{user.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-slate-900">{user.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    {user.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-amber-50 text-amber-700">
                        <Shield className="w-3 h-3" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-50 text-slate-600">
                        <UserCircle className="w-3 h-3" /> Mitarbeiter
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-[12px] text-slate-600">
                   <Clock className="w-3.5 h-3.5 text-slate-400" />
                   <span>{user.targetHoursMonthly}h / Monat</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-slate-600">
                   <Calendar className="w-3.5 h-3.5 text-slate-400" />
                   <span>{user.vacationTotal} Tage Urlaub</span>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-50">
                 <div className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Sichtbare Menüpunkte</div>
                 <div className="flex flex-wrap gap-1.5">
                   {user.permissions?.visible_menu_items?.map((pId: string) => {
                     const item = MENU_ITEMS.find(m => m.id === pId);
                     return (
                       <span key={pId} className="px-2 py-1 bg-slate-50 rounded-md text-[11px] text-slate-600 font-medium">
                         {item?.name || pId}
                       </span>
                     );
                   })}
                 </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
               <button 
                onClick={() => {
                  setEditingUser(user);
                  setIsModalOpen(true);
                }}
                className="text-[13px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
               >
                 Bearbeiten
               </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <UserModal 
          user={editingUser}
          onClose={() => {
            setIsModalOpen(false);
            setEditingUser(null);
          }} 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsModalOpen(false);
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}

function UserModal({ user, onClose, onSuccess }: { user?: any, onClose: () => void, onSuccess: () => void }) {
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(''); // Nur bei Neuanlage nötig
  const [password, setPassword] = useState(''); // Nur bei Neuanlage nötig
  const [role, setRole] = useState(user?.role || 'employee');
  const [targetHours, setTargetHours] = useState(user?.targetHoursMonthly?.toString() || '160');
  const [vacationDays, setVacationDays] = useState(user?.vacationTotal?.toString() || '30');
  const [visibleItems, setVisibleItems] = useState<string[]>(user?.permissions?.visible_menu_items || ['dashboard', 'time', 'absence']);

  const createMutation = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      toast.success('Benutzer erfolgreich angelegt');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error('Fehler: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateUser(user.id, data),
    onSuccess: () => {
      toast.success('Benutzer erfolgreich aktualisiert');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error('Fehler: ' + error.message);
    }
  });

  const togglePermission = (id: string) => {
    setVisibleItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      firstName,
      lastName,
      role,
      targetHoursMonthly: Number(targetHours),
      vacationTotal: Number(vacationDays),
      permissions: { visible_menu_items: visibleItems }
    };

    if (user) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate({ ...data, email, password });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
            <div className="px-6 py-5 border-b border-slate-100">
               <h3 className="text-[18px] font-bold text-slate-900 leading-none">
                 {user ? 'Mitarbeiter bearbeiten' : 'Neuen Mitarbeiter anlegen'}
               </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Vorname</label>
                  <input required type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" placeholder="Max" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Nachname</label>
                  <input required type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" placeholder="Mustermann" />
                </div>
                
                {!user && (
                  <>
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">E-Mail Adresse</label>
                      <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" placeholder="max@beispiel.de" />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Passwort</label>
                      <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" placeholder="********" />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Soll-Stunden (Monat)</label>
                  <input required type="number" value={targetHours} onChange={e => setTargetHours(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Urlaubstage (Jahr)</label>
                  <input required type="number" value={vacationDays} onChange={e => setVacationDays(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Rolle</label>
                  <div className="flex gap-4">
                    <button type="button" onClick={() => { setRole('admin'); setVisibleItems(MENU_ITEMS.map(m => m.id)); }} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${role === 'admin' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500'}`}>
                      <Shield className="w-5 h-5" />
                      <span className="font-bold text-[14px]">Administrator</span>
                    </button>
                    <button type="button" onClick={() => setRole('employee')} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${role === 'employee' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500'}`}>
                      <UserCircle className="w-5 h-5" />
                      <span className="font-bold text-[14px]">Mitarbeiter</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-[13px] font-semibold text-slate-700 mb-3">Sidebar Berechtigungen</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {MENU_ITEMS.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => togglePermission(item.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium transition-colors ${visibleItems.includes(item.id) ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      {visibleItems.includes(item.id) && <CheckCircle2 className="w-4 h-4" />}
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button type="submit" disabled={isPending} className="flex-1 justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {isPending ? 'Speichert...' : user ? 'Änderungen speichern' : 'Mitarbeiter anlegen'}
                </button>
                <button type="button" onClick={onClose} className="flex-1 justify-center rounded-lg bg-white px-3 py-2.5 text-[14px] font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">
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