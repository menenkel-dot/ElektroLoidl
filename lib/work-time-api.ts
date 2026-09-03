import { supabase } from '@/integrations/supabase/client';

export type HolidayProfile = 'BY' | 'BY_MARIA' | 'BY_AUGSBURG';
export type WorkModel = {
  user_id: string;
  effective_from: string;
  daily_minutes: number[] | null;
  monthly_hours: number | null;
  holiday_profile: HolidayProfile | null;
};
export type WorkBalance = {
  user_id: string;
  balance_hours: number;
  today_target_hours: number;
  month_target_hours: number;
  accounting_since: string;
};
export type WorkModelPreview = {
  token: string;
  effective_from: string;
  before: WorkBalance;
  after: WorkBalance;
  vacation_refund_days: number;
  absence_changes: {
    id: string; type: string; start_date: string; end_date: string;
    old_hours: number; new_hours: number; old_days: number; new_days: number;
  }[];
};
export type RecentProjectNote = {
  id: string; project_id: string; project_name: string; text: string; created_at: string; author_name: string;
};
export type NoteCursor = { before_time: string; before_id: string } | undefined;
export type ProjectTimeSummary = {
  total_minutes: number;
  count: number;
  members: { user_id: string; name: string; minutes: number }[];
  entries: {
    id: string; date: string; start_time: string; end_time: string;
    duration_minutes: number; description: string | null; name: string;
  }[];
};

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const workTimeApi = {
  getBalances: () => rpc<WorkBalance[]>('get_work_balances'),
  getModels: async (): Promise<WorkModel[]> => {
    const { data, error } = await supabase.from('work_time_models').select('*').order('effective_from', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },
  preview: (userId: string, minutes: number[], region: HolidayProfile) => rpc<WorkModelPreview>('preview_work_model', {
    target_user: userId, daily_minutes: minutes, holiday_profile: region,
  }),
  save: (userId: string, minutes: number[], region: HolidayProfile, token: string) => rpc<WorkModelPreview>('save_work_model', {
    target_user: userId, daily_minutes: minutes, holiday_profile: region, preview_token: token,
  }),
  getRecentNotes: (cursor: NoteCursor) => rpc<RecentProjectNote[]>('get_recent_project_notes', cursor),
  getProjectTimes: (projectId: string, page: number) => rpc<ProjectTimeSummary>('get_project_time_summary', {
    target_project: projectId, page_number: page,
  }),
};

export const formatHours = (value: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value);
