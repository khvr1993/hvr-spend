import { Transaction, MonthlyBudget } from '../types';
import { formatMonthIdToName } from '../utils/expenseCalculations';

export const INITIAL_MONTH_ID = new Date().toISOString().slice(0, 7);
export const INITIAL_MONTH_NAME = formatMonthIdToName(INITIAL_MONTH_ID);

export const INITIAL_EXPENSE_BUDGETS_NOV: Record<string, number> = {
  Food: 8000,
  Shopping: 10000,
  'Health/medical': 5000,
  Home: 15000,
  Transportation: 15000,
  'Guilt free': 7000,
  'Entertainment & Leisure': 3000,
  'Bills and Debt': 20000,
  Waste: 2000,
  Unplanned: 10000,
  Splurge: 5000,
};

export const INITIAL_INCOME_BUDGETS_NOV: Record<string, number> = {
  Savings: 0,
  Paycheck: 250000,
  Bonus: 0,
  Interest: 0,
  Other: 0,
  'Custom category': 0,
};

// Clean, fresh initial transactions (no dummy entries)
export const INITIAL_TRANSACTIONS_NOV: Transaction[] = [];

export const INITIAL_MONTH_OCT: MonthlyBudget = {
  monthId: '2026-10',
  monthName: 'Oct-26 Expenses',
  startBalance: 0,
  expenseBudgets: { ...INITIAL_EXPENSE_BUDGETS_NOV },
  incomeBudgets: { ...INITIAL_INCOME_BUDGETS_NOV },
};

export const INITIAL_TRANSACTIONS_OCT: Transaction[] = [];
