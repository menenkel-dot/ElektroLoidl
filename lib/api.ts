import { supabase } from '@/integrations/supabase/client';

export const api = {
  // Clients
  getClients: async () => {
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (error) throw error;
    return data;
  },

  addClient: async (client: any) => {
    const { data, error } = await supabase.from('clients').insert([client]).select().single();
    if (error) throw error;
    return data;
  },

  updateClient: async (id: string, updates: any) => {
    const { data, error } = await supabase.from('clients').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  deleteClient: async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // Projects
  getProjects: async () => {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  getProject: async (id: string) => {
    const { data: project, error: pError } = await supabase.from('projects').select('*').eq('id', id).single();
    if (pError) throw pError;

    const { data: notes, error: nError } = await supabase.from('project_notes').select('*').eq('project_id', id).order('created_at', { ascending: false });
    const { data: images, error: iError } = await supabase.from('project_images').select('*').eq('project_id', id);

    return { ...project, notes: notes || [], images: images || [] };
  },

  addProject: async (project: any) => {
    const { data, error } = await supabase.from('projects').insert([project]).select().single();
    if (error) throw error;
    return data;
  },

  updateProject: async (id: string, updates: any) => {
    const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  addProjectNote: async (projectId: string, text: string) => {
    const { data, error } = await supabase.from('project_notes').insert([{ project_id: projectId, text }]).select().single();
    if (error) throw error;
    return data;
  },

  addProjectImage: async (projectId: string, url: string) => {
    const { data, error } = await supabase.from('project_images').insert([{ project_id: projectId, url }]).select().single();
    if (error) throw error;
    return data;
  },

  // Services
  getServices: async () => {
    const { data, error } = await supabase.from('services').select('*');
    if (error) throw error;
    return data;
  },

  // Users / Profiles
  getUsers: async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    // Map to the expected format
    return data.map(p => ({
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Mitarbeiter',
      role: 'employee', // Default
      targetHoursWeekly: 40,
      avatarUrl: p.avatar_url
    }));
  },

  // Time Entries
  getTimeEntries: async () => {
    const { data, error } = await supabase.from('time_entries').select('*').order('date', { ascending: false }).order('start_time', { ascending: false });
    if (error) throw error;
    // Adapt back-end snake_case to front-end camelCase
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
    const dbEntry = {
      client_id: entry.clientId,
      project_id: entry.projectId,
      service_id: entry.serviceId,
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      duration_minutes: entry.durationMinutes,
      description: entry.description
    };
    const { data, error } = await supabase.from('time_entries').insert([dbEntry]).select().single();
    if (error) throw error;
    
    // Budget update is handled via RLS or DB functions usually, 
    // but we can simulate it here if needed or just let the database handle stats.
    return data;
  },

  // Absences
  getAbsences: async () => {
    const { data, error } = await supabase.from('absences').select('*').order('start_date', { ascending: false });
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
    const dbAbsence = {
      type: absence.type,
      start_date: absence.startDate,
      end_date: absence.endDate
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

  // Assignments
  getAssignments: async () => {
    const { data, error } = await supabase.from('assignments').select('*');
    if (error) throw error;
    return data.map(asg => ({
      id: asg.id,
      userId: asg.user_id,
      projectId: asg.project_id,
      date: asg.date,
      details: asg.details
    }));
  },

  addAssignment: async (assignment: any) => {
    const dbAsg = {
      user_id: assignment.userId,
      project_id: assignment.projectId,
      date: assignment.date,
      details: assignment.details
    };
    const { data, error } = await supabase.from('assignments').insert([dbAsg]).select().single();
    if (error) throw error;
    return data;
  }
};