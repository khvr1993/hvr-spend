export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  monthId: string; // e.g. "2026-11"
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  weekNumber: number; // 1 to 5
  notes?: string;
  createdAt: number;
}

export interface CategoryBudget {
  category: string;
  planned: number;
  actual: number;
  diff: number;
  type: TransactionType;
}

export interface MonthlyBudget {
  monthId: string; // e.g. "2026-11"
  monthName: string; // e.g. "Nov-26"
  startBalance: number;
  expenseBudgets: Record<string, number>;
  incomeBudgets: Record<string, number>;
}

export interface MonthlySummary {
  monthId: string;
  monthName: string;
  startBalance: number;
  plannedExpenses: number;
  actualExpenses: number;
  expenseDiff: number;
  plannedIncome: number;
  actualIncome: number;
  incomeDiff: number;
  savedThisMonth: number;
  endBalance: number;
  savingsRate: number; // percentage
  expenseCategoryTotals: CategoryBudget[];
  incomeCategoryTotals: CategoryBudget[];
  weeklyTotals: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
    week5: number;
    total: number;
  };
}

export interface DriveSyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncedAt?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  spreadsheetTitle?: string;
  error?: string;
}
