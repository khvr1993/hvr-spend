import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSheetRowsToTransactions,
  parseSheetRowsWithDiagnostics,
} from './sheetParsing';

test('P0-4: parseSheetRowsToTransactions maps weeks 1..5 accurately and derives monthId from date', () => {
  const rows = [
    ['Date', 'Type', 'Category', 'Description', 'Amount', 'Week Number', 'Notes'],
    ['2026-11-02', 'expense', 'Food', 'Day 2 Week 1', '100', 'Week 1', ''],
    ['2026-11-08', 'expense', 'Food', 'Day 8 Week 2', '200', 'Week 2', ''],
    ['2026-11-15', 'expense', 'Home', 'Day 15 Week 3', '300', 'Week 3', ''],
    ['2026-11-22', 'expense', 'Shopping', 'Day 22 Week 4', '400', 'Week 4', ''],
    ['2026-11-29', 'expense', 'Splurge', 'Day 29 Week 5', '500', 'Week 5', ''],
    ['2026-12-05', 'income', 'Paycheck', 'Cross-month Dec Salary', '250000', 'Week 1', 'Bonus'],
  ];

  const txs = parseSheetRowsToTransactions(rows, '2026-11');
  assert.equal(txs.length, 6);

  assert.equal(txs[0].weekNumber, 1);
  assert.equal(txs[0].monthId, '2026-11');

  assert.equal(txs[1].weekNumber, 2);
  assert.equal(txs[2].weekNumber, 3);
  assert.equal(txs[3].weekNumber, 4);
  assert.equal(txs[4].weekNumber, 5);

  // Cross-month row retains its true monthId ('2026-12') matching its date ('2026-12-05')
  assert.equal(txs[5].date, '2026-12-05');
  assert.equal(txs[5].monthId, '2026-12');
  assert.equal(txs[5].type, 'income');
  assert.equal(txs[5].weekNumber, 1);
});

test('P0-4: parseSheetRowsWithDiagnostics skips invalid dates instead of substituting today', () => {
  const rows = [
    ['Date', 'Category', 'Description', 'Amount'],
    ['02-11-2026', 'Food', 'Valid DD-MM-YYYY', '450'],
    ['invalid-date-text', 'Food', 'Should be skipped', '999'],
    ['', 'Food', 'Empty date should be skipped', '500'],
    ['2026-11-19', 'Food', 'Zero amount skipped', '0'],
  ];

  const result = parseSheetRowsWithDiagnostics(rows, '2026-11');
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].date, '2026-11-02');
  assert.equal(result.transactions[0].weekNumber, 1);
  assert.equal(result.skippedInvalidDateCount, 2);
  assert.equal(result.skippedInvalidAmountCount, 1);
});

test('P0-4 regression: both 11/2/2026 (en_US) and 02/11/2026 (en_IN/GB) in a Nov-2026 sheet resolve to 2026-11-02', () => {
  const usRows = [
    ['Date', 'Type', 'Category', 'Description', 'Amount'],
    ['11/2/2026', 'expense', 'Food', 'US formatted Nov 2', '320'],
  ];
  const inRows = [
    ['Date', 'Type', 'Category', 'Description', 'Amount'],
    ['02/11/2026', 'expense', 'Food', 'IN formatted Nov 2', '320'],
  ];

  const usTxs = parseSheetRowsToTransactions(usRows, '2026-11');
  assert.equal(usTxs.length, 1);
  assert.equal(usTxs[0].date, '2026-11-02');
  assert.equal(usTxs[0].monthId, '2026-11');
  assert.equal(usTxs[0].weekNumber, 1);

  const inTxs = parseSheetRowsToTransactions(inRows, '2026-11');
  assert.equal(inTxs.length, 1);
  assert.equal(inTxs[0].date, '2026-11-02');
  assert.equal(inTxs[0].monthId, '2026-11');
  assert.equal(inTxs[0].weekNumber, 1);
});

