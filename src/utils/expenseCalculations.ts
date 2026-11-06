import { Transaction, MonthlySummary, CategoryBudget } from '../types';
import { formatLocalYYYYMMDD, parseFlexibleDate } from './dateParsing';

export { formatLocalYYYYMMDD, parseFlexibleDate };

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Food',
  'Shopping',
  'Health/medical',
  'Home',
  'Transportation',
  'Guilt free',
  'Entertainment & Leisure',
  'Bills and Debt',
  'Waste',
  'Unplanned',
  'Splurge',
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  'Savings',
  'Paycheck',
  'Bonus',
  'Interest',
  'Other',
  'Custom category',
] as const;

/**
 * Calculates which week of the month (1 to 5) a date belongs to based on day of month.
 * Days 1-7: Week 1, 8-14: Week 2, 15-21: Week 3, 22-28: Week 4, 29+: Week 5.
 */
export function calculateWeekNumber(dateStr: string): number {
  if (!dateStr) return 1;
  const parts = dateStr.split('-');
  const day = parseInt(parts[2] || '1', 10);
  if (isNaN(day) || day < 1) return 1;
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  if (day <= 28) return 4;
  return 5;
}

/**
 * Format currency in Indian Rupee format matching the user's Google Sheet:
 * e.g. ₹234,762.00 or ₹15,238.00
 */
export function formatINR(val: number, showDecimals: boolean = true): string {
  const num = Number(val) || 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const formatted = absNum.toLocaleString('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
  return `${isNegative ? '-' : ''}₹${formatted}`;
}

const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Extracts YYYY-MM monthId from a YYYY-MM-DD date string.
 */
export function getMonthIdFromDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) {
    return formatLocalYYYYMMDD().slice(0, 7);
  }
  return dateStr.slice(0, 7);
}

/**
 * Formats a YYYY-MM monthId into the standard board title (e.g. "2026-12" -> "Dec-26 Expenses")
 */
export function formatMonthIdToName(monthId: string): string {
  const parts = monthId.split('-');
  if (parts.length < 2) return `${monthId} Expenses`;
  const yearShort = parts[0].slice(-2);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const monthShort = MONTH_SHORT_NAMES[monthIndex] || parts[1];
  return `${monthShort}-${yearShort} Expenses`;
}

/**
 * Formats a YYYY-MM monthId into the unique Google Drive spreadsheet filename
 * e.g. "2026-12" -> "[HvrExpenseManager] Dec-26"
 */
export function formatDriveFileTitle(monthId: string): string {
  const parts = monthId.split('-');
  if (parts.length < 2) return `[HvrExpenseManager] ${monthId}`;
  const yearShort = parts[0].slice(-2);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const monthShort = MONTH_SHORT_NAMES[monthIndex] || parts[1];
  return `[HvrExpenseManager] ${monthShort}-${yearShort}`;
}

/**
 * Determines whether the daily automatic Drive sync is due for a monthly board
 */
export function isDailySyncDue(lastSyncedAt: number | undefined, todayDateStr: string): boolean {
  if (!lastSyncedAt) return true;
  const syncedDateStr = formatLocalYYYYMMDD(new Date(lastSyncedAt));
  return syncedDateStr !== todayDateStr;
}

/**
 * Calculates summary for a given month
 */
export function calculateSummary(
  monthId: string,
  monthName: string,
  startBalance: number,
  transactions: Transaction[],
  expenseBudgets: Record<string, number>,
  incomeBudgets: Record<string, number>
): MonthlySummary {
  const monthTransactions = transactions.filter((t) => t.monthId === monthId);

  // Calculate actuals by category
  const expenseActuals: Record<string, number> = {};
  const incomeActuals: Record<string, number> = {};

  const weeklyTotals = {
    week1: 0,
    week2: 0,
    week3: 0,
    week4: 0,
    week5: 0,
    total: 0,
  };

  for (const t of monthTransactions) {
    const amount = Number(t.amount) || 0;
    if (t.type === 'expense') {
      expenseActuals[t.category] = (expenseActuals[t.category] || 0) + amount;
      const week = t.weekNumber || calculateWeekNumber(t.date);
      if (week === 1) weeklyTotals.week1 += amount;
      else if (week === 2) weeklyTotals.week2 += amount;
      else if (week === 3) weeklyTotals.week3 += amount;
      else if (week === 4) weeklyTotals.week4 += amount;
      else weeklyTotals.week5 += amount;
      weeklyTotals.total += amount;
    } else if (t.type === 'income') {
      incomeActuals[t.category] = (incomeActuals[t.category] || 0) + amount;
    }
  }

  // Build expense category totals respecting user-edited categories
  const baseExpenseCategories =
    Object.keys(expenseBudgets).length > 0
      ? Object.keys(expenseBudgets)
      : [...DEFAULT_EXPENSE_CATEGORIES];

  const allExpenseCategories = Array.from(
    new Set([...baseExpenseCategories, ...Object.keys(expenseActuals)])
  );

  let plannedExpenses = 0;
  let actualExpenses = 0;

  const expenseCategoryTotals: CategoryBudget[] = allExpenseCategories.map((cat) => {
    const planned = Number(expenseBudgets[cat]) || 0;
    const actual = Number(expenseActuals[cat]) || 0;
    const diff = planned - actual;
    plannedExpenses += planned;
    actualExpenses += actual;
    return {
      category: cat,
      planned,
      actual,
      diff,
      type: 'expense',
    };
  });

  // Build income category totals respecting user-edited categories
  const baseIncomeCategories =
    Object.keys(incomeBudgets).length > 0
      ? Object.keys(incomeBudgets)
      : [...DEFAULT_INCOME_CATEGORIES];

  const allIncomeCategories = Array.from(
    new Set([...baseIncomeCategories, ...Object.keys(incomeActuals)])
  );

  let plannedIncome = 0;
  let actualIncome = 0;

  const incomeCategoryTotals: CategoryBudget[] = allIncomeCategories.map((cat) => {
    const planned = Number(incomeBudgets[cat]) || 0;
    const actual = Number(incomeActuals[cat]) || 0;
    const diff = planned - actual;
    plannedIncome += planned;
    actualIncome += actual;
    return {
      category: cat,
      planned,
      actual,
      diff,
      type: 'income',
    };
  });

  const expenseDiff = plannedExpenses - actualExpenses;
  const incomeDiff = plannedIncome - actualIncome;
  const savedThisMonth = actualIncome - actualExpenses;
  const endBalance = startBalance + savedThisMonth;
  const savingsRate = actualIncome > 0 ? (savedThisMonth / actualIncome) * 100 : 0;

  return {
    monthId,
    monthName,
    startBalance,
    plannedExpenses,
    actualExpenses,
    expenseDiff,
    plannedIncome,
    actualIncome,
    incomeDiff,
    savedThisMonth,
    endBalance,
    savingsRate,
    expenseCategoryTotals,
    incomeCategoryTotals,
    weeklyTotals,
  };
}

/**
 * Calculates matrix breakdown of expenses by week and category
 */
export function calculateWeeklyMatrix(
  monthId: string,
  transactions: Transaction[],
  categories: string[]
) {
  const monthTransactions = transactions.filter(
    (t) => t.monthId === monthId && t.type === 'expense'
  );

  const matrix: Record<string, { week1: number; week2: number; week3: number; week4: number; week5: number; total: number }> = {};

  for (const cat of categories) {
    matrix[cat] = { week1: 0, week2: 0, week3: 0, week4: 0, week5: 0, total: 0 };
  }

  for (const t of monthTransactions) {
    if (!matrix[t.category]) {
      matrix[t.category] = { week1: 0, week2: 0, week3: 0, week4: 0, week5: 0, total: 0 };
    }
    const week = t.weekNumber || calculateWeekNumber(t.date);
    const amt = Number(t.amount) || 0;
    if (week === 1) matrix[t.category].week1 += amt;
    else if (week === 2) matrix[t.category].week2 += amt;
    else if (week === 3) matrix[t.category].week3 += amt;
    else if (week === 4) matrix[t.category].week4 += amt;
    else matrix[t.category].week5 += amt;

    matrix[t.category].total += amt;
  }

  return matrix;
}

/**
 * Parse a raw date string and align it with the target defaultMonthId (YYYY-MM)
 */
export function normalizeImportedDate(rawDate: string, defaultMonthId: string): string {
  const cleanMonth = /^\d{4}-\d{2}$/.test(defaultMonthId)
    ? defaultMonthId
    : formatLocalYYYYMMDD().slice(0, 7);

  if (!rawDate || !rawDate.trim()) {
    return `${cleanMonth}-01`;
  }

  let day = 1;
  const flexParsed = parseFlexibleDate(rawDate);
  if (flexParsed) {
    day = parseInt(flexParsed.split('-')[2] || '1', 10);
  } else {
    const trimmed = rawDate.trim();
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (dmyMatch) {
      const first = parseInt(dmyMatch[1], 10);
      const second = parseInt(dmyMatch[2], 10);
      day = second > 12 ? second : first;
    }
  }

  const [yr, mo] = cleanMonth.split('-').map(Number);
  const maxDaysInTargetMonth = new Date(yr || 2026, mo || 1, 0).getDate();
  const clampedDay = Math.min(Math.max(1, day || 1), maxDaysInTargetMonth);
  return `${cleanMonth}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Generates sample CSV content for a given YYYY-MM month code
 */
export function generateSampleCSVContent(monthId: string = '2026-11'): string {
  const cleanMonth = /^\d{4}-\d{2}$/.test(monthId) ? monthId : '2026-11';
  return [
    'Date,Category,Description,Amount,Type',
    `${cleanMonth}-01,Paycheck,Monthly Salary,250000,Income`,
    `${cleanMonth}-03,Food,Weekly Groceries,1250,Expense`,
    `${cleanMonth}-07,Transportation,Metro & Fuel,850,Expense`,
    `${cleanMonth}-12,Bills and Debt,Electricity & Internet,3400,Expense`,
  ].join('\n');
}

/**
 * RFC 4180 compliant CSV state-machine parser.
 * - Only double quotes (`"`) act as quote delimiters; apostrophes (`'`) are preserved as normal characters.
 * - Supports escaped double quotes (`""` -> `"`).
 * - Supports commas and newlines (`\n`, `\r\n`) inside quoted fields.
 * - Strips leading UTF-8 BOM (`\uFEFF`).
 */
export function parseCSVRows(csvText: string): string[][] {
  const text = (csvText || '').replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // Escaped double quote ""
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Parse CSV text into Transaction objects assigned to defaultMonthId
 */
export function parseCSVTransactions(csvText: string, defaultMonthId: string): Partial<Transaction>[] {
  const rows = parseCSVRows(csvText);
  if (rows.length === 0) return [];

  const targetMonthId = /^\d{4}-\d{2}$/.test(defaultMonthId)
    ? defaultMonthId
    : formatLocalYYYYMMDD().slice(0, 7);

  // Inspect headers using parsed row 0
  const headers = rows[0].map((h) => h.trim().toLowerCase());

  const dateIdx = headers.findIndex((h) => h.includes('date') || h === 'day');
  const categoryIdx = headers.findIndex((h) => h.includes('cat'));
  const descIdx = headers.findIndex(
    (h) =>
      h.includes('desc') ||
      h.includes('item') ||
      h.includes('detail') ||
      h.includes('note') ||
      h.includes('particular') ||
      h.includes('narration') ||
      h.includes('name')
  );
  const amountIdx = headers.findIndex(
    (h) =>
      h.includes('amt') ||
      h.includes('amount') ||
      h.includes('cost') ||
      h.includes('price') ||
      h.includes('value') ||
      h.includes('spend') ||
      h.includes('debit')
  );
  const typeIdx = headers.findIndex((h) => h.includes('type'));

  // Determine if row 0 is a header row or data row
  const hasRecognizedHeader = dateIdx >= 0 || categoryIdx >= 0 || amountIdx >= 0 || descIdx >= 0;
  const startIdx = hasRecognizedHeader ? 1 : 0;

  const result: Partial<Transaction>[] = [];

  for (let i = startIdx; i < rows.length; i++) {
    const rawRow = rows[i];
    if (!rawRow || rawRow.length === 0 || rawRow.every((c) => !c.trim())) continue;

    // Pad short rows safely so column indices never access undefined or shift
    const getCell = (idx: number): string =>
      idx >= 0 && idx < rawRow.length ? rawRow[idx].trim() : '';

    const rawDate = dateIdx >= 0 ? getCell(dateIdx) : !hasRecognizedHeader ? getCell(0) : '';
    const rawCat =
      (categoryIdx >= 0 ? getCell(categoryIdx) : !hasRecognizedHeader ? getCell(1) : '') || 'Other';
    const rawDesc =
      (descIdx >= 0 ? getCell(descIdx) : !hasRecognizedHeader ? getCell(2) : '') ||
      rawCat ||
      'Imported transaction';
    const rawAmt =
      amountIdx >= 0
        ? getCell(amountIdx)
        : !hasRecognizedHeader
        ? getCell(3) || getCell(2)
        : '0';
    const rawType = typeIdx >= 0 ? getCell(typeIdx).toLowerCase() : '';

    // Clean amount (strip currency symbols and commas, support negative numbers as positive magnitudes)
    const numericAmt = Math.abs(parseFloat((rawAmt || '0').replace(/[^0-9.-]/g, '')) || 0);
    if (numericAmt <= 0) continue;

    // Normalize date into the selected targetMonthId (YYYY-MM-DD)
    const normalizedDate = normalizeImportedDate(rawDate, targetMonthId);
    const isIncome =
      rawType.includes('income') ||
      rawType.includes('credit') ||
      rawCat.toLowerCase().includes('paycheck') ||
      rawCat.toLowerCase().includes('salary');

    result.push({
      date: normalizedDate,
      category: rawCat || 'Other',
      description: rawDesc || rawCat || 'Imported item',
      amount: numericAmt,
      type: isIncome ? 'income' : 'expense',
      weekNumber: calculateWeekNumber(normalizedDate),
      monthId: targetMonthId,
    });
  }

  return result;
}

/**
 * Generates a unique normalized signature for duplicate detection based on Date, Category, and Description
 */
export function getTransactionSignature(item: {
  date?: string;
  category?: string;
  description?: string;
}): string {
  const datePart = (item.date || '').trim();
  const categoryPart = (item.category || '').trim().toLowerCase();
  const descPart = (item.description || '').trim().toLowerCase();
  return `${datePart}|${categoryPart}|${descPart}`;
}

/**
 * Filters out duplicate transactions that match the same (Date, Category, Description)
 * either against existing transactions in the target month or within the incoming list itself.
 */
export function filterDuplicateTransactions<
  T extends { date?: string; category?: string; description?: string }
>(
  incoming: T[],
  existingMonthTransactions: { date?: string; category?: string; description?: string }[] = []
): { unique: T[]; duplicateCount: number } {
  const seenSignatures = new Set<string>(
    existingMonthTransactions.map((t) => getTransactionSignature(t))
  );

  const unique: T[] = [];
  let duplicateCount = 0;

  for (const item of incoming) {
    const sig = getTransactionSignature(item);
    if (seenSignatures.has(sig)) {
      duplicateCount += 1;
    } else {
      seenSignatures.add(sig);
      unique.push(item);
    }
  }

  return { unique, duplicateCount };
}

/**
 * Escapes a single CSV field if it contains commas, quotes, or newlines
 */
function escapeCSVField(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports transactions for a given month into a clean CSV string matching the import format:
 * Date,Category,Description,Amount,Type
 */
export function exportTransactionsToCSV(
  transactions: Transaction[],
  monthId?: string
): string {
  const filtered = monthId
    ? transactions.filter((t) => t.monthId === monthId)
    : [...transactions];

  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));

  const header = 'Date,Category,Description,Amount,Type';
  const rows = sorted.map((t) => {
    const typeLabel = t.type === 'income' ? 'Income' : 'Expense';
    return [
      escapeCSVField(t.date),
      escapeCSVField(t.category),
      escapeCSVField(t.description),
      escapeCSVField(t.amount),
      escapeCSVField(typeLabel),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}


