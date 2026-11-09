'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DOCUMENT_ACCEPT, downloadProjectDocument, listProjectDocuments,
  removeProjectDocuments, uploadProjectDocument,
} from '@/lib/project-documents';

type FileError = { name: string; message: string };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Bitte erneut versuchen.';
}

export function ProjectDocumentsCard({ projectId, isArchived, isAdmin }: {
  projectId: string; isArchived: boolean; isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<FileError[]>([]);
  const queryKey = ['projectDocuments', projectId];
  const documents = useQuery({ queryKey, queryFn: () => listProjectDocuments(projectId) });
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const failed: FileError[] = [];
      for (const file of files) {
        try {
          await uploadProjectDocument(projectId, file);
        } catch (error) {
          failed.push({ name: file.name, message: errorMessage(error) });
        }
      }
      return { failed, count: files.length - failed.length };
    },
    onSuccess: async ({ failed, count }) => {
      setErrors(failed);
      if (count) toast.success(count === 1 ? 'Dokument hochgeladen' : `${count} Dokumente hochgeladen`);
      await queryClient.invalidateQueries({ queryKey });
    },
    onSettled: () => {
      if (inputRef.current) inputRef.current.value = '';
    },
  });
  const remove = useMutation({
    mutationFn: (key: string) => removeProjectDocuments(projectId, [key]),
    onSuccess: () => toast.success('Dokument gelöscht'),
    onError: error => toast.error(errorMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const onSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    if (!files.length) return;
    setErrors([]);
    upload.mutate(files);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="Dokumente">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
        <h3 className="flex items-center gap-2 font-bold text-slate-900"><FileText className="h-5 w-5 text-slate-400" />Dokumente</h3>
        {!isArchived && (
          <>
            <input ref={inputRef} type="file" multiple accept={DOCUMENT_ACCEPT} onChange={onSelect} className="hidden" />
            <button type="button" disabled={upload.isPending} onClick={() => inputRef.current?.click()}
              className="rounded-lg p-2 text-slate-600 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
              title="Dokumente hochladen" aria-label="Dokumente hochladen"><Upload className="h-5 w-5" /></button>
          </>
        )}
      </div>
      <div className="space-y-3 p-6 text-sm text-slate-600">
        {!isArchived && <p>PDF, Word, Excel, PowerPoint oder Text · max. 10 MB pro Datei</p>}
        {upload.isPending && <p role="status">Dokumente werden hochgeladen …</p>}
        {errors.length > 0 && (
          <ul role="alert" className="space-y-1 text-red-600">
            {errors.map(({ name, message }, index) => <li key={index} className="break-words">{name} – {message}</li>)}
          </ul>
        )}
        {documents.isPending ? <p>Dokumente werden geladen …</p> : documents.isError ? (
          <p role="alert">Dokumente konnten nicht geladen werden.{' '}
            <button type="button" onClick={() => documents.refetch()} className="underline">Erneut versuchen</button>
          </p>
        ) : documents.data.length === 0 ? <p>Keine Dokumente hochgeladen.</p> : (
          <ul className="divide-y divide-slate-100">
            {documents.data.map(file => (
              <li key={file.key} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 break-words font-medium text-slate-800">{file.name}</span>
                <button type="button" title="Herunterladen" aria-label={`${file.name} herunterladen`}
                  className="shrink-0 rounded-lg p-2 hover:bg-blue-50 hover:text-blue-600"
                  onClick={() => downloadProjectDocument(projectId, file.key, file.name).catch(error => toast.error(errorMessage(error)))}>
                  <Download className="h-4 w-4" />
                </button>
                {isAdmin && !isArchived && (
                  <button type="button" title="Löschen" aria-label={`${file.name} löschen`} disabled={remove.isPending}
                    className="shrink-0 rounded-lg p-2 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    onClick={() => {
                      if (window.confirm(`„${file.name}“ dauerhaft löschen?`)) remove.mutate(file.key);
                    }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
