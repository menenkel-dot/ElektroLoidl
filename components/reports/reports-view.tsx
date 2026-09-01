'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Briefcase, CalendarDays, Clock, Download, Filter, TrendingUp, Users } from 'lucide-react';
import { endOfMonth, endOfYear, format, parseISO, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

type PeriodPreset = 'current_month' | 'previous_month' | 'current_year' | 'all' | 'custom';

function getPeriodDates(period: PeriodPreset) {
  const now = new Date();
  if (period === 'current_month') return { startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') };
  if (period === 'previous_month') {
    const previousMonth = subMonths(now, 1);
    return { startDate: format(startOfMonth(previousMonth), 'yyyy-MM-dd'), endDate: format(endOfMonth(previousMonth), 'yyyy-MM-dd') };
  }
  if (period === 'current_year') return { startDate: format(startOfYear(now), 'yyyy-MM-dd'), endDate: format(endOfYear(now), 'yyyy-MM-dd') };
  return { startDate: '', endDate: '' };
}

function csvValue(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function ReportsView() {
  const initialPeriod = getPeriodDates('current_month');
  const [period, setPeriod] = useState<PeriodPreset>('current_month');
  const [startDate, setStartDate] = useState(initialPeriod.startDate);
  const [endDate, setEndDate] = useState(initialPeriod.endDate);
  const [filterProject, setFilterProject] = useState('');
  const [filterUser, setFilterUser] = useState('');

  const { data: currentUser, isLoading: profileLoading } = useQuery({ queryKey: ['currentUser'], queryFn: api.getCurrentUser });
  const isAdmin = currentUser?.role === 'admin';

  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['reportEntries', startDate, endDate, filterProject, isAdmin ? filterUser : 'own'],
    queryFn: () => api.getTimeEntries({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      projectId: filterProject || undefined,
      userId: isAdmin && filterUser ? filterUser : undefined,
    }),
  });
  const { data: projects, isLoading: projectsLoading } = useQuery({ queryKey: ['projects'], queryFn: api.getProjects });
  const { data: users, isLoading: usersLoading } = useQuery({ queryKey: ['users'], queryFn: api.getUsers, enabled: isAdmin });

  const projectMap = useMemo(() => new Map((projects || []).map(project => [project.id, project.name])), [projects]);
  const userMap = useMemo(() => {
    const map = new Map((users || []).map(user => [user.id, user.name]));
    if (currentUser) map.set(currentUser.id, currentUser.name);
    return map;
  }, [currentUser, users]);

  const report = useMemo(() => {
    const filteredEntries = entries || [];
    const hoursPerDay = new Map<string, number>();
    const hoursPerProject = new Map<string, number>();
    const hoursPerUser = new Map<string, number>();
    let totalHours = 0;

    for (const entry of filteredEntries) {
      const hours = entry.durationMinutes / 60;
      totalHours += hours;
      hoursPerDay.set(entry.date, (hoursPerDay.get(entry.date) || 0) + hours);
      hoursPerProject.set(entry.projectId, (hoursPerProject.get(entry.projectId) || 0) + hours);
      hoursPerUser.set(entry.userId, (hoursPerUser.get(entry.userId) || 0) + hours);
    }

    const barData = Array.from(hoursPerDay, ([date, hours]) => ({ date, name: format(parseISO(date), 'dd.MM.', { locale: de }), Stunden: Number(hours.toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const projectData = Array.from(hoursPerProject, ([projectId, hours]) => ({ id: projectId, name: projectMap.get(projectId) || 'Unbekannter Auftrag', value: Number(hours.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
    const employeeData = Array.from(hoursPerUser, ([userId, hours]) => ({ id: userId, name: userMap.get(userId) || 'Unbekannter Mitarbeiter', value: Number(hours.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    return { entries: filteredEntries, barData, projectData, employeeData, totalHours, workDays: hoursPerDay.size, activeProjects: hoursPerProject.size };
  }, [entries, projectMap, userMap]);

  const isLoading = profileLoading || entriesLoading || projectsLoading || (isAdmin && usersLoading);
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);

  const changePeriod = (nextPeriod: PeriodPreset) => {
    setPeriod(nextPeriod);
    if (nextPeriod === 'custom') return;
    const dates = getPeriodDates(nextPeriod);
    setStartDate(dates.startDate);
    setEndDate(dates.endDate);
  };

  const exportCsv = () => {
    if (report.entries.length === 0) return;
    const header = ['Datum', 'Mitarbeiter', 'Auftrag', 'Von', 'Bis', 'Stunden', 'Beschreibung'];
    const rows = report.entries.map(entry => [
      entry.date,
      userMap.get(entry.userId) || currentUser?.name || 'Mitarbeiter',
      projectMap.get(entry.projectId) || 'Unbekannter Auftrag',
      entry.startTime?.substring(0, 5) || '',
      entry.endTime?.substring(0, 5) || '',
      (entry.durationMinutes / 60).toFixed(2).replace('.', ','),
      entry.description || '',
    ]);
    const csv = [header, ...rows].map(row => row.map(csvValue).join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `arbeitszeiten-${startDate || 'beginn'}-${endDate || 'heute'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="text-slate-500 animate-pulse font-medium">Lade Berichtsdaten...</div>;

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">Berichte</h2>
          <p className="mt-2 text-[14px] text-slate-500">
            {isAdmin ? 'Arbeitszeiten projekt- und mitarbeiterübergreifend auswerten.' : 'Auswertung Ihrer persönlich erfassten Arbeitszeiten.'}
          </p>
        </div>
        <button type="button" onClick={exportCsv} disabled={report.entries.length === 0 || invalidRange} className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-[14px] font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
          <Download className="-ml-1 mr-2 h-4 w-4 text-slate-400" /> CSV exportieren
        </button>
      </div>

      <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4" aria-labelledby="report-filter-heading">
        <div className="flex items-center gap-2 text-slate-700">
          <Filter className="h-4 w-4 text-slate-400" />
          <h3 id="report-filter-heading" className="text-[14px] font-bold">Filter und Zeitspanne</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <label className="text-[12px] font-semibold text-slate-600">Zeitraum
            <select value={period} onChange={event => changePeriod(event.target.value as PeriodPreset)} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px]">
              <option value="current_month">Aktueller Monat</option><option value="previous_month">Vorheriger Monat</option><option value="current_year">Aktuelles Jahr</option><option value="all">Gesamter Zeitraum</option><option value="custom">Benutzerdefiniert</option>
            </select>
          </label>
          <label className="text-[12px] font-semibold text-slate-600">Von
            <input type="date" value={startDate} max={endDate || undefined} onChange={event => { setStartDate(event.target.value); setPeriod('custom'); }} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]" />
          </label>
          <label className="text-[12px] font-semibold text-slate-600">Bis
            <input type="date" value={endDate} min={startDate || undefined} onChange={event => { setEndDate(event.target.value); setPeriod('custom'); }} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]" />
          </label>
          <label className="text-[12px] font-semibold text-slate-600">Auftrag
            <select value={filterProject} onChange={event => setFilterProject(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px]">
              <option value="">Alle Aufträge</option>{projects?.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          {isAdmin ? (
            <label className="text-[12px] font-semibold text-slate-600">Mitarbeiter
              <select value={filterUser} onChange={event => setFilterUser(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px]">
                <option value="">Alle Mitarbeiter</option>{users?.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
          ) : (
            <div className="flex items-end"><div className="w-full rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[13px] font-medium text-blue-700">Nur meine Arbeitszeiten</div></div>
          )}
        </div>
        {invalidRange && <p className="text-[13px] font-medium text-red-600">Das Enddatum darf nicht vor dem Startdatum liegen.</p>}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <SummaryCard icon={Clock} label="Gesamtstunden" value={`${report.totalHours.toFixed(1)} h`} color="blue" />
        <SummaryCard icon={CalendarDays} label="Arbeitstage" value={String(report.workDays)} color="emerald" />
        <SummaryCard icon={Briefcase} label="Aufträge" value={String(report.activeProjects)} color="purple" />
        <SummaryCard icon={TrendingUp} label="Durchschnitt / Tag" value={`${report.workDays ? (report.totalHours / report.workDays).toFixed(1) : '0.0'} h`} color="amber" />
      </div>

      {report.entries.length === 0 || invalidRange ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="text-[16px] font-bold text-slate-900 mb-2">Keine Arbeitszeiten gefunden</h3><p className="text-[14px] text-slate-500">Passen Sie Zeitraum oder Filter an.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Arbeitszeitverlauf">
              <BarChart data={report.barData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CBD5E1" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} /><RechartsTooltip formatter={(value) => [`${Number(value).toFixed(1)} h`, 'Stunden']} /><Bar dataKey="Stunden" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ChartCard>
            <ChartCard title="Verteilung nach Aufträgen">
              <PieChart><Pie data={report.projectData} cx="50%" cy="45%" innerRadius={65} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">{report.projectData.map((project, index) => <Cell key={project.id} fill={COLORS[index % COLORS.length]} />)}</Pie><RechartsTooltip formatter={(value) => [`${Number(value).toFixed(1)} h`, 'Stunden']} /><Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} /></PieChart>
            </ChartCard>
          </div>

          {isAdmin && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><RankingCard title="Auswertung nach Mitarbeiter" icon={Users} data={report.employeeData} totalHours={report.totalHours} /><RankingCard title="Auswertung nach Auftrag" icon={Briefcase} data={report.projectData} totalHours={report.totalHours} /></div>}

          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200"><h3 className="text-[16px] font-bold text-slate-900">Buchungsdetails</h3><p className="mt-1 text-[12px] text-slate-500">{isAdmin ? 'Gefilterte Buchungen aller berechtigten Mitarbeiter.' : 'Ausschließlich Ihre eigenen Buchungen.'}</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Datum</th>{isAdmin && <th className="px-5 py-3">Mitarbeiter</th>}<th className="px-5 py-3">Auftrag</th><th className="px-5 py-3">Zeit</th><th className="px-5 py-3 text-right">Stunden</th><th className="px-5 py-3">Beschreibung</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{report.entries.map(entry => <tr key={entry.id} className="hover:bg-slate-50/50"><td className="px-5 py-3 font-medium text-slate-700">{format(parseISO(entry.date), 'dd.MM.yyyy')}</td>{isAdmin && <td className="px-5 py-3 text-slate-600">{userMap.get(entry.userId) || 'Unbekannt'}</td>}<td className="px-5 py-3 text-slate-700">{projectMap.get(entry.projectId) || 'Unbekannt'}</td><td className="px-5 py-3 text-slate-500">{entry.startTime?.substring(0, 5)}–{entry.endTime?.substring(0, 5)}</td><td className="px-5 py-3 text-right font-semibold text-slate-900">{(entry.durationMinutes / 60).toFixed(2)} h</td><td className="px-5 py-3 text-slate-500">{entry.description || '–'}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: string; color: 'blue' | 'emerald' | 'purple' | 'amber' }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', purple: 'bg-purple-50 text-purple-600', amber: 'bg-amber-50 text-amber-600' };
  return <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center gap-3 mb-3"><div className={`p-2 rounded-lg ${colors[color]}`}><Icon className="w-5 h-5" /></div><span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span></div><div className="text-[28px] font-bold text-slate-900 leading-none">{value}</div></div>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[400px]"><h3 className="text-[16px] font-bold text-slate-900 mb-6">{title}</h3><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></section>;
}

function RankingCard({ title, icon: Icon, data, totalHours }: { title: string; icon: typeof Clock; data: Array<{ id: string; name: string; value: number }>; totalHours: number }) {
  return <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2"><Icon className="w-4 h-4 text-slate-400" /><h3 className="text-[15px] font-bold text-slate-900">{title}</h3></div><div className="divide-y divide-slate-100">{data.map(item => { const percentage = totalHours ? (item.value / totalHours) * 100 : 0; return <div key={item.id} className="px-5 py-4"><div className="flex justify-between gap-3 text-[13px] mb-2"><span className="font-medium text-slate-700 truncate">{item.name}</span><span className="font-bold text-slate-900 whitespace-nowrap">{item.value.toFixed(1)} h</span></div><div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-blue-600" style={{ width: `${percentage}%` }} /></div></div>; })}</div></section>;
}
