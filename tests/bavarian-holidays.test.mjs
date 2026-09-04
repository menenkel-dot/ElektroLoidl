import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBavarianHoliday } from '../lib/bavarian-holidays.mjs';

const localDate = value => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

test('Bavarian calendar returns fixed and movable statewide holidays', () => {
  const expected = new Map([
    ['2026-01-01', 'Neujahr'],
    ['2026-01-06', 'Heilige Drei Könige'],
    ['2026-04-03', 'Karfreitag'],
    ['2026-04-06', 'Ostermontag'],
    ['2026-05-01', 'Tag der Arbeit'],
    ['2026-05-14', 'Christi Himmelfahrt'],
    ['2026-05-25', 'Pfingstmontag'],
    ['2026-06-04', 'Fronleichnam'],
    ['2026-10-03', 'Tag der Deutschen Einheit'],
    ['2026-11-01', 'Allerheiligen'],
    ['2026-12-25', '1. Weihnachtstag'],
    ['2026-12-26', '2. Weihnachtstag'],
  ]);

  for (const [date, name] of expected) {
    assert.equal(getBavarianHoliday(localDate(date)), name, date);
  }
  assert.equal(getBavarianHoliday(localDate('2026-04-07')), null);
  assert.equal(getBavarianHoliday(localDate('2026-08-15')), null);
  assert.equal(getBavarianHoliday(localDate('2026-08-08')), null);
});

test('movable holidays remain correct across different Easter dates', () => {
  assert.equal(getBavarianHoliday(localDate('2027-03-26')), 'Karfreitag');
  assert.equal(getBavarianHoliday(localDate('2027-05-27')), 'Fronleichnam');
  assert.equal(getBavarianHoliday(localDate('2028-04-17')), 'Ostermontag');
});
