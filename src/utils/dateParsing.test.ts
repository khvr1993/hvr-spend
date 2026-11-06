import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFlexibleDate,
  parseExcelSerialDate,
  formatLocalYYYYMMDD,
} from './dateParsing';

test('parseFlexibleDate parses ISO YYYY-MM-DD and slash/dot variants accurately', () => {
  assert.equal(parseFlexibleDate('2026-11-02'), '2026-11-02');
  assert.equal(parseFlexibleDate('2026/11/2'), '2026-11-02');
  assert.equal(parseFlexibleDate('2026.11.02'), '2026-11-02');
  assert.equal(parseFlexibleDate('2026-11-02T00:00:00.000Z'), '2026-11-02');
});

test('parseFlexibleDate handles DD/MM/YYYY and MM/DD/YYYY without timezone off-by-one shifts', () => {
  // Ambiguous <=12 defaults to DD/MM/YYYY (Indian/international standard)
  assert.equal(parseFlexibleDate('02-11-2026'), '2026-11-02');
  assert.equal(parseFlexibleDate('02/11/2026'), '2026-11-02');
  assert.equal(parseFlexibleDate('11/02/2026'), '2026-02-11');

  // Explicit preferMonthFirst option for US-formatted sheets
  assert.equal(parseFlexibleDate('11/2/2026', { preferMonthFirst: true }), '2026-11-02');

  // Unambiguous DD/MM/YYYY when first > 12
  assert.equal(parseFlexibleDate('25/11/2026'), '2026-11-25');
  assert.equal(parseFlexibleDate('25-11-2026'), '2026-11-25');

  // Unambiguous MM/DD/YYYY when second > 12
  assert.equal(parseFlexibleDate('11/25/2026'), '2026-11-25');
  assert.equal(parseFlexibleDate('11-25-2026'), '2026-11-25');
});

test('parseFlexibleDate converts Excel serial numbers accurately', () => {
  // 45678 days after 1899-12-30 is 2025-01-21
  assert.equal(parseExcelSerialDate(45678), '2025-01-21');
  assert.equal(parseFlexibleDate(45678), '2025-01-21');
  assert.equal(parseFlexibleDate('45678'), '2025-01-21');
});

test('parseFlexibleDate rejects invalid dates instead of falling back to today', () => {
  assert.equal(parseFlexibleDate(''), null);
  assert.equal(parseFlexibleDate('   '), null);
  assert.equal(parseFlexibleDate('not-a-date'), null);
  assert.equal(parseFlexibleDate('2026-02-30'), null);
  assert.equal(parseFlexibleDate('2026-13-01'), null);
  assert.equal(parseFlexibleDate(null), null);
  assert.equal(parseFlexibleDate(undefined), null);
});

test('formatLocalYYYYMMDD uses local calendar components without UTC shift', () => {
  const d = new Date(2026, 10, 2, 0, 15, 0); // Local Nov 2, 2026 00:15 AM
  assert.equal(formatLocalYYYYMMDD(d), '2026-11-02');
});
