import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoSyncController } from './autoSync';
import { calculateSummary } from './expenseCalculations';
import { toExcelSerialDate } from './dateParsing';
import {
  syncToGoogleDrive,
  importTransactionsFromGoogleSheet,
  initAuth,
  defaultTokenStore,
} from '../services/googleDriveService';
import { MonthlyBudget, Transaction } from '../types';

const sampleBudget: MonthlyBudget = {
  monthId: '2026-11',
  monthName: 'Nov-26 Expenses',
  startBalance: 0,
  expenseBudgets: { Food: 8000 },
  incomeBudgets: { Paycheck: 250000 },
};

const sampleTransactions: Transaction[] = [
  {
    id: 'tx-1',
    monthId: '2026-11',
    date: '2026-11-02',
    type: 'expense',
    category: 'Food',
    description: 'Groceries',
    amount: 500,
    weekNumber: 1,
    createdAt: 1,
  },
];

const sampleSummary = calculateSummary(
  '2026-11',
  'Nov-26 Expenses',
  0,
  sampleTransactions,
  sampleBudget.expenseBudgets,
  sampleBudget.incomeBudgets
);

test('P0-1: createAutoSyncController updates lastSyncedAt and driveFileId on success and ignores concurrent in-flight calls', async () => {
  const controller = createAutoSyncController();
  let syncCallCount = 0;
  let savedMonthId = '';
  let savedFileId = '';
  let savedSyncedAt = 0;
  let settledCount = 0;

  let resolveSync!: (val: { id: string; url: string; title: string; isUpdated: boolean }) => void;
  const fakeSync = () => {
    syncCallCount += 1;
    return new Promise<{ id: string; url: string; title: string; isUpdated: boolean }>((res) => {
      resolveSync = res;
    });
  };

  const p1 = controller.runIfDue({
    dailyAutoSync: true,
    accessToken: 'token-123',
    todayStr: '2026-11-06',
    monthId: '2026-11',
    summary: sampleSummary,
    transactions: sampleTransactions,
    budget: sampleBudget,
    syncFn: fakeSync,
    onSyncSuccess: (mId, fId, ts) => {
      savedMonthId = mId;
      savedFileId = fId;
      savedSyncedAt = ts;
    },
    onSyncSettled: () => {
      settledCount += 1;
    },
    nowFn: () => 1762387200000,
  });

  assert.equal(controller.isInFlight(), true);

  // Second concurrent call while first is in-flight must be ignored
  const p2Result = await controller.runIfDue({
    dailyAutoSync: true,
    accessToken: 'token-123',
    todayStr: '2026-11-06',
    monthId: '2026-11',
    summary: sampleSummary,
    transactions: sampleTransactions,
    budget: sampleBudget,
    syncFn: fakeSync,
    onSyncSuccess: () => {},
    nowFn: () => 1762387200000,
  });
  assert.equal(p2Result, false);
  assert.equal(syncCallCount, 1);

  resolveSync({
    id: 'sheet-abc',
    url: 'https://docs.google.com/spreadsheets/d/sheet-abc',
    title: '[HvrExpenseManager] Nov-26',
    isUpdated: true,
  });

  const p1Result = await p1;
  assert.equal(p1Result, true);
  assert.equal(controller.isInFlight(), false);
  assert.equal(savedMonthId, '2026-11');
  assert.equal(savedFileId, 'sheet-abc');
  assert.equal(savedSyncedAt, 1762387200000);
  assert.equal(settledCount, 1);
});

test('P0-1: createAutoSyncController records error and clears in-flight state on failure', async () => {
  const controller = createAutoSyncController();
  let capturedError = '';

  const result = await controller.runIfDue({
    dailyAutoSync: true,
    accessToken: 'token-123',
    todayStr: '2026-11-06',
    monthId: '2026-11',
    summary: sampleSummary,
    transactions: sampleTransactions,
    budget: sampleBudget,
    syncFn: async () => {
      throw new Error('Drive quota exceeded');
    },
    onSyncSuccess: () => {
      assert.fail('Should not call onSyncSuccess');
    },
    onSyncError: (msg) => {
      capturedError = msg;
    },
    nowFn: () => 1000,
  });

  assert.equal(result, false);
  assert.equal(controller.isInFlight(), false);
  assert.equal(capturedError, 'Drive quota exceeded');
});

test('P0-6: syncToGoogleDrive writes values:batchUpdate BEFORE values:batchClear and never clears if write fails', async () => {
  const calls: string[] = [];

  // 1. Test successful update ordering: batchUpdate MUST precede batchClear
  const successMockFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes(':batchUpdate')) {
      calls.push('batchUpdate');
      return new Response(JSON.stringify({}), { status: 200 });
    }
    if (url.includes(':batchClear')) {
      calls.push('batchClear');
      return new Response(JSON.stringify({}), { status: 200 });
    }
    if (url.includes('fields=webViewLink')) {
      calls.push('getWebViewLink');
      return new Response(
        JSON.stringify({ webViewLink: 'https://docs.google.com/spreadsheets/d/existing-123' }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const res = await syncToGoogleDrive(
    'valid-token',
    sampleSummary,
    sampleTransactions,
    { ...sampleBudget, driveFileId: 'existing-123' },
    'existing-123',
    successMockFetch
  );

  assert.equal(res.id, 'existing-123');
  assert.deepEqual(calls.slice(0, 2), ['batchUpdate', 'batchClear']);

  // 2. Test failed write: if batchUpdate fails (e.g. 500 or 401), batchClear is NEVER called
  const failCalls: string[] = [];
  const failMockFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes(':batchUpdate')) {
      failCalls.push('batchUpdate');
      return new Response(
        JSON.stringify({ error: { message: 'Temporary network failure' } }),
        { status: 503, statusText: 'Service Unavailable' }
      );
    }
    if (url.includes(':batchClear')) {
      failCalls.push('batchClear');
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  await assert.rejects(
    () =>
      syncToGoogleDrive(
        'valid-token',
        sampleSummary,
        sampleTransactions,
        { ...sampleBudget, driveFileId: 'existing-123' },
        'existing-123',
        failMockFetch
      ),
    /Temporary network failure/
  );

  assert.deepEqual(failCalls, ['batchUpdate']);
});

test('P0-4 & P0-6: end-to-end write then import round-trip preserves 2026-11-02 via UNFORMATTED_VALUE + SERIAL_NUMBER', async () => {
  let writtenTxRows: (string | number)[][] = [];
  let requestedImportUrl = '';

  const roundTripFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes(':batchUpdate') && init?.body) {
      const body = JSON.parse(String(init.body));
      const txSheet = body.data.find((d: { range: string }) =>
        d.range.startsWith('Transactions!')
      );
      // Simulate Google Sheets storing USER_ENTERED date strings as numeric serial numbers
      writtenTxRows = (txSheet.values as (string | number)[][]).map((row, idx) => {
        if (idx === 0) return row;
        const serial = toExcelSerialDate(String(row[0]));
        return [serial ?? row[0], ...row.slice(1)];
      });
      return new Response(JSON.stringify({}), { status: 200 });
    }
    if (url.includes('/values/Transactions')) {
      requestedImportUrl = url;
      return new Response(JSON.stringify({ values: writtenTxRows }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  await syncToGoogleDrive(
    'valid-token',
    sampleSummary,
    sampleTransactions,
    { ...sampleBudget, driveFileId: 'sheet-rt-1' },
    'sheet-rt-1',
    roundTripFetch
  );

  const imported = await importTransactionsFromGoogleSheet(
    'valid-token',
    'sheet-rt-1',
    '2026-11',
    roundTripFetch
  );

  assert.ok(requestedImportUrl.includes('valueRenderOption=UNFORMATTED_VALUE'));
  assert.ok(requestedImportUrl.includes('dateTimeRenderOption=SERIAL_NUMBER'));
  assert.equal(imported.length, 1);
  assert.equal(imported[0].date, '2026-11-02');
  assert.equal(imported[0].monthId, '2026-11');
  assert.equal(imported[0].weekNumber, 1);
  assert.equal(imported[0].amount, 500);
});

test('P0-2: 401/403 during mid-session Drive call invalidates token and triggers onAuthNeedsReconnect', async () => {
  defaultTokenStore.saveToken('ya29.active-session-token', 3600);
  defaultTokenStore.saveUserProfile({
    uid: 'u-1',
    displayName: 'Harsha',
    email: 'khvr.1993@gmail.com',
  });

  let reconnectUserEmail: string | null = null;
  initAuth(
    () => {},
    () => {},
    (user) => {
      reconnectUserEmail = user.email;
    }
  );

  const expiredFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({ error: { message: 'Request had invalid authentication credentials.' } }),
      { status: 401, statusText: 'Unauthorized' }
    );
  };

  await assert.rejects(
    () =>
      importTransactionsFromGoogleSheet(
        'ya29.active-session-token',
        'sheet-123',
        '2026-11',
        expiredFetch
      ),
    /401|authentication/i
  );

  assert.equal(defaultTokenStore.getValidToken(), null);
  assert.equal(reconnectUserEmail, 'khvr.1993@gmail.com');
  defaultTokenStore.clearAll();
});

