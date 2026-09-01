'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { Project } from '@/lib/mock-data';
import toast from 'react-hot-toast';

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase();
}

export function ProjectsView() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: api.getProjects });
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: api.getClients });
  const { data: allMembers } = useQuery({ queryKey: ['allProjectMembers'], queryFn: api.getAllProjectMembers });
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: api.getCurrentUser });
  const isAdmin = currentUser?.role === 'admin';

  const deleteMutation = useMutation({
    mutationFn: api.deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['allProjectMembers'] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['reportEntries'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Auftrag erfolgreich gelöscht');
    },
    onError: (error: Error) => toast.error(`Fehler beim Löschen: ${error.message}`),
  });

  const handleDelete = (project: Project) => {
    const confirmed = confirm(
      `Auftrag "${project.name}" wirklich unwiderruflich löschen? Zugehörige Einsätze, Arbeitszeiten, Materialien und Notizen werden ebenfalls gelöscht.`,
    );
    if (confirmed) deleteMutation.mutate(project.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">Aufträge</h2>
          <p className="mt-2 text-[14px] text-slate-500">Kundenaufträge und zugewiesene Mitarbeiter verwalten.</p>
        </div>
        <button
          onClick={() => {
            setEditingProject(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-[14px] font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Neuer Auftrag
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects?.map(project => {
          const client = clients?.find(c => c.id === project.clientId);
          const projectMembers = allMembers?.filter(m => m.projectId === project.id) || [];
          return (
            <div key={project.id} className="relative group">
              <Link href={`/projects/${project.id}`} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:border-blue-200 hover:shadow-md transition-all cursor-pointer h-full">
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 mb-2">
                        {client?.name}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{project.name}</h3>
                    </div>
                  </div>

                  {/* Team Avatars */}
                  <div className="mt-4 flex min-h-8 items-center gap-3">
                    <div className="isolate flex shrink-0 items-center -space-x-2" aria-label="Zugewiesene Mitarbeiter">
                      {projectMembers.slice(0, 5).map((member) => (
                        <div 
                          key={member.id} 
                          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold leading-none text-slate-600 shadow-sm dark:border-slate-900 dark:bg-slate-700 dark:text-slate-200"
                          title={member.user.name}
                        >
                          {getInitials(member.user.name)}
                        </div>
                      ))}
                      {projectMembers.length > 5 && (
                        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-50 text-[10px] font-bold leading-none text-slate-500 shadow-sm dark:border-slate-900 dark:bg-slate-800 dark:text-slate-300" title={`${projectMembers.length - 5} weitere Mitarbeiter`}>
                          +{projectMembers.length - 5}
                        </div>
                      )}
                    </div>
                    {projectMembers.length === 0 ? (
                      <span className="text-[12px] text-slate-400 italic">Kein Team zugewiesen</span>
                    ) : (
                      <span className="text-[12px] font-medium leading-4 text-slate-500">
                        {projectMembers.length} Mitarbeiter
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              {isAdmin && (
                <div className="responsive-card-actions absolute top-4 right-4 z-10 flex items-center gap-1 rounded-lg border border-slate-100 bg-white p-0.5 shadow-sm transition-opacity dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProject(project);
                      setIsModalOpen(true);
                    }}
                    className="rounded-md p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    title="Bearbeiten"
                    aria-label={`${project.name} bearbeiten`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(project)}
                    disabled={deleteMutation.isPending}
                    className="rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Löschen"
                    aria-label={`${project.name} löschen`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <ProjectModal 
          project={editingProject}
          onClose={() => {
            setIsModalOpen(false);
            setEditingProject(null);
          }} 
          clients={clients || []}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
        />
      )}
    </div>
  );
}

function ProjectModal({ project, onClose, clients, onSuccess }: { project: Project | null, onClose: () => void, clients: any[], onSuccess: () => void }) {
  const [name, setName] = useState(project?.name || '');
  const [clientId, setClientId] = useState(project?.clientId || '');

  const createMutation = useMutation({
    mutationFn: api.addProject,
    onSuccess: () => {
      onSuccess();
      onClose();
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Project>) => api.updateProject(project!.id, data),
    onSuccess: () => {
      onSuccess();
      onClose();
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name, clientId };
    if (project) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
            <div className="px-6 py-5 border-b border-slate-100">
               <h3 className="text-[18px] font-bold text-slate-900 leading-none">{project ? 'Auftrag bearbeiten' : 'Auftrag anlegen'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Kunde</label>
                <select required value={clientId} onChange={e => setClientId(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border bg-white">
                  <option value="">Bitte wählen...</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Auftragsname</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" placeholder="z. B. Netzwerkplanung 2026" />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="submit" disabled={isPending} className="flex-1 justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {isPending ? 'Speichert...' : project ? 'Änderungen speichern' : 'Auftrag anlegen'}
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
