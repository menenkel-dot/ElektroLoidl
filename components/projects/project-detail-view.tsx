'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, FileText, ImageIcon, Clock, Euro } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import de from 'date-fns/locale/de';

// Typdefinitionen für die Komponente
interface ProjectNote {
  id: string;
  text: string;
  createdAt: string;
}

interface ProjectImage {
  id: string;
  url: string;
}

interface Project {
  id: string;
  clientId: string;
  name: string;
  budgetType: 'hours' | 'euro';
  budgetValue: number;
  spentValue: number;
  notes: ProjectNote[];
  images: ProjectImage[];
}

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newNote, setNewNote] = useState('');
  
  const { data: project, isLoading: projectLoading } = useQuery<Project>({ 
    queryKey: ['project', projectId], 
    queryFn: () => api.getProject(projectId) as Promise<Project>
  });
  
  const { data: clients } = useQuery({ 
    queryKey: ['clients'], 
    queryFn: api.getClients 
  });

  const noteMutation = useMutation({
    mutationFn: (text: string) => api.addProjectNote(projectId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setNewNote('');
    }
  });

  const imageMutation = useMutation({
    mutationFn: (url: string) => api.addProjectImage(projectId, url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    }
  });

  if (projectLoading) return <div className="text-slate-500">Lade Auftrag...</div>;
  if (!project) return <div className="text-red-500">Auftrag nicht gefunden.</div>;

  const client = clients?.find(c => c.id === project.clientId);
  const percentage = Math.min(100, Math.round((project.spentValue / project.budgetValue) * 100));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        imageMutation.mutate(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/projects" className="inline-flex items-center text-[14px] text-slate-500 hover:text-slate-900 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Zurück zu Aufträgen
        </Link>
        <div className="flex sm:items-end justify-between flex-col sm:flex-row gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-[13px] font-semibold text-blue-700 mb-2">
              {client?.name || 'Unbekannter Kunde'}
            </div>
            <h2 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none">{project.name}</h2>
          </div>
          <div className={`p-3 rounded-xl flex items-center gap-3 ${project.budgetType === 'euro' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'}`}>
            <div className="p-2 bg-white/60 rounded-lg">
              {project.budgetType === 'euro' ? <Euro className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider font-semibold opacity-80">Ressourcen</div>
              <div className="font-bold text-[16px]">
                {project.spentValue} / {project.budgetValue} {project.budgetType === 'euro' ? '€' : 'h'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Notes */}
        <div className="lg:col-span-2 space-y-6">
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
                    <div className="text-[12px] font-semibold text-slate-400 mb-2">
                      {format(parseISO(note.createdAt), "dd. MMMM yyyy HH:mm", { locale: de })} Uhr
                    </div>
                    <div className="text-[14px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {note.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Images & Meta */}
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
                  {project.images.map((img: ProjectImage) => (
                    <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="Auftragsbild" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Budget Widget summary */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden p-6">
             <h3 className="text-[14px] font-bold text-slate-900 leading-none mb-4">Budget-Status</h3>
             <div className="flex justify-between text-[13px] mb-2 font-medium">
               <span className="text-slate-600">Bereits verbraucht</span>
               <span className="text-slate-900">{percentage}%</span>
             </div>
             <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${percentage > 90 ? 'bg-red-500' : percentage > 75 ? 'bg-amber-500' : 'bg-blue-600'}`} 
                  style={{ width: `${percentage}%` }}
                />
             </div>
             <p className="text-[12px] text-slate-500">
                {project.budgetValue - project.spentValue} {project.budgetType === 'euro' ? '€' : 'h'} verbleibend
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}