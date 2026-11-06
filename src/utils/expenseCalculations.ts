import { Transaction, MonthlySummary, CategoryBudget } from '../types';

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
    return new Date().toISOString().slice(0, 7);
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
  const syncedDateStr = new Date(lastSyncedAt).toISOString().slice(0, 10);
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
 * Parse CSV text into Transaction objects
 */
export function parseCSVTransactions(csvText: string, defaultMonthId: string): Partial<Transaction>[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Inspect headers
  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));

  const dateIdx = headers.findIndex((h) => h.includes('date'));
  const categoryIdx = headers.findIndex((h) => h.includes('cat'));
  const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('item') || h.includes('detail') || h.includes('note'));
  const amountIdx = headers.findIndex((h) => h.includes('amt') || h.includes('amount') || h.includes('cost') || h.includes('price'));
  const typeIdx = headers.findIndex((h) => h.includes('type'));

  const result: Partial<Transaction>[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parser supporting quotes
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let c = 0; c < lines[i].length; c++) {
      const char = lines[i][c];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());

    if (row.length === 0 || row.every((c) => !c)) continue;

    const rawDate = dateIdx >= 0 ? row[dateIdx] : '';
    const rawCat = categoryIdx >= 0 ? row[categoryIdx] : 'Unplanned';
    const rawDesc = descIdx >= 0 ? row[descIdx] : 'Imported transaction';
    const rawAmt = amountIdx >= 0 ? row[amountIdx] : '0';
    const rawType = typeIdx >= 0 ? row[typeIdx]?.toLowerCase() : '';

    // Clean amount (strip currency symbols and commas)
    const cleanedAmt = parseFloat(rawAmt.replace(/[^0-9.-]/g, '')) || 0;
    if (cleanedAmt <= 0) continue;

    // Normalize date YYYY-MM-DD
    let normalizedDate = new Date().toISOString().slice(0, 10);
    if (rawDate) {
      const parsedDate = new Date(rawDate);
      if (!isNaN(parsedDate.getTime())) {
        normalizedDate = parsedDate.toISOString().slice(0, 10);
      }
    }

    const monthId = normalizedDate.slice(0, 7) || defaultMonthId;
    const isIncome = rawType.includes('income') || rawCat.toLowerCase().includes('paycheck') || rawCat.toLowerCase().includes('salary');

    result.push({
      date: normalizedDate,
      category: rawCat || 'Other',
      description: rawDesc || 'Imported item',
      amount: cleanedAmt,
      type: isIncome ? 'income' : 'expense',
      weekNumber: calculateWeekNumber(normalizedDate),
      monthId,
    });
  }

  return result;
}
