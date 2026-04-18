'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';

export function DashboardView() {
  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: api.getTimeEntries,
  });

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  });

  const isLoading = entriesLoading || projectsLoading;

  if (isLoading) {
    return <div className="text-slate-500">Lade Dashboard...</div>;
  }

  // Calculate some stats
  const today = new Date().toISOString().split('T')[0];
  const todaysEntries = entries?.filter(e => e.date === today) || [];
  const totalMinutesToday = todaysEntries.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  const hoursToday = (totalMinutesToday / 60).toFixed(1);

  // Check break logic
  const hasBreakMissing = totalMinutesToday > 360 && todaysEntries.length === 1; // Simplistic logic: >6h in one entry usually means no break logged.

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-2">
        {/* Stat Cards */}
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-[12px] text-slate-500 uppercase tracking-[0.05em] mb-2 leading-none">Heute (Ist)</div>
          <div className="text-[24px] font-bold text-slate-900 leading-none">{hoursToday} h</div>
          <div className="text-[12px] mt-1 text-red-500 font-medium">Soll: 08:00 h</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-[12px] text-slate-500 uppercase tracking-[0.05em] mb-2 leading-none">Überstunden</div>
          <div className="text-[24px] font-bold text-slate-900 leading-none">+12:40 h</div>
          <div className="text-[12px] mt-1 text-green-500 font-medium">Monatssaldo</div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-[12px] text-slate-500 uppercase tracking-[0.05em] mb-2 leading-none">Urlaubssaldo</div>
          <div className="text-[24px] font-bold text-slate-900 leading-none">14 Tage</div>
          <div className="text-[12px] mt-1 text-slate-800 font-medium">3 Anträge offen</div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-[12px] text-slate-500 uppercase tracking-[0.05em] mb-2 leading-none">Aktive Aufträge</div>
          <div className="text-[24px] font-bold text-slate-900 leading-none">{projects?.length || 0}</div>
          <div className="text-[12px] mt-1 text-slate-800 font-medium">3 Zuweisungen heute</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-[16px] font-semibold text-slate-900 leading-none">Heutige Buchungen</h2>
          <Link href="/time" className="px-4 py-2 rounded-lg font-semibold text-[14px] bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            + Zeit buchen
          </Link>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          {todaysEntries.length === 0 ? (
            <p className="p-5 text-sm text-slate-500 text-center">Noch keine Einträge heute.</p>
          ) : (
            todaysEntries.map(entry => {
              const project = projects?.find(p => p.id === entry.projectId);
              return (
                <div key={entry.id} className="px-5 py-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-[80px_1fr_120px_80px] gap-2 sm:gap-4 items-center text-[14px]">
                  <span className="font-semibold text-slate-500">{entry.startTime}</span>
                  <div>
                    <div className="font-semibold text-slate-900 mb-[2px]">{project?.name || 'Intern'}</div>
                    <div className="text-[12px] text-slate-500">{entry.description}</div>
                  </div>
                  <span className="hidden sm:inline-block px-2 py-1 rounded-md text-[11px] font-semibold uppercase bg-blue-50 text-blue-600 justify-self-start">
                    Auftrag
                  </span>
                  <span className="sm:text-right font-semibold text-slate-900">
                    {(entry.durationMinutes / 60).toFixed(1)} h
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-[16px] font-semibold text-slate-900 leading-none">Budget-Monitoring</h2>
        </div>
        <div className="flex-1">
          {projects?.slice(0,3).map(project => {
            const percentage = Math.min(100, Math.round((project.spentValue / project.budgetValue) * 100));
            const isWarning = percentage >= 80;
            return (
              <div key={project.id} className="px-5 py-4">
                <div className="flex justify-between mb-2 text-[13px] leading-none">
                  <span className={isWarning ? 'text-red-500 font-semibold' : 'text-slate-900 font-medium'}>
                    {project.name} {isWarning && '⚠️'}
                  </span>
                  <span className={isWarning ? 'text-red-500 font-semibold' : 'text-slate-900'}>{percentage}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${isWarning ? 'bg-red-500 animate-[pulse_2s_infinite]' : 'bg-green-500'}`} 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {project.spentValue} / {project.budgetValue} {project.budgetType === 'euro' ? '€' : 'h'} {isWarning && '(Limit kritisch)'}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-auto p-5 border-t border-slate-200">
          <div className="text-[14px] font-semibold text-slate-900 mb-3">Zuweisungen Morgen</div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-[13px]">
            <b>08:00:</b> Lager Logistikzentrum <br/>
            <span className="text-slate-500">Kabelzug & Trassenbau</span>
          </div>
        </div>
      </div>
    </div>
  );
}
