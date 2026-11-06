import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRecurringDateForMonth,
  materializeRecurringTemplatesForMonth,
  createFullBackupJSON,
  parseAndValidateBackupJSON,
} from './recurringAndBackup';
import { RecurringTemplate, MonthlyBudget, Transaction } from '../types';

test('resolveRecurringDateForMonth clamps dayOfMonth to real calendar days (including Feb & 30-day months)', () => {
  assert.equal(resolveRecurringDateForMonth('2026-11', 1), '2026-11-01');
  assert.equal(resolveRecurringDateForMonth('2026-11', 31), '2026-11-30');
  assert.equal(resolveRecurringDateForMonth('2026-02', 31), '2026-02-28');
  assert.equal(resolveRecurringDateForMonth('2028-02', 31), '2028-02-29'); // Leap year
  assert.equal(resolveRecurringDateForMonth('2026-12', 31), '2026-12-31');
});

test('materializeRecurringTemplatesForMonth seeds enabled templates, maps weeks 1..5, and skips duplicates', () => {
  const templates: RecurringTemplate[] = [
    {
      id: 'rec-salary',
      type: 'income',
      category: 'Paycheck',
      description: 'Monthly Salary',
      amount: 250000,
      dayOfMonth: 1,
      enabled: true,
    },
    {
      id: 'rec-rent',
      type: 'expense',
      category: 'Home',
      description: 'House Rent',
      amount: 15000,
      dayOfMonth: 5,
      enabled: true,
    },
    {
      id: 'rec-netflix',
      type: 'expense',
      category: 'Entertainment & Leisure',
      description: 'Netflix Subscription',
      amount: 649,
      dayOfMonth: 18,
      enabled: true,
    },
    {
      id: 'rec-paused',
      type: 'expense',
      category: 'Shopping',
      description: 'Paused Membership',
      amount: 999,
      dayOfMonth: 10,
      enabled: false,
    },
  ];

  // First seed into an empty month (2026-12)
  const firstRun = materializeRecurringTemplatesForMonth(templates, '2026-12', []);
  assert.equal(firstRun.toInsert.length, 3);
  assert.equal(firstRun.skippedExistingCount, 0);

  assert.equal(firstRun.toInsert[0].date, '2026-12-01');
  assert.equal(firstRun.toInsert[0].type, 'income');
  assert.equal(firstRun.toInsert[0].weekNumber, 1);

  assert.equal(firstRun.toInsert[1].date, '2026-12-05');
  assert.equal(firstRun.toInsert[1].category, 'Home');
  assert.equal(firstRun.toInsert[1].amount, 15000);
  assert.equal(firstRun.toInsert[1].weekNumber, 1);

  assert.equal(firstRun.toInsert[2].date, '2026-12-18');
  assert.equal(firstRun.toInsert[2].weekNumber, 3);

  // Second seed into the same month when those transactions already exist -> skips all 3!
  const secondRun = materializeRecurringTemplatesForMonth(
    templates,
    '2026-12',
    firstRun.toInsert
  );
  assert.equal(secondRun.toInsert.length, 0);
  assert.equal(secondRun.skippedExistingCount, 3);

  // Selective seeding via selectedTemplateIds (e.g. user unchecks Netflix in modal)
  const selectiveRun = materializeRecurringTemplatesForMonth(
    templates,
    '2027-01',
    [],
    ['rec-rent']
  );
  assert.equal(selectiveRun.toInsert.length, 1);
  assert.equal(selectiveRun.toInsert[0].description, 'House Rent');
  assert.equal(selectiveRun.toInsert[0].date, '2027-01-05');
});

test('createFullBackupJSON and parseAndValidateBackupJSON round-trip full state and legacy snapshots', () => {
  const months: Record<string, MonthlyBudget> = {
    '2026-11': {
      monthId: '2026-11',
      monthName: 'Nov-26 Expenses',
      startBalance: 5000,
      expenseBudgets: { Food: 8000, Home: 15000 },
      incomeBudgets: { Paycheck: 250000 },
    },
  };
  const transactions: Transaction[] = [
    {
      id: 'tx-101',
      monthId: '2026-11',
      date: '2026-11-05',
      type: 'expense',
      category: 'Home',
      description: 'House Rent',
      amount: 15000,
      weekNumber: 1,
      createdAt: 1700000000000,
    },
  ];
  const recurringTemplates: RecurringTemplate[] = [
    {
      id: 'rec-1',
      type: 'expense',
      category: 'Home',
      description: 'House Rent',
      amount: 15000,
      dayOfMonth: 5,
      enabled: true,
    },
  ];

  const json = createFullBackupJSON(
    { months, transactions, recurringTemplates },
    '2026-11-06T06:00:00.000Z'
  );
  const validated = parseAndValidateBackupJSON(json);
  assert.equal(validated.ok, true);
  if (validated.ok) {
    assert.equal(validated.stats.monthCount, 1);
    assert.equal(validated.stats.transactionCount, 1);
    assert.equal(validated.stats.recurringCount, 1);
    assert.equal(validated.data.months['2026-11'].startBalance, 5000);
    assert.equal(validated.data.transactions[0].description, 'House Rent');
    assert.equal(validated.data.recurringTemplates[0].dayOfMonth, 5);
  }

  // Legacy snapshot format (only months + transactions, no recurringTemplates)
  const legacyJson = JSON.stringify({ months, transactions });
  const legacyValidated = parseAndValidateBackupJSON(legacyJson);
  assert.equal(legacyValidated.ok, true);
  if (legacyValidated.ok) {
    assert.equal(legacyValidated.stats.monthCount, 1);
    assert.equal(legacyValidated.stats.transactionCount, 1);
    assert.equal(legacyValidated.stats.recurringCount, 0);
  }

  // Invalid JSON inputs
  assert.equal(parseAndValidateBackupJSON('').ok, false);
  assert.equal(parseAndValidateBackupJSON('{not-valid-json').ok, false);
  assert.equal(parseAndValidateBackupJSON('{"foo":"bar"}').ok, false);
});
