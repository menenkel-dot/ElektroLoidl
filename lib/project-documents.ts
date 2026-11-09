import { supabase } from '@/integrations/supabase/client';

const MIME_TYPES = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export const DOCUMENT_ACCEPT = Object.keys(MIME_TYPES).map(extension => `.${extension}`).join(',');
const PAGE_SIZE = 100;
const bucket = () => supabase.storage.from('project-documents');

function originalName(key: string) {
  try {
    const encoded = key.slice(37).replaceAll('-', '+').replaceAll('_', '/');
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(encoded), char => char.charCodeAt(0))) || key;
  } catch {
    return key;
  }
}

export async function listProjectDocuments(projectId: string) {
  const documents: { key: string; name: string }[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await bucket().list(projectId, {
      limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    documents.push(...data.filter(item => item.id).map(item => ({ key: item.name, name: originalName(item.name) })));
    if (data.length < PAGE_SIZE) return documents;
  }
}

export async function uploadProjectDocument(projectId: string, file: File) {
  const extension = file.name.split('.').at(-1)?.toLowerCase() ?? '';
  if (!file.name.includes('.') || !Object.hasOwn(MIME_TYPES, extension)) {
    throw new Error('Bitte eine PDF-, Word-, Excel-, PowerPoint- oder Textdatei auswählen.');
  }
  if (file.size > 10 * 1024 * 1024) throw new Error('Die Datei darf höchstens 10 MB groß sein.');
  const nameBytes = new TextEncoder().encode(file.name);
  if (nameBytes.length > 600) throw new Error('Bitte den Dateinamen kürzen.');
  const encoded = btoa(String.fromCharCode(...nameBytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const body = await file.arrayBuffer();
  if (!body.byteLength) throw new Error('Die Datei ist leer.');
  const { error } = await bucket().upload(`${projectId}/${crypto.randomUUID()}_${encoded}`, body, {
    contentType: MIME_TYPES[extension as keyof typeof MIME_TYPES],
    upsert: false,
  });
  if (error) throw error;
}

export async function downloadProjectDocument(projectId: string, key: string, name: string) {
  const { data, error } = await bucket().download(`${projectId}/${key}`);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function removeProjectDocuments(projectId: string, keys: string[]) {
  if (!keys.length) return;
  const { error } = await bucket().remove(keys.map(key => `${projectId}/${key}`));
  if (error) throw error;
  const remaining = new Set((await listProjectDocuments(projectId)).map(file => file.key));
  if (keys.some(key => remaining.has(key))) throw new Error('Dokumente konnten nicht vollständig gelöscht werden.');
}

export async function removeAllProjectDocuments(projectId: string) {
  for (;;) {
    const { data, error } = await bucket().list(projectId, { limit: PAGE_SIZE });
    if (error) throw error;
    const keys = data.filter(item => item.id).map(item => item.name);
    if (!keys.length) return;
    await removeProjectDocuments(projectId, keys);
  }
}
