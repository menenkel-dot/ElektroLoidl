import { v4 as uuidv4 } from 'uuid';

export type Client = {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
};

export type ProjectNote = {
  id: string;
  text: string;
  createdAt: string;
};

export type ProjectImage = {
  id: string;
  url: string; // base64 or valid URL
};

export type Project = {
  id: string;
  clientId: string;
  name: string;
  budgetType: 'hours' | 'euro';
  budgetValue: number;
  spentValue: number;
  notes?: ProjectNote[];
  images?: ProjectImage[];
};

export type Service = {
  id: string;
  projectId: string;
  name: string;
  rate?: number; // Hourly rate if euro budget
};

export type User = {
  id: string;
  name: string;
  role: 'admin' | 'employee';
  targetHoursWeekly: number; // Soll-Arbeitszeiten
  avatarUrl: string;
};

export type TimeEntry = {
  id: string;
  userId: string;
  clientId: string;
  projectId: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  description: string;
};

export type JobAssignment = {
  id: string;
  userId: string;
  projectId: string;
  date: string;
  details: string;
}

export type AbsenceRequest = {
  id: string;
  userId: string;
  type: 'vacation' | 'sick' | 'comp_time';
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
}

const mockClients: Client[] = [];

const mockProjects: Project[] = [];

const mockServices: Service[] = [];

const mockUsers: User[] = [];

const mockTimeEntries: TimeEntry[] = [];

const mockAssignments: JobAssignment[] = [];

const mockAbsences: AbsenceRequest[] = [];

export const dbContext = {
  clients: mockClients,
  projects: mockProjects,
  services: mockServices,
  users: mockUsers,
  timeEntries: mockTimeEntries,
  assignments: mockAssignments,
  absences: mockAbsences,
};
