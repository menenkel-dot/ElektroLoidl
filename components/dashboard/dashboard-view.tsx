'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, eachDayOfInterval, isWeekend } from 'date-fns';

export function DashboardView() {
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: api.getCurrentUser,
  });

  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: () => api.getTimeEntries(),
  });

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  });

  const { data: absences } = useQuery({
    queryKey: ['absences'],
    queryFn: api.getAbsences,
  });

  const isLoading = profileLoading || entriesLoading || projectsLoading;

  if (isLoading) {
    return <div className="text-slate-500">Lade Dashboard...</div>;
  }

  // Aktueller Monat Zeitspanne
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Heute Stats
  const todayStr = format(now, 'yyyy-MM-dd');
  const todaysEntries = entries?.filter(e => e.date === todayStr && e.userId === userProfile?.id) || [];
  const totalMinutesToday = todaysEntries.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  const hoursToday = (totalMinutesToday / 60).toFixed(1);

  // Monat Ist-Stunden (Arbeitszeit)
  const monthlyEntries = entries?.filter(e => {
    const entryDate = parseISO(e.date);
    return e.userId === userProfile?.id && isWithinInterval(entryDate, { start: monthStart, end: monthEnd });
  }) || [];
  const hoursWorkMonth = monthlyEntries.reduce((acc, curr) => acc + curr.durationMinutes, 0) / 60;

  // Monat Abwesenheits-Stunden (Genehmigter Urlaub/Krankheit)
  // Wir nehmen an: 160h Monat = 20 Arbeitstage à 8h
  const dailyTargetHours = (userProfile?.targetHoursMonthly || 160) / 20;
  
  const monthlyAbsences = absences?.filter(a => {
    if (a.userId !== userProfile?.id || a.status !== 'approved') return false;
    const start = parseISO(a.startDate);
    const end = parseISO(a.endDate);
    // Prüfen ob die Abwesenheit den aktuellen Monat überschneidet
    return (start <= monthEnd && end >= monthStart);
  }) || [];

  let absenceHoursMonth = 0;
  monthlyAbsences.forEach(absence => {
    const start = parseISO(absence.startDate);
    const end = parseISO(absence.endDate);
    
    // Nur Tage im aktuellen Monat zählen
    const intervalStart = start < monthStart ? monthStart : start;
    const intervalEnd = end > monthEnd ? monthEnd : end;
    
    const days = eachDayOfInterval({ start: intervalStart, end: intervalEnd });
    const workDays = days.filter(day => !isWeekend(day)).length;
    
    absenceHoursMonth += workDays * dailyTargetHours;
  });

  // Saldo-Berechnung
  const totalEffectiveHours = hoursWorkMonth + absenceHoursMonth;
  const overtime = (totalEffectiveHours - (userProfile?.targetHoursMonthly || 0)).toFixed(1);
  const overtimePrefix = Number(overtime) >= 0 ? '+' : '';

  // Urlaubssaldo
  const openAbsences = absences?.filter(a => a.userId === userProfile?.id && a.status === 'pending').length || 0;
  const remainingVacation = (userProfile?.vacationTotal || 0) - (userProfile?.vacationUsed || 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Stat Cards */}
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-[12px] text-slate-500 uppercase tracking-[0.05em] mb-2 leading-none">Heute (Ist)</div>
          <div className="text-[24px] font-bold text-slate-900 leading-none">{hoursToday} h</div>
          <div className="text-[12px] mt-1 text-slate-400 font-medium">Soll: {dailyTargetHours.toFixed(1)} h</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-[12px] text-slate-500 uppercase tracking-[0.05em] mb-2 leading-none">Überstunden</div>
          <div className={`text-[24px] font-bold leading-none ${Number(overtime) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {overtimePrefix}{overtime} h
          </div>
          <div className="text-[12px] mt-1 text-slate-400 font-medium">Inkl. genehmigter Abwesenheit</div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-[12px] text-slate-500 uppercase tracking-[0.05em] mb-2 leading-none">Urlaubssaldo</div>
          <div className="text-[24px] font-bold text-slate-900 leading-none">{remainingVacation} Tage</div>
          <div className="text-[12px] mt-1 text-slate-800 font-medium">{openAbsences} Anträge offen</div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-[12px] text-slate-500 uppercase tracking-[0.05em] mb-2 leading-none">Aktive Aufträge</div>
          <div className="text-[24px] font-bold text-slate-900 leading-none">{projects?.length || 0}</div>
          <div className="text-[12px] mt-1 text-slate-800 font-medium">Laufende Projekte</div>
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
    </div>
  );
}
