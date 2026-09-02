import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

type TimeEntryFilters = {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  userId?: string;
};

type AbsenceFilters = {
  startDate?: string;
  endDate?: string;
};

const translateFunctionError = (message: string) => {
  const normalized = message.toLowerCase();

  if (normalized.includes('already') && (normalized.includes('registered') || normalized.includes('exists'))) {
    return 'Für diese E-Mail-Adresse besteht bereits ein Benutzerkonto.';
  }
  if (normalized.includes('password') && normalized.includes('8')) {
    return 'Das Passwort muss mindestens 8 Zeichen enthalten.';
  }
  if (normalized.includes('valid email')) {
    return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
  }
  if (normalized.includes('first and last name')) {
    return 'Vorname und Nachname sind erforderlich.';
  }
  if (normalized.includes('administrator access required')) {
    return 'Nur Administratoren dürfen neue Mitarbeiter anlegen.';
  }
  if (normalized.includes('authentication required') || normalized.includes('invalid or expired session')) {
    return 'Ihre Anmeldung ist abgelaufen. Bitte melden Sie sich erneut an.';
  }

  return message;
};

const getFunctionErrorMessage = async (error: unknown) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json() as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return translateFunctionError(payload.error.trim());
      }
    } catch {
      // Falls die Function keine JSON-Antwort liefert, verwenden wir die SDK-Meldung.
    }
  }

  return error instanceof Error ? error.message : 'Die Anfrage konnte nicht verarbeitet werden.';
};

export const api = {
  getClients: async () => {
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (error) throw error;
    return data.map(c => ({
      id: c.id,
      name: c.name,
      contactPerson: c.contact_person,
      phone: c.phone,
      address: c.address
    }));
  },

  addClient: async (client: any) => {
    const dbClient = {
      name: client.name,
      contact_person: client.contactPerson,
      phone: client.phone,
      address: client.address
    };
    const { data, error } = await supabase.from('clients').insert([dbClient]).select().single();
    if (error) throw error;
    return data;
  },

  updateClient: async (id: string, updates: any) => {
    const dbUpdates = {
      name: updates.name,
      contact_person: updates.contactPerson,
      phone: updates.phone,
      address: updates.address
    };
    const { data, error } = await supabase.from('clients').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  deleteClient: async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  getProjects: async () => {
    const { data, error } = await supabase.from('projects').select('id, client_id, name').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(p => ({
      id: p.id,
      clientId: p.client_id,
      name: p.name
    }));
  },

  getProject: async (id: string) => {
    const { data: project, error: pError } = await supabase.from('projects').select('id, client_id, name').eq('id', id).single();
    if (pError) throw pError;
    const { data: notes, error: notesError } = await supabase
      .from('project_notes')
      .select('id, text, created_at, user_id, author:profiles!project_notes_user_id_fkey(first_name, last_name)')
      .eq('project_id', id)
      .order('created_at', { ascending: false });
    if (notesError) throw notesError;
    const { data: images, error: imagesError } = await supabase.from('project_images').select('*').eq('project_id', id).order('created_at', { ascending: false });
    if (imagesError) throw imagesError;
    const resolvedImages = await Promise.all((images || []).map(async image => {
      const isDirectUrl = image.url.startsWith('data:') || image.url.startsWith('http://') || image.url.startsWith('https://');
      if (isDirectUrl) return { ...image, storagePath: null };

      const { data: signedUrl, error: signedUrlError } = await supabase.storage
        .from('project-images')
        .createSignedUrl(image.url, 60 * 60);
      if (signedUrlError) throw signedUrlError;
      return { ...image, url: signedUrl.signedUrl, storagePath: image.url };
    }));
    return { 
      ...project, 
      clientId: project.client_id,
      notes: notes?.map(n => {
        const author = Array.isArray(n.author) ? n.author[0] : n.author;
        const authorName = author
          ? `${author.first_name || ''} ${author.last_name || ''}`.trim() || 'Mitarbeiter'
          : 'Verfasser nicht verfügbar';
        return { id: n.id, text: n.text, createdAt: n.created_at, userId: n.user_id, authorName };
      }) || [],
      images: resolvedImages,
    };
  },

  addProject: async (project: any) => {
    const dbProject = { client_id: project.clientId, name: project.name };
    const { data, error } = await supabase.from('projects').insert([dbProject]).select().single();
    if (error) throw error;
    return data;
  },

  updateProject: async (id: string, updates: any) => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.clientId) dbUpdates.client_id = updates.clientId;
    const { data, error } = await supabase.from('projects').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  deleteProject: async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  addProjectNote: async (projectId: string, text: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nicht authentifiziert');
    const { data, error } = await supabase
      .from('project_notes')
      .insert([{ project_id: projectId, text, user_id: user.id }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateProjectNote: async (id: string, text: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nicht authentifiziert');
    const trimmedText = text.trim();
    if (!trimmedText) throw new Error('Die Notiz darf nicht leer sein.');

    const { data, error } = await supabase
      .from('project_notes')
      .update({ text: trimmedText })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, text')
      .single();
    if (error) throw error;
    return data;
  },

  addProjectImage: async (projectId: string, file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Bitte wählen Sie ein Bild im Format JPG, PNG, WebP oder GIF aus.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Das Bild darf maximal 10 MB groß sein.');
    }

    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const storagePath = `${projectId}/${crypto.randomUUID()}.${extensionByType[file.type]}`;
    const { error: uploadError } = await supabase.storage
      .from('project-images')
      .upload(storagePath, file, { cacheControl: '3600', contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('project_images')
      .insert([{ project_id: projectId, url: storagePath }])
      .select()
      .single();
    if (error) {
      await supabase.storage.from('project-images').remove([storagePath]);
      throw error;
    }
    return data;
  },

  getProjectMembers: async (projectId: string) => {
    const { data, error } = await supabase.from('project_members').select('*, profiles(*)').eq('project_id', projectId);
    if (error) throw error;
    return data.map(m => ({
      id: m.id,
      projectId: m.project_id,
      userId: m.user_id,
      user: {
        id: m.profiles.id,
        name: `${m.profiles.first_name || ''} ${m.profiles.last_name || ''}`.trim() || 'Mitarbeiter',
        avatarUrl: m.profiles.avatar_url
      }
    }));
  },

  getAllProjectMembers: async () => {
    const { data, error } = await supabase.from('project_members').select('*, profiles(*)');
    if (error) throw error;
    return data.map(m => ({
      id: m.id,
      projectId: m.project_id,
      userId: m.user_id,
      user: {
        id: m.profiles.id,
        name: `${m.profiles.first_name || ''} ${m.profiles.last_name || ''}`.trim() || 'Mitarbeiter',
        avatarUrl: m.profiles.avatar_url
      }
    }));
  },

  addProjectMember: async (projectId: string, userId: string) => {
    const { data, error } = await supabase.from('project_members').insert([{ project_id: projectId, user_id: userId }]).select().single();
    if (error) throw error;
    return data;
  },

  removeProjectMember: async (projectId: string, userId: string) => {
    const { error } = await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
    if (error) throw error;
    return true;
  },

  getProjectMaterials: async (projectId: string) => {
    const { data, error } = await supabase.from('project_materials').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  addProjectMaterial: async (projectId: string, name: string, quantity: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('project_materials').insert([{ project_id: projectId, user_id: user?.id, name, quantity }]).select().single();
    if (error) throw error;
    return data;
  },

  updateProjectMaterial: async (id: string, name: string, quantity: string) => {
    const { data, error } = await supabase.from('project_materials').update({ name, quantity }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  deleteProjectMaterial: async (id: string) => {
    const { error } = await supabase.from('project_materials').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  getServices: async () => {
    const { data, error } = await supabase.from('services').select('*');
    if (error) throw error;
    return data;
  },

  getUsers: async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return data.map(p => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Mitarbeiter',
      role: p.role,
      permissions: p.permissions,
      targetHoursMonthly: p.target_hours_monthly || 160,
      vacationTotal: p.vacation_total || 30,
      vacationUsed: p.vacation_used || 0,
      overtimeBase: p.overtime_base || 0,
      avatarUrl: p.avatar_url
    }));
  },

  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    return {
      ...data,
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Mitarbeiter',
      targetHoursMonthly: data.target_hours_monthly || 160,
      vacationTotal: data.vacation_total || 30,
      vacationUsed: data.vacation_used || 0,
      overtimeBase: data.overtime_base || 0
    };
  },

  createUser: async (userData: any) => {
    const { data, error } = await supabase.functions.invoke('create-user', { body: userData });
    if (error) throw new Error(await getFunctionErrorMessage(error));
    return data;
  },

  updateUser: async (id: string, updates: any) => {
    const { data, error } = await supabase.from('profiles').update({
      first_name: updates.firstName,
      last_name: updates.lastName,
      role: updates.role,
      target_hours_monthly: updates.targetHoursMonthly,
      vacation_total: updates.vacationTotal,
      permissions: updates.permissions,
      updated_at: new Date().toISOString()
    }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  deleteUser: async (id: string) => {
    const { data, error } = await supabase.functions.invoke('delete-user', { 
      body: { userId: id } 
    });
    if (error) throw error;
    return data;
  },

  resetUserPassword: async (userId: string, password: string) => {
    const { data, error } = await supabase.functions.invoke('reset-user-password', {
      body: { userId, password },
    });
    if (error) throw error;
    return data;
  },

  getTimeEntries: async (filters: TimeEntryFilters = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase.from('time_entries').select('*');
    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);
    if (filters.projectId) query = query.eq('project_id', filters.projectId);
    if (filters.userId) query = query.eq('user_id', filters.userId);

    const { data, error } = await query.order('date', { ascending: false }).order('start_time', { ascending: false });
    if (error) throw error;
    return data.map(e => ({
      id: e.id,
      userId: e.user_id,
      clientId: e.client_id,
      projectId: e.project_id,
      serviceId: e.service_id,
      date: e.date,
      startTime: e.start_time,
      endTime: e.end_time,
      durationMinutes: e.duration_minutes,
      description: e.description
    }));
  },

  addTimeEntry: async (entry: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nicht authentifiziert');

    const { data: ownProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;

    // Mitarbeiter buchen immer auf ihre eigene Auth-ID. RLS bleibt die zweite Schutzschicht.
    const targetUserId = ownProfile.role === 'admin' ? entry.userId : user.id;
    if (!targetUserId) throw new Error('Bitte wählen Sie einen Mitarbeiter aus.');

    const { data: overlappingEntry, error: overlapError } = await supabase
      .from('time_entries')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('date', entry.date)
      .lt('start_time', entry.endTime)
      .gt('end_time', entry.startTime)
      .limit(1)
      .maybeSingle();
    if (overlapError) throw overlapError;
    if (overlappingEntry) {
      throw new Error('Für diesen Mitarbeiter besteht im gewählten Zeitraum bereits ein Zeiteintrag.');
    }

    const dbEntry = { 
      user_id: targetUserId,
      client_id: entry.clientId, 
      project_id: entry.projectId, 
      service_id: entry.serviceId || null, 
      date: entry.date, 
      start_time: entry.startTime, 
      end_time: entry.endTime, 
      duration_minutes: Math.round(entry.durationMinutes), 
      description: entry.description,
      material_recorded_confirmed: entry.materialRecordedConfirmed === true,
    };
    const { data, error } = await supabase.from('time_entries').insert([dbEntry]).select().single();
    if (error?.code === '23P01') {
      throw new Error('Für diesen Mitarbeiter besteht im gewählten Zeitraum bereits ein Zeiteintrag.');
    }
    if (error) throw error;
    return data;
  },

  updateTimeEntry: async (id: string, entry: any) => {
    const dbEntry = {
      user_id: entry.userId,
      client_id: entry.clientId,
      project_id: entry.projectId,
      service_id: entry.serviceId || null,
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      duration_minutes: Math.round(entry.durationMinutes),
      description: entry.description,
    };
    const { data, error } = await supabase.from('time_entries').update(dbEntry).eq('id', id).select().single();
    if (error?.code === '23P01') {
      throw new Error('Für diesen Mitarbeiter besteht im gewählten Zeitraum bereits ein Zeiteintrag.');
    }
    if (error) throw error;
    return data;
  },

  deleteTimeEntry: async (id: string) => {
    const { error } = await supabase.from('time_entries').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  getAbsences: async (filters: AbsenceFilters = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    
    let query = supabase.from('absences').select('*');
    if (filters.startDate) query = query.gte('end_date', filters.startDate);
    if (filters.endDate) query = query.lte('start_date', filters.endDate);
    if (profile?.role !== 'admin') {
      query = query.eq('user_id', user.id);
    }
    
    const { data, error } = await query.order('start_date', { ascending: false });
    if (error) throw error;
    return data.map(a => ({ 
      id: a.id, 
      userId: a.user_id, 
      type: a.type, 
      startDate: a.start_date, 
      endDate: a.end_date, 
      status: a.status 
    }));
  },
  
  addAbsence: async (absence: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Nicht authentifiziert");

    const { data: ownProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;

    const targetUserId = ownProfile.role === 'admin' ? absence.userId : user.id;
    if (!targetUserId) throw new Error('Bitte wählen Sie einen Mitarbeiter aus.');

    const dbAbsence = { 
      user_id: targetUserId,
      type: absence.type, 
      start_date: absence.startDate, 
      end_date: absence.endDate,
      status: 'pending'
    };
    const { data, error } = await supabase.from('absences').insert([dbAbsence]).select().single();
    if (error) throw error;
    return data;
  },

  updateAbsenceStatus: async (id: string, status: string) => {
    const { data, error } = await supabase.from('absences').update({ status }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  updateAbsence: async (id: string, absence: any) => {
    const { data, error } = await supabase.from('absences').update({
      type: absence.type,
      start_date: absence.startDate,
      end_date: absence.endDate,
    }).eq('id', id).eq('status', 'pending').select().single();
    if (error) throw error;
    return data;
  },

  deleteAbsence: async (id: string) => {
    const { error } = await supabase.from('absences').delete().eq('id', id).select('id').single();
    if (error) throw error;
    return true;
  },

  getAssignments: async () => {
    const { data, error } = await supabase.from('assignments').select('*').order('date').order('start_time');
    if (error) throw error;
    return data.map(asg => ({
      id: asg.id,
      userId: asg.user_id,
      projectId: asg.project_id,
      startDate: asg.date,
      endDate: asg.end_date,
      startTime: asg.start_time,
      endTime: asg.end_time,
      details: asg.details
    }));
  },

  addAssignment: async (assignment: any) => {
    const dbAsg = {
      user_id: assignment.userId,
      project_id: assignment.projectId,
      date: assignment.startDate,
      end_date: assignment.endDate,
      start_time: assignment.startTime,
      end_time: assignment.endTime,
      details: assignment.details
    };
    const { data, error } = await supabase.from('assignments').insert([dbAsg]).select().single();
    if (error) throw error;
    return data;
  },

  updateAssignment: async (id: string, updates: any) => {
    const dbUpdates = {
      user_id: updates.userId,
      project_id: updates.projectId,
      date: updates.startDate,
      end_date: updates.endDate,
      start_time: updates.startTime,
      end_time: updates.endTime,
      details: updates.details
    };
    const { data, error } = await supabase.from('assignments').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  deleteAssignment: async (id: string) => {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};
