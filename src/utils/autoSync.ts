import { MonthlyBudget, MonthlySummary, Transaction } from '../types';
import { isDailySyncDue } from './expenseCalculations';

export interface AutoSyncDependencies {
  dailyAutoSync: boolean;
  accessToken: string | null;
  todayStr: string;
  monthId: string;
  summary: MonthlySummary;
  transactions: Transaction[];
  budget: MonthlyBudget;
  syncFn: (
    accessToken: string,
    summary: MonthlySummary,
    transactions: Transaction[],
    budget: MonthlyBudget,
    existingSpreadsheetId?: string
  ) => Promise<{ id: string; url: string; title: string; isUpdated: boolean }>;
  onSyncStart?: () => void;
  onSyncSuccess: (monthId: string, driveFileId: string, syncedAt: number) => void;
  onSyncError?: (errorMessage: string) => void;
  onSyncSettled?: () => void;
  nowFn?: () => number;
  cooldownMs?: number;
}

/**
 * Creates a stateful auto-sync controller whose in-flight and cooldown state
 * lives outside React state dependencies, preventing useEffect self-cancellation.
 */
export function createAutoSyncController() {
  let inFlight = false;
  let lastAttemptAt = 0;

  async function runIfDue(deps: AutoSyncDependencies): Promise<boolean> {
    const now = deps.nowFn ? deps.nowFn() : Date.now();
    const cooldown = deps.cooldownMs ?? 5 * 60 * 1000;

    if (!deps.dailyAutoSync || !deps.accessToken || inFlight) {
      return false;
    }

    if (!isDailySyncDue(deps.budget.lastSyncedAt, deps.todayStr)) {
      return false;
    }

    if (lastAttemptAt > 0 && now - lastAttemptAt < cooldown) {
      return false;
    }

    inFlight = true;
    lastAttemptAt = now;
    deps.onSyncStart?.();

    try {
      const res = await deps.syncFn(
        deps.accessToken,
        deps.summary,
        deps.transactions,
        deps.budget,
        deps.budget.driveFileId
      );
      const completedAt = deps.nowFn ? deps.nowFn() : Date.now();
      deps.onSyncSuccess(deps.monthId, res.id, completedAt);
      return true;
    } catch (err: any) {
      deps.onSyncError?.(err?.message || 'Daily auto-sync failed');
      return false;
    } finally {
      inFlight = false;
      deps.onSyncSettled?.();
    }
  }

  return {
    runIfDue,
    isInFlight: () => inFlight,
    resetCooldown: () => {
      lastAttemptAt = 0;
    },
  };
}
