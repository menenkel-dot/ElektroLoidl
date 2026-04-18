import { dbContext, TimeEntry, AbsenceRequest, JobAssignment, Client, Project } from './mock-data';
import { v4 as uuidv4 } from 'uuid';

// Simulated delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  // Clients
  getClients: async () => {
    await delay(300);
    return dbContext.clients;
  },

  addClient: async (client: Omit<Client, 'id'>) => {
    await delay(300);
    const newClient = { ...client, id: uuidv4() };
    dbContext.clients.push(newClient);
    return newClient;
  },

  updateClient: async (id: string, updates: Partial<Client>) => {
    await delay(300);
    const index = dbContext.clients.findIndex(c => c.id === id);
    if (index !== -1) {
      dbContext.clients[index] = { ...dbContext.clients[index], ...updates };
      return dbContext.clients[index];
    }
    throw new Error('Client not found');
  },

  deleteClient: async (id: string) => {
    await delay(300);
    dbContext.clients = dbContext.clients.filter(c => c.id !== id);
    return true;
  },

  // Projects
  getProjects: async () => {
    await delay(300);
    return dbContext.projects;
  },

  getProject: async (id: string) => {
    await delay(200);
    const p = dbContext.projects.find(p => p.id === id);
    if (!p) throw new Error('Not found');
    return p;
  },

  addProject: async (project: Omit<Project, 'id' | 'spentValue'>) => {
    await delay(300);
    const newProject = { ...project, id: uuidv4(), spentValue: 0, notes: [], images: [] };
    dbContext.projects.push(newProject);
    return newProject;
  },

  updateProject: async (id: string, updates: Partial<Project>) => {
    await delay(300);
    const index = dbContext.projects.findIndex(p => p.id === id);
    if (index !== -1) {
      dbContext.projects[index] = { ...dbContext.projects[index], ...updates };
      return dbContext.projects[index];
    }
    throw new Error('Project not found');
  },

  addProjectNote: async (projectId: string, text: string) => {
    await delay(300);
    const p = dbContext.projects.find(p => p.id === projectId);
    if (p) {
      if (!p.notes) p.notes = [];
      const newNote = { id: uuidv4(), text, createdAt: new Date().toISOString() };
      p.notes.unshift(newNote);
      return newNote;
    }
    throw new Error('Project not found');
  },

  addProjectImage: async (projectId: string, url: string) => {
    await delay(400); // simulate upload delay
    const p = dbContext.projects.find(p => p.id === projectId);
    if (p) {
      if (!p.images) p.images = [];
      const newImg = { id: uuidv4(), url };
      p.images.push(newImg);
      return newImg;
    }
    throw new Error('Project not found');
  },

  // Services
  getServices: async () => {
    await delay(300);
    return dbContext.services;
  },

  // Users
  getUsers: async () => {
    await delay(300);
    return dbContext.users;
  },

  // Time Entries
  getTimeEntries: async () => {
    await delay(300);
    return [...dbContext.timeEntries];
  },

  addTimeEntry: async (entry: Omit<TimeEntry, 'id'>) => {
    await delay(400);
    const newEntry = { ...entry, id: uuidv4() };
    dbContext.timeEntries.unshift(newEntry);
    
    // Update project budget logic (simplified)
    const project = dbContext.projects.find(p => p.id === entry.projectId);
    if (project) {
      if (project.budgetType === 'hours') {
        project.spentValue += entry.durationMinutes / 60;
      } else {
        const service = dbContext.services.find(s => s.id === entry.serviceId);
        if (service && service.rate) {
          project.spentValue += (entry.durationMinutes / 60) * service.rate;
        }
      }
    }
    return newEntry;
  },

  updateTimeEntry: async (id: string, updates: Partial<TimeEntry>) => {
    await delay(300);
    const index = dbContext.timeEntries.findIndex(t => t.id === id);
    if (index !== -1) {
      dbContext.timeEntries[index] = { ...dbContext.timeEntries[index], ...updates };
      return dbContext.timeEntries[index];
    }
    throw new Error('Not found');
  },

  deleteTimeEntry: async (id: string) => {
    await delay(300);
    dbContext.timeEntries = dbContext.timeEntries.filter(t => t.id !== id);
    return true;
  },

  // Absences
  getAbsences: async () => {
    await delay(300);
    return [...dbContext.absences];
  },
  
  addAbsence: async (absence: Omit<AbsenceRequest, 'id' | 'status'>) => {
    await delay(300);
    const newAbs = { ...absence, id: uuidv4(), status: 'pending' as const };
    dbContext.absences.push(newAbs);
    return newAbs;
  },

  updateAbsenceStatus: async (id: string, status: AbsenceRequest['status']) => {
    await delay(300);
    const index = dbContext.absences.findIndex(a => a.id === id);
    if (index !== -1) {
      dbContext.absences[index].status = status;
      return dbContext.absences[index];
    }
    throw new Error('Not found');
  },

  // Assignments
  getAssignments: async () => {
    await delay(300);
    return [...dbContext.assignments];
  },

  addAssignment: async (assignment: Omit<JobAssignment, 'id'>) => {
    await delay(300);
    const newAsg = { ...assignment, id: uuidv4() };
    dbContext.assignments.push(newAsg);
    return newAsg;
  }
};
