'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, Filter, TrendingUp, Clock, Briefcase } from 'lucide-react';
import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function ReportsView() {
  const [filterProject, setFilterProject] = useState('');
  const [filterUser, setFilterUser] = useState('');

  const { data: entries, isLoading: entriesLoading } = useQuery({ queryKey: ['timeEntries'], queryFn: api.getTimeEntries });
  const { data: projects, isLoading: projectsLoading } = useQuery({ queryKey: ['projects'], queryFn: api.getProjects });
  const { data: users, isLoading: usersLoading } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });

  const isLoading = entriesLoading || projectsLoading || usersLoading;

  // Datenverarbeitung mit useMemo für Performance und Stabilität
  const { barData, pieData, totalHours, activeProjectsCount } = useMemo(() => {
    if (!entries || !projects) return { barData: [], pieData: [], totalHours: 0, activeProjectsCount: 0 };

    const filtered = entries.filter(e => {
      const matchProject = filterProject ? e.projectId === filterProject : true;
      const matchUser = filterUser ? e.userId === filterUser : true;
      return matchProject && matchUser;
    });

    // BarChart: Stunden pro Tag
    const hoursPerDay = filtered.reduce((acc, entry) => {
      const day = entry.date;
      acc[day] = (acc[day] || 0) + (entry.durationMinutes / 60);
      return acc;
    }, {} as Record<string, number>);

    const sortedBarData = Object.keys(hoursPerDay)
      .sort()
      .map(day => ({
        fullDate: day,
        name: format(parseISO(day), 'dd.MM.', { locale: de }),
        Stunden: Number(hoursPerDay[day].toFixed(1))
      }));

    // PieChart: Stunden pro Projekt
    const hoursPerProject = filtered.reduce((acc, entry) => {
      const projectName = projects.find(p => p.id === entry.projectId)?.name || 'Unbekannt';
      acc[projectName] = (acc[projectName] || 0) + (entry.durationMinutes / 60);
      return acc;
    }, {} as Record<string, number>);

    const sortedPieData = Object.keys(hoursPerProject).map(p => ({
      name: p,
      value: Number(hoursPerProject[p].toFixed(1))
    })).sort((a, b) => b.value - a.value);

    const total = filtered.reduce((acc, e) => acc + (e.durationMinutes / 60), 0);
    const uniqueProjects = new Set(filtered.map(e => e.projectId)).size;

    return { 
      barData: sortedBarData, 
      pieData: sortedPieData, 
      totalHours: total,
      activeProjectsCount: uniqueProjects
    };
  }, [entries, projects, filterProject, filterUser]);

  const handleExport = () => {
    alert('Export gestartet: CSV wird generiert.');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500 animate-pulse font-medium">Lade Analysedaten...</div>
      </div>
    );
  }

  const hasData = barData.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">Berichte & Analyse</h2>
          <p className="mt-2 text-[14px] text-slate-500">Auswertungen zur Arbeitszeitverteilung und Projektauslastung.</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-[14px] font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <Download className="-ml-1 mr-2 h-4 w-4 text-slate-400" />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Clock className="w-5 h-5" />
             </div>
             <span className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider">Gesamtstunden</span>
          </div>
          <div className="text-[28px] font-bold text-slate-900 leading-none">{totalHours.toFixed(1)} h</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <Briefcase className="w-5 h-5" />
             </div>
             <span className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider">Projekte</span>
          </div>
          <div className="text-[28px] font-bold text-slate-900 leading-none">{activeProjectsCount}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <TrendingUp className="w-5 h-5" />
             </div>
             <span className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider">Durchschnitt / Tag</span>
          </div>
          <div className="text-[28px] font-bold text-slate-900 leading-none">
            {barData.length > 0 ? (totalHours / barData.length).toFixed(1) : '0.0'} h
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400">
           <Filter className="h-4 w-4" />
           <span className="text-[13px] font-semibold">Filter:</span>
        </div>
        <select 
          value={filterProject} 
          onChange={e => setFilterProject(e.target.value)} 
          className="rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-1.5 px-3 border bg-white min-w-[160px]"
        >
          <option value="">Alle Projekte</option>
          {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select 
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
          className="rounded-lg border-slate-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[14px] py-1.5 px-3 border bg-white min-w-[160px]"
        >
          <option value="">Alle Mitarbeiter</option>
          {users?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {!hasData ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
           <div className="max-w-xs mx-auto">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <TrendingUp className="w-8 h-8" />
             </div>
             <h3 className="text-[16px] font-bold text-slate-900 mb-2">Keine Daten gefunden</h3>
             <p className="text-[14px] text-slate-500">Für den gewählten Zeitraum oder Filter liegen keine Zeiteinträge vor.</p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[400px]">
            <h3 className="text-[16px] font-bold text-slate-900 mb-6">Arbeitszeitverlauf (h)</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94A3B8', fontSize: 11, fontWeight: 500}} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94A3B8', fontSize: 11, fontWeight: 500}}
                  />
                  <RechartsTooltip 
                    cursor={{fill: '#F8FAFC'}} 
                    contentStyle={{borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px -2px rgb(0 0 0 / 0.05)', fontSize: '13px'}} 
                  />
                  <Bar dataKey="Stunden" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[400px]">
            <h3 className="text-[16px] font-bold text-slate-900 mb-6">Verteilung nach Projekten</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px -2px rgb(0 0 0 / 0.05)', fontSize: '13px'}} 
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    wrapperStyle={{fontSize: '12px', fontWeight: 500, color: '#64748B', paddingTop: '20px'}}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}