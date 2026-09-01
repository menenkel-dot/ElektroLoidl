'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { exportProjectPdf } from '@/lib/project-pdf';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, FileText, ImageIcon, Users, Plus, Trash2, UserPlus, Package, Edit2, MapPin, Navigation, Download, Maximize2, X, UserRound, Phone, FileDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface ProjectNote {
  id: string;
  text: string;
  createdAt: string;
  authorName: string;
  userId: string | null;
}

interface ProjectImage {
  id: string;
  url: string;
  storagePath?: string | null;
}

interface ProjectMaterial {
  id: string;
  name: string;
  quantity: string;
  createdAt: string;
}

interface Project {
  id: string;
  clientId: string;
  name: string;
  notes: ProjectNote[];
  images: ProjectImage[];
}

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<ProjectMaterial | null>(null);
  const [selectedImage, setSelectedImage] = useState<ProjectImage | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  
  const { data: project, isLoading: projectLoading } = useQuery<Project>({ 
    queryKey: ['project', projectId], 
    queryFn: () => api.getProject(projectId) as Promise<Project>
  });
  
  const { data: clients, isLoading: clientsLoading } = useQuery({ queryKey: ['clients'], queryFn: api.getClients });
  const { data: members, isLoading: membersLoading } = useQuery({ 
    queryKey: ['projectMembers', projectId], 
    queryFn: () => api.getProjectMembers(projectId) 
  });
  const { data: materials, isLoading: materialsLoading } = useQuery<ProjectMaterial[]>({ 
    queryKey: ['projectMaterials', projectId], 
    queryFn: () => api.getProjectMaterials(projectId) as Promise<ProjectMaterial[]>
  });
  const { data: allUsers, isLoading: usersLoading } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({ queryKey: ['assignments'], queryFn: api.getAssignments });
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: api.getCurrentUser });

  const noteMutation = useMutation({
    mutationFn: (text: string) => api.addProjectNote(projectId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setNewNote('');
      toast.success('Notiz hinzugefügt');
    }
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api.updateProjectNote(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setEditingNoteId(null);
      setEditingNoteText('');
      toast.success('Notiz aktualisiert');
    },
    onError: (error: Error) => toast.error(`Notiz konnte nicht gespeichert werden: ${error.message}`),
  });

  const imageMutation = useMutation({
    mutationFn: (file: File) => api.addProjectImage(projectId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Bild hochgeladen');
    },
    onError: (error: Error) => toast.error(`Fehler beim Hochladen: ${error.message}`),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.removeProjectMember(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
      toast.success('Mitarbeiter entfernt');
    }
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (id: string) => api.deleteProjectMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMaterials', projectId] });
      toast.success('Material entfernt');
    }
  });

  if (projectLoading) return <div className="text-slate-500">Lade Auftrag...</div>;
  if (!project) return <div className="text-red-500">Auftrag nicht gefunden.</div>;

  const client = clients?.find(c => c.id === project.clientId);
  const isAdmin = currentUser?.role === 'admin';
  const clientAddress = client?.address?.trim();
  const contactPerson = client?.contactPerson?.trim();
  const clientPhone = client?.phone?.trim();
  const directionsUrl = clientAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clientAddress)}`
    : null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    imageMutation.mutate(file);
    e.target.value = '';
  };

  const handleImageDownload = async (image: ProjectImage, index: number) => {
    try {
      const response = await fetch(image.url);
      if (!response.ok) throw new Error('Das Bild konnte nicht geladen werden.');
      const blob = await response.blob();
      const extensionByType: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
      };
      const extension = extensionByType[blob.type] || 'jpg';
      const safeProjectName = project.name.replace(/[^a-z0-9äöüß_-]+/gi, '-').replace(/^-|-$/g, '') || 'auftrag';
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${safeProjectName}-bild-${index + 1}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Herunterladen.');
    }
  };

  const handleEditMaterial = (material: ProjectMaterial) => {
    setEditingMaterial(material);
    setIsMaterialModalOpen(true);
  };

  const handleProjectPdfExport = async () => {
    setIsExportingPdf(true);
    try {
      const result = await exportProjectPdf({
        project,
        client,
        members: members || [],
        materials: materials || [],
        assignments: (assignments || []).filter(assignment => assignment.projectId === projectId),
        userNames: new Map((allUsers || []).map(user => [user.id, user.name])),
        createdBy: currentUser?.name,
      });
      if (result.skippedImages) {
        toast(`PDF erstellt. ${result.skippedImages} Bild(er) konnten nicht eingebettet werden.`);
      } else {
        toast.success('Auftrags-PDF erstellt');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PDF konnte nicht erstellt werden.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/projects" className="inline-flex items-center text-[14px] text-slate-500 hover:text-slate-900 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Zurück zu Aufträgen
        </Link>
        <div className="border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-[13px] font-semibold text-blue-700 mb-2">
                {client?.name || 'Unbekannter Kunde'}
              </div>
              <h2 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none">{project.name}</h2>
              <div className="mt-3 flex items-start gap-2 text-[14px] text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>{clientAddress || 'Keine Adresse hinterlegt'}</span>
              </div>
              <div className="mt-2 flex items-start gap-2 text-[14px] text-slate-600">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>{contactPerson || 'Kein Ansprechpartner hinterlegt'}</span>
              </div>
              <div className="mt-2 flex items-start gap-2 text-[14px] text-slate-600">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                {clientPhone ? (
                  <a href={`tel:${clientPhone}`} className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
                    {clientPhone}
                  </a>
                ) : (
                  <span>Keine Telefonnummer hinterlegt</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleProjectPdfExport}
                disabled={isExportingPdf || clientsLoading || membersLoading || materialsLoading || usersLoading || assignmentsLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              >
                <FileDown className="h-4 w-4" />
                {isExportingPdf ? 'PDF wird erstellt...' : 'Auftrag als PDF'}
              </button>
              {directionsUrl ? (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  <Navigation className="h-4 w-4" />
                  Anfahrt
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Für diesen Kunden ist keine Adresse hinterlegt."
                  className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-500"
                >
                  <Navigation className="h-4 w-4" />
                  Anfahrt
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* Projekt-Team Sektion */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" />
                <h3 className="text-[16px] font-bold text-slate-900 leading-none">Projekt-Team</h3>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setIsMemberModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Mitarbeiter zuweisen
                </button>
              )}
            </div>
            <div className="p-6">
              {membersLoading ? (
                <div className="text-slate-400 text-sm">Lade Team...</div>
              ) : !members || members.length === 0 ? (
                <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-[13px] text-slate-500">Noch keine Mitarbeiter zugewiesen</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {members.map((member: any) => (
                    <div key={member.userId} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                          {member.user.name.charAt(0)}
                        </div>
                        <span className="text-[14px] font-medium text-slate-700">{member.user.name}</span>
                      </div>
                      {isAdmin && (
                        <button 
                          onClick={() => removeMemberMutation.mutate(member.userId)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Material Sektion */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-slate-400" />
                <h3 className="text-[16px] font-bold text-slate-900 leading-none">Materialliste</h3>
              </div>
              <button 
                onClick={() => { setEditingMaterial(null); setIsMaterialModalOpen(true); }}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Material hinzufügen
              </button>
            </div>
            <div className="p-6">
              {materialsLoading ? (
                <div className="text-slate-400 text-sm">Lade Material...</div>
              ) : !materials || materials.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-[13px] text-slate-500">Noch kein Material erfasst</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[14px]">
                    <thead>
                      <tr className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-100">
                        <th className="pb-3 pl-2">Bezeichnung</th>
                        <th className="pb-3">Anzahl</th>
                        <th className="pb-3 text-right pr-2">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {materials.map((item) => (
                        <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 pl-2 font-medium text-slate-700">{item.name}</td>
                          <td className="py-3 text-slate-600">{item.quantity}</td>
                          <td className="py-3 text-right pr-2">
                            <div className="responsive-card-actions flex items-center justify-end gap-1 transition-opacity">
                              <button 
                                onClick={() => handleEditMaterial(item)}
                                className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Bearbeiten"
                                aria-label={`${item.name} bearbeiten`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {isAdmin && (
                                <button 
                                  onClick={() => { if(confirm('Material wirklich löschen?')) deleteMaterialMutation.mutate(item.id); }}
                                  className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Löschen"
                                  aria-label={`${item.name} löschen`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              <h3 className="text-[16px] font-bold text-slate-900 leading-none">Auftrags-Dokumentation</h3>
            </div>
            <div className="p-6 bg-slate-50 border-b border-slate-100">
              <form onSubmit={e => { e.preventDefault(); if (newNote.trim()) noteMutation.mutate(newNote); }}>
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Notiz oder Fortschritt eintragen..."
                  className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] p-4 bg-white min-h-[100px] mb-3"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newNote.trim() || noteMutation.isPending}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-[14px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Notiz hinzufügen
                  </button>
                </div>
              </form>
            </div>
            <div className="divide-y divide-slate-100">
              {!project.notes || project.notes.length === 0 ? (
                 <div className="p-8 text-center text-[14px] text-slate-500">
                   Es gibt noch keine Notizen für diesen Auftrag.
                 </div>
              ) : (
                project.notes.map((note: ProjectNote) => (
                  <div key={note.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-slate-400">
                        <span>{format(parseISO(note.createdAt), "dd. MMMM yyyy HH:mm", { locale: de })} Uhr</span>
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <UserRound className="h-3.5 w-3.5" />
                          {note.authorName}
                        </span>
                      </div>
                      {note.userId === currentUser?.id && editingNoteId !== note.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditingNoteText(note.text);
                          }}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700"
                          aria-label="Eigene Notiz bearbeiten"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Bearbeiten
                        </button>
                      )}
                    </div>
                    {editingNoteId === note.id ? (
                      <form
                        className="space-y-3"
                        onSubmit={event => {
                          event.preventDefault();
                          if (editingNoteText.trim()) {
                            updateNoteMutation.mutate({ id: note.id, text: editingNoteText });
                          }
                        }}
                      >
                        <textarea
                          value={editingNoteText}
                          onChange={event => setEditingNoteText(event.target.value)}
                          className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-white p-3 text-[14px] text-slate-800 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          aria-label="Notiz bearbeiten"
                        />
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingNoteText('');
                            }}
                            disabled={updateNoteMutation.isPending}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                          >
                            Abbrechen
                          </button>
                          <button
                            type="submit"
                            disabled={!editingNoteText.trim() || updateNoteMutation.isPending}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                          >
                            {updateNoteMutation.isPending ? 'Speichert...' : 'Änderung speichern'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="text-[14px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {note.text}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-slate-400" />
                <h3 className="text-[16px] font-bold text-slate-900 leading-none">Bilder</h3>
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={imageMutation.isPending}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Bild hochladen"
                aria-label="Bild hochladen"
              >
                <Upload className="w-5 h-5" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            <div className="p-6">
              {!project.images || project.images.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-[13px] text-slate-500">Keine Bilder hochgeladen</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {project.images.map((img: ProjectImage, index: number) => (
                    <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => setSelectedImage(img)}
                        className="h-full w-full cursor-zoom-in"
                        aria-label={`Auftragsbild ${index + 1} vergrößern`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={`Auftragsbild ${index + 1}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-white transition-colors group-hover:bg-slate-950/25">
                          <Maximize2 className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImageDownload(img, index)}
                        className="absolute right-2 top-2 rounded-lg bg-white/95 p-2 text-slate-700 shadow-sm transition-colors hover:bg-blue-600 hover:text-white"
                        title="Bild herunterladen"
                        aria-label={`Auftragsbild ${index + 1} herunterladen`}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isMemberModalOpen && (
        <MemberModal 
          projectId={projectId}
          currentMembers={members || []}
          allUsers={allUsers || []}
          onClose={() => setIsMemberModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
            setIsMemberModalOpen(false);
          }}
        />
      )}

      {isMaterialModalOpen && (
        <MaterialModal 
          projectId={projectId}
          material={editingMaterial}
          onClose={() => { setIsMaterialModalOpen(false); setEditingMaterial(null); }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['projectMaterials', projectId] });
            setIsMaterialModalOpen(false);
            setEditingMaterial(null);
          }}
        />
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-label="Auftragsbild anzeigen">
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="absolute inset-0 cursor-zoom-out"
            aria-label="Bildansicht schließen"
          />
          <div className="relative z-10 flex max-h-full max-w-6xl flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedImage.url} alt="Auftragsbild in Großansicht" className="max-h-[82vh] max-w-full rounded-xl object-contain shadow-2xl" />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleImageDownload(selectedImage, Math.max(0, project.images.findIndex(image => image.id === selectedImage.id)))}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
              >
                <Download className="h-4 w-4" />
                Herunterladen
              </button>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberModal({ projectId, currentMembers, allUsers, onClose, onSuccess }: any) {
  const [selectedUserId, setSelectedUserId] = useState('');

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => api.addProjectMember(projectId, userId),
    onSuccess: () => {
      onSuccess();
      toast.success('Mitarbeiter zugewiesen');
    },
    onError: (error: any) => {
      toast.error('Fehler: ' + error.message);
    }
  });

  const availableUsers = allUsers.filter((u: any) => !currentMembers.some((m: any) => m.userId === u.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserId) {
      addMemberMutation.mutate(selectedUserId);
    }
  };

  return (
    <div className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md">
            <div className="px-6 py-5 border-b border-slate-100">
               <h3 className="text-[18px] font-bold text-slate-900 leading-none">Mitarbeiter zuweisen</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Mitarbeiter auswählen</label>
                <select 
                  required 
                  value={selectedUserId} 
                  onChange={e => setSelectedUserId(e.target.value)} 
                  className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border bg-white"
                >
                  <option value="">Bitte wählen...</option>
                  {availableUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                {availableUsers.length === 0 && (
                  <p className="mt-2 text-[12px] text-amber-600">Alle verfügbaren Mitarbeiter sind bereits zugewiesen.</p>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="submit" 
                  disabled={!selectedUserId || addMemberMutation.isPending} 
                  className="flex-1 justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {addMemberMutation.isPending ? 'Wird zugewiesen...' : 'Zuweisen'}
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

function MaterialModal({ projectId, material, onClose, onSuccess }: any) {
  const [name, setName] = useState(material?.name || '');
  const [quantity, setQuantity] = useState(material?.quantity || '');

  const mutation = useMutation({
    mutationFn: () => material 
      ? api.updateProjectMaterial(material.id, name, quantity)
      : api.addProjectMaterial(projectId, name, quantity),
    onSuccess: () => {
      onSuccess();
      toast.success(material ? 'Material aktualisiert' : 'Material hinzugefügt');
    },
    onError: (error: any) => {
      toast.error('Fehler: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && quantity) {
      mutation.mutate();
    }
  };

  return (
    <div className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md">
            <div className="px-6 py-5 border-b border-slate-100">
               <h3 className="text-[18px] font-bold text-slate-900 leading-none">
                 {material ? 'Material bearbeiten' : 'Material hinzufügen'}
               </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Bezeichnung</label>
                <input 
                  required 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" 
                  placeholder="z. B. NYM-J 3x1,5mm²" 
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Anzahl / Menge</label>
                <input 
                  required 
                  type="text" 
                  value={quantity} 
                  onChange={e => setQuantity(e.target.value)} 
                  className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-2.5 px-3 border" 
                  placeholder="z. B. 50m oder 5 Stück" 
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="submit" 
                  disabled={!name || !quantity || mutation.isPending} 
                  className="flex-1 justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {mutation.isPending ? 'Wird gespeichert...' : material ? 'Speichern' : 'Hinzufügen'}
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
