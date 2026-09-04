const fixedHolidays = new Map([
  ['01-01', 'Neujahr'],
  ['01-06', 'Heilige Drei Könige'],
  ['05-01', 'Tag der Arbeit'],
  ['10-03', 'Tag der Deutschen Einheit'],
  ['11-01', 'Allerheiligen'],
  ['12-25', '1. Weihnachtstag'],
  ['12-26', '2. Weihnachtstag'],
]);

/** @param {Date} date */
function dateKey(date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** @param {Date} date @param {number} days */
function addCalendarDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** @param {number} year */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12);
}

/** @param {Date} date @returns {string | null} */
export function getBavarianHoliday(date) {
  const fixedHoliday = fixedHolidays.get(dateKey(date));
  if (fixedHoliday) return fixedHoliday;

  const easter = easterSunday(date.getFullYear());
  const movableHolidays = new Map([
    [dateKey(addCalendarDays(easter, -2)), 'Karfreitag'],
    [dateKey(addCalendarDays(easter, 1)), 'Ostermontag'],
    [dateKey(addCalendarDays(easter, 39)), 'Christi Himmelfahrt'],
    [dateKey(addCalendarDays(easter, 50)), 'Pfingstmontag'],
    [dateKey(addCalendarDays(easter, 60)), 'Fronleichnam'],
  ]);
  return movableHolidays.get(dateKey(date)) || null;
}
