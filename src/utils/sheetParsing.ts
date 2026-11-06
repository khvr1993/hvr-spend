import { Transaction } from '../types';
import { calculateWeekNumber } from './expenseCalculations';
import { parseFlexibleDate } from './dateParsing';

export interface SheetParseResult {
  transactions: Transaction[];
  skippedInvalidDateCount: number;
  skippedInvalidAmountCount: number;
}

/**
 * Pure parser that converts 2D Google Sheet / Excel rows into normalized Transaction objects.
 * - Uses timezone-safe `parseFlexibleDate` (never shifts dates backward in IST).
 * - Skips rows with missing/unparseable dates instead of silently defaulting to today.
 * - Derives `monthId` directly from `dateStr.slice(0, 7)` so `monthId` and `date` never disagree.
 * - Computes `weekNumber` (1..5) via `calculateWeekNumber(dateStr)`.
 */
export function parseSheetRowsWithDiagnostics(
  rows: unknown[][],
  defaultMonthId: string
): SheetParseResult {
  if (!rows || rows.length <= 1) {
    return { transactions: [], skippedInvalidDateCount: 0, skippedInvalidAmountCount: 0 };
  }

  const headers = (rows[0] || []).map((h) => String(h ?? '').toLowerCase().trim());
  const dateIdx = headers.findIndex((h) => h.includes('date') || h === 'day');
  const typeIdx = headers.findIndex((h) => h.includes('type'));
  const catIdx = headers.findIndex((h) => h.includes('cat'));
  const descIdx = headers.findIndex(
    (h) =>
      h.includes('desc') ||
      h.includes('item') ||
      h.includes('detail') ||
      h.includes('narration') ||
      h.includes('particular')
  );
  const amtIdx = headers.findIndex(
    (h) =>
      h.includes('amount') ||
      h.includes('amt') ||
      h.includes('price') ||
      h.includes('cost') ||
      h.includes('spend')
  );
  const notesIdx = headers.findIndex((h) => h.includes('note'));

  const transactions: Transaction[] = [];
  let skippedInvalidDateCount = 0;
  let skippedInvalidAmountCount = 0;

  const fallbackMonth = /^\d{4}-\d{2}$/.test(defaultMonthId) ? defaultMonthId : '2026-11';

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((cell) => String(cell ?? '').trim() === '')) {
      continue;
    }

    const rawAmt = amtIdx >= 0 ? String(row[amtIdx] ?? '') : '0';
    const cleanedAmt = Math.abs(parseFloat(rawAmt.replace(/[^0-9.-]/g, '')) || 0);
    if (cleanedAmt <= 0) {
      skippedInvalidAmountCount += 1;
      continue;
    }

    const rawDate = dateIdx >= 0 ? row[dateIdx] : undefined;
    const parsedDate = parseFlexibleDate(rawDate);
    if (!parsedDate) {
      skippedInvalidDateCount += 1;
      continue;
    }

    const rawType = typeIdx >= 0 ? String(row[typeIdx] ?? '').toLowerCase() : '';
    const rawCat = (catIdx >= 0 ? String(row[catIdx] ?? '').trim() : '') || 'Unplanned';
    const rawDesc =
      (descIdx >= 0 ? String(row[descIdx] ?? '').trim() : '') ||
      rawCat ||
      'Imported transaction';
    const rawNotes = notesIdx >= 0 ? String(row[notesIdx] ?? '').trim() : '';

    const isIncome =
      rawType.includes('income') ||
      rawType.includes('credit') ||
      rawCat.toLowerCase().includes('paycheck') ||
      rawCat.toLowerCase().includes('salary');

    const derivedMonthId = parsedDate.slice(0, 7) || fallbackMonth;

    transactions.push({
      id: `imported-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      monthId: derivedMonthId,
      date: parsedDate,
      type: isIncome ? 'income' : 'expense',
      category: rawCat,
      description: rawDesc,
      amount: cleanedAmt,
      weekNumber: calculateWeekNumber(parsedDate),
      notes: rawNotes,
      createdAt: Date.now() + i,
    });
  }

  return {
    transactions,
    skippedInvalidDateCount,
    skippedInvalidAmountCount,
  };
}

export function parseSheetRowsToTransactions(
  rows: unknown[][],
  defaultMonthId: string
): Transaction[] {
  return parseSheetRowsWithDiagnostics(rows, defaultMonthId).transactions;
}
