import {
  MonthlyBudget,
  Transaction,
  RecurringTemplate,
  FullAppBackupPayload,
} from '../types';
import {
  calculateWeekNumber,
  filterDuplicateTransactions,
  formatMonthIdToName,
  getMonthIdFromDate,
} from './expenseCalculations';
import { parseFlexibleDate } from './dateParsing';

/**
 * Clamps a 1..31 dayOfMonth to the actual calendar days in `monthId` (YYYY-MM)
 * and returns a normalized `YYYY-MM-DD` string.
 */
export function resolveRecurringDateForMonth(monthId: string, dayOfMonth: number): string {
  const [yrStr, moStr] = (monthId || '').split('-');
  const year = parseInt(yrStr, 10) || 2026;
  const month = parseInt(moStr, 10) || 11;
  const maxDay = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(maxDay, Math.max(1, Math.floor(Number(dayOfMonth) || 1)));
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    clampedDay
  ).padStart(2, '0')}`;
}

/**
 * Materializes enabled recurring templates into concrete Transaction objects for `monthId`.
 * Automatically skips any template that already has a matching transaction (Date, Type, Category, Description, Amount)
 * in `existingMonthTransactions`.
 */
export function materializeRecurringTemplatesForMonth(
  templates: RecurringTemplate[],
  monthId: string,
  existingMonthTransactions: Transaction[] = [],
  selectedTemplateIds?: string[],
  nowMs: number = Date.now()
): { toInsert: Transaction[]; skippedExistingCount: number } {
  if (!/^\d{4}-\d{2}$/.test(monthId)) {
    return { toInsert: [], skippedExistingCount: 0 };
  }

  const selectedSet = selectedTemplateIds ? new Set(selectedTemplateIds) : null;
  const activeTemplates = templates.filter((t) => {
    if (selectedSet) return selectedSet.has(t.id);
    return t.enabled;
  });

  const candidates: Transaction[] = activeTemplates
    .filter((t) => Number(t.amount) > 0 && t.category.trim() !== '')
    .map((tpl, idx) => {
      const dateStr = resolveRecurringDateForMonth(monthId, tpl.dayOfMonth);
      return {
        id: `rec-tx-${nowMs}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        monthId,
        date: dateStr,
        type: tpl.type === 'income' ? 'income' : 'expense',
        category: tpl.category.trim(),
        description: tpl.description.trim() || tpl.category.trim(),
        amount: Math.abs(Number(tpl.amount)),
        weekNumber: calculateWeekNumber(dateStr),
        notes: tpl.notes ? `${tpl.notes} (Recurring)` : 'Recurring transaction',
        createdAt: nowMs + idx,
      };
    });

  const { unique, duplicateCount } = filterDuplicateTransactions(
    candidates,
    existingMonthTransactions
  );

  return {
    toInsert: unique,
    skippedExistingCount: duplicateCount,
  };
}

/**
 * Serializes all application data (months, transactions, recurringTemplates) into a formatted JSON string.
 */
export function createFullBackupJSON(
  data: {
    months: Record<string, MonthlyBudget>;
    transactions: Transaction[];
    recurringTemplates: RecurringTemplate[];
  },
  exportedAt: string = new Date().toISOString()
): string {
  const payload: FullAppBackupPayload = {
    version: 1,
    exportedAt,
    app: 'HvrExpenseManager',
    months: data.months,
    transactions: data.transactions,
    recurringTemplates: data.recurringTemplates,
  };
  return JSON.stringify(payload, null, 2);
}

export type BackupValidationResult =
  | {
      ok: true;
      data: FullAppBackupPayload;
      stats: {
        monthCount: number;
        transactionCount: number;
        recurringCount: number;
      };
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Parses and validates a JSON backup string (supporting both full backup exports and
 * automatic `hvr_expense_backup_*` snapshots).
 */
export function parseAndValidateBackupJSON(rawJson: string): BackupValidationResult {
  if (!rawJson || !rawJson.trim()) {
    return { ok: false, error: 'Backup file is empty.' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'Invalid JSON format. Please select a valid backup .json file.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Backup root must be a JSON object.' };
  }

  if (
    (!parsed.months || typeof parsed.months !== 'object' || Array.isArray(parsed.months)) &&
    !Array.isArray(parsed.transactions)
  ) {
    return {
      ok: false,
      error: 'Backup is missing required "months" and "transactions" collections.',
    };
  }

  const normalizedMonths: Record<string, MonthlyBudget> = {};
  if (parsed.months && typeof parsed.months === 'object' && !Array.isArray(parsed.months)) {
    for (const [key, val] of Object.entries(parsed.months as Record<string, any>)) {
      const mId = typeof val?.monthId === 'string' ? val.monthId : key;
      if (!/^\d{4}-\d{2}$/.test(mId)) continue;
      const expMap: Record<string, number> = {};
      const incMap: Record<string, number> = {};
      if (val?.expenseBudgets && typeof val.expenseBudgets === 'object') {
        for (const [k, v] of Object.entries(val.expenseBudgets)) {
          expMap[k] = Number(v) || 0;
        }
      }
      if (val?.incomeBudgets && typeof val.incomeBudgets === 'object') {
        for (const [k, v] of Object.entries(val.incomeBudgets)) {
          incMap[k] = Number(v) || 0;
        }
      }
      normalizedMonths[mId] = {
        monthId: mId,
        monthName:
          typeof val?.monthName === 'string' && val.monthName.trim()
            ? val.monthName.trim()
            : formatMonthIdToName(mId),
        startBalance: Number(val?.startBalance) || 0,
        expenseBudgets: expMap,
        incomeBudgets: incMap,
        ...(typeof val?.driveFileId === 'string' ? { driveFileId: val.driveFileId } : {}),
        ...(typeof val?.lastSyncedAt === 'number' ? { lastSyncedAt: val.lastSyncedAt } : {}),
      };
    }
  }

  const normalizedTransactions: Transaction[] = [];
  if (Array.isArray(parsed.transactions)) {
    for (let i = 0; i < parsed.transactions.length; i++) {
      const rawTx = parsed.transactions[i];
      if (!rawTx || typeof rawTx !== 'object') continue;
      const dateStr = parseFlexibleDate(rawTx.date);
      const amount = Math.abs(Number(rawTx.amount) || 0);
      if (!dateStr || amount <= 0) continue;
      const monthId =
        typeof rawTx.monthId === 'string' && /^\d{4}-\d{2}$/.test(rawTx.monthId)
          ? rawTx.monthId
          : getMonthIdFromDate(dateStr);
      const category = String(rawTx.category || 'Unplanned').trim() || 'Unplanned';
      const description = String(rawTx.description || category).trim() || category;
      const type = rawTx.type === 'income' ? 'income' : 'expense';
      normalizedTransactions.push({
        id:
          typeof rawTx.id === 'string' && rawTx.id.trim()
            ? rawTx.id.trim()
            : `restored-tx-${Date.now()}-${i}`,
        monthId,
        date: dateStr,
        type,
        category,
        description,
        amount,
        weekNumber: calculateWeekNumber(dateStr),
        notes: typeof rawTx.notes === 'string' ? rawTx.notes : undefined,
        createdAt: Number(rawTx.createdAt) || Date.now() + i,
      });
    }
  }

  // Ensure every transaction's monthId has a board in normalizedMonths
  for (const tx of normalizedTransactions) {
    if (!normalizedMonths[tx.monthId]) {
      normalizedMonths[tx.monthId] = {
        monthId: tx.monthId,
        monthName: formatMonthIdToName(tx.monthId),
        startBalance: 0,
        expenseBudgets: { [tx.category]: 0 },
        incomeBudgets: {},
      };
    }
  }

  const normalizedRecurring: RecurringTemplate[] = [];
  if (Array.isArray(parsed.recurringTemplates)) {
    for (let i = 0; i < parsed.recurringTemplates.length; i++) {
      const rawRec = parsed.recurringTemplates[i];
      if (!rawRec || typeof rawRec !== 'object') continue;
      const amount = Math.abs(Number(rawRec.amount) || 0);
      const category = String(rawRec.category || '').trim();
      if (amount <= 0 || !category) continue;
      const dayOfMonth = Math.min(31, Math.max(1, Math.floor(Number(rawRec.dayOfMonth) || 1)));
      normalizedRecurring.push({
        id:
          typeof rawRec.id === 'string' && rawRec.id.trim()
            ? rawRec.id.trim()
            : `rec-${Date.now()}-${i}`,
        type: rawRec.type === 'income' ? 'income' : 'expense',
        category,
        description: String(rawRec.description || category).trim() || category,
        amount,
        dayOfMonth,
        enabled: rawRec.enabled !== false,
        notes: typeof rawRec.notes === 'string' ? rawRec.notes : undefined,
      });
    }
  }

  if (
    Object.keys(normalizedMonths).length === 0 &&
    normalizedTransactions.length === 0 &&
    normalizedRecurring.length === 0
  ) {
    return {
      ok: false,
      error: 'Backup contains no valid month boards, transactions, or recurring templates.',
    };
  }

  return {
    ok: true,
    data: {
      version: Number(parsed.version) || 1,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
      app: 'HvrExpenseManager',
      months: normalizedMonths,
      transactions: normalizedTransactions,
      recurringTemplates: normalizedRecurring,
    },
    stats: {
      monthCount: Object.keys(normalizedMonths).length,
      transactionCount: normalizedTransactions.length,
      recurringCount: normalizedRecurring.length,
    },
  };
}
