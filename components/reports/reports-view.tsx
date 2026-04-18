'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, Filter } from 'lucide-react';
import { useState } from 'react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function ReportsView() {
  const { data: entries } = useQuery({ queryKey: ['timeEntries'], queryFn: api.getTimeEntries });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: api.getProjects });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });

  const [filterProject, setFilterProject] = useState('');

  const filteredEntries = entries?.filter(e => filterProject ? e.projectId === filterProject : true) || [];

  // Prepare data for BarChart (Hours per day)
  const hoursPerDay = filteredEntries.reduce((acc, entry) => {
    const day = entry.date;
    acc[day] = (acc[day] || 0) + (entry.durationMinutes / 60);
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.keys(hoursPerDay).map(day => ({
    name: day,
    Stunden: Number(hoursPerDay[day].toFixed(1))
  })).sort((a,b) => a.name.localeCompare(b.name));

  // Prepare data for PieChart (Hours per project)
  const hoursPerProject = filteredEntries.reduce((acc, entry) => {
    const p = projects?.find(p => p.id === entry.projectId)?.name || 'Unbekannt';
    acc[p] = (acc[p] || 0) + (entry.durationMinutes / 60);
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.keys(hoursPerProject).map(p => ({
    name: p,
    value: Number(hoursPerProject[p].toFixed(1))
  }));

  const handleExport = () => {
    // Mock export
    alert('Export gestartet: CSV wird generiert.');
  };

  return (
    <div className="space-y-6">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Berichte & Analyse</h2>
          <p className="mt-1 text-sm text-gray-500">Auswertungen zur Arbeitszeitverteilung.</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm border border-gray-300 hover:bg-gray-50"
        >
          <Download className="-ml-1 mr-2 h-4 w-4 text-gray-400" />
          Export CSV
        </button>
      </div>

      {/* Filters (Mock) */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
        <Filter className="h-5 w-5 text-gray-400" />
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
          <option value="">Alle Projekte</option>
          {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
          <option value="">Alle Mitarbeiter</option>
          {users?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border bg-white">
          <option value="">Dieser Monat</option>
          <option value="">Letzter Monat</option>
          <option value="">Dieses Jahr</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Arbeitszeit pro Tag (h)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
              <RechartsTooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
              <Bar dataKey="Stunden" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Verteilung nach Projekten</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
