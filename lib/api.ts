import { supabase } from '@/integrations/supabase/client';

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
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(p => ({
      id: p.id,
      clientId: p.client_id,
      name: p.name,
      budgetType: p.budget_type,
      budgetValue: Number(p.budget_value),
      spentValue: Number(p.spent_value)
    }));
  },

  getProject: async (id: string) => {
    const { data: project, error: pError } = await supabase.from('projects').select('*').eq('id', id).single();
    if (pError) throw pError;
    const { data: notes } = await supabase.from('project_notes').select('*').eq('project_id', id).order('created_at', { ascending: false });
    const { data: images } = await supabase.from('project_images').select('*').eq('project_id', id);
    return { 
      ...project, 
      clientId: project.client_id,
      budgetType: project.budget_type,
      budgetValue: Number(project.budget_value),
      spentValue: Number(project.spent_value),
      notes: notes?.map(n => ({ id: n.id, text: n.text, createdAt: n.created_at })) || [], 
      images: images || [] 
    };
  },

  addProject: async (project: any) => {
    const dbProject = { client_id: project.clientId, name: project.name, budget_type: project.budget_type, budget_value: project.budgetValue };
    const { data, error } = await supabase.from('projects').insert([dbProject]).select().single();
    if (error) throw error;
    return data;
  },

  updateProject: async (id: string, updates: any) => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.clientId) dbUpdates.client_id = updates.clientId;
    if (updates.budgetType) dbUpdates.budget_type = updates.budgetType;
    if (updates.budgetValue) dbUpdates.budget_value = updates.budgetValue;
    const { data, error } = await supabase.from('projects').update(dbUpdates).eq('id', id).select().single();
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
    if (error) throw error;
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

  getTimeEntries: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    let query = supabase.from('time_entries').select('*');
    if (profile?.role !== 'admin') { query = query.eq('user_id', user.id); }
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
    const dbEntry = { 
      user_id: entry.userId,
      client_id: entry.clientId, 
      project_id: entry.projectId, 
      service_id: entry.serviceId || null, 
      date: entry.date, 
      start_time: entry.startTime, 
      end_time: entry.endTime, 
      duration_minutes: Math.round(entry.durationMinutes), 
      description: entry.description 
    };
    const { data, error } = await supabase.from('time_entries').insert([dbEntry]).select().single();
    if (error) throw error;
    return data;
  },

  getAbsences: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    
    let query = supabase.from('absences').select('*');
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

    const dbAbsence = { 
      user_id: user.id,
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

  getAssignments: async () => {
    const { data, error } = await supabase.from('assignments').select('*').order('date').order('start_time');
    if (error) throw error;
    return data.map(asg => ({
      id: asg.id,
      userId: asg.user_id,
      projectId: asg.project_id,
      date: asg.date,
      startTime: asg.start_time,
      endTime: asg.end_time,
      details: asg.details
    }));
  },

  addAssignment: async (assignment: any) => {
    const dbAsg = {
      user_id: assignment.userId,
      project_id: assignment.projectId,
      date: assignment.date,
      start_time: assignment.startTime,
      end_time: assignment.endTime,
      details: assignment.details
    };
    const { data, error } = await supabase.from('assignments').insert([dbAsg]).select().single();
    if (error) throw error;
    return data;
  },

  deleteAssignment: async (id: string) => {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};