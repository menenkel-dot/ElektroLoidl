import { eachDayOfInterval, endOfMonth, isWeekend, isWithinInterval, parseISO, startOfMonth } from 'date-fns';

type OvertimeUser = {
  id: string;
  targetHoursMonthly?: number | null;
  overtimeBase?: number | null;
};

type OvertimeEntry = {
  userId: string;
  date: string;
  durationMinutes: number;
};

type OvertimeAbsence = {
  userId: string;
  startDate: string;
  endDate: string;
  status: string;
};

export function calculateCurrentOvertime(
  user: OvertimeUser,
  entries: OvertimeEntry[],
  absences: OvertimeAbsence[],
  now = new Date(),
) {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthWorkDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).filter(day => !isWeekend(day));
  const dailyTargetHours = (user.targetHoursMonthly || 160) / monthWorkDays.length;
  const monthlyEntries = entries.filter(entry => {
    const entryDate = parseISO(entry.date);
    return entry.userId === user.id && isWithinInterval(entryDate, { start: monthStart, end: monthEnd });
  });
  const hoursWorkMonth = monthlyEntries.reduce((total, entry) => total + entry.durationMinutes, 0) / 60;

  let absenceHoursMonth = 0;
  absences.forEach(absence => {
    if (absence.userId !== user.id || absence.status !== 'approved') return;

    const absenceStart = parseISO(absence.startDate);
    const absenceEnd = parseISO(absence.endDate);
    if (absenceStart > monthEnd || absenceEnd < monthStart) return;

    const intervalStart = absenceStart < monthStart ? monthStart : absenceStart;
    const intervalEnd = absenceEnd > monthEnd ? monthEnd : absenceEnd;
    const workDays = eachDayOfInterval({ start: intervalStart, end: intervalEnd })
      .filter(day => !isWeekend(day) && day <= now).length;
    absenceHoursMonth += workDays * dailyTargetHours;
  });

  const elapsedTargetHours = monthWorkDays.filter(day => day <= now).length * dailyTargetHours;
  const hasMonthlyActivity = monthlyEntries.length > 0 || absenceHoursMonth > 0;
  const balance = (user.overtimeBase || 0)
    + (hasMonthlyActivity ? hoursWorkMonth + absenceHoursMonth - elapsedTargetHours : 0);

  return {
    balance,
    dailyTargetHours,
  };
}
