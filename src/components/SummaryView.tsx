import React from 'react';
import { MonthlySummary, MonthlyBudget } from '../types';
import { formatINR } from '../utils/expenseCalculations';
import { ArrowRight } from 'lucide-react';

interface SummaryViewProps {
  summary: MonthlySummary;
  budget: MonthlyBudget;
  onOpenAddModal?: (type?: 'expense' | 'income', defaultCategory?: string) => void;
  onNavigateToTab: (tab: string) => void;
  onOpenSyncModal?: () => void;
  isDark?: boolean;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  summary,
  onNavigateToTab,
  isDark = false,
}) => {
  const expensePercentage =
    summary.plannedExpenses > 0
      ? Math.min(100, (summary.actualExpenses / summary.plannedExpenses) * 100)
      : 0;

  // Surface classes based on theme
  const surfaceClass = isDark
    ? 'bg-[#121214] border-[#262626] text-zinc-100'
    : 'bg-white border-[#E5E5E5] text-zinc-900';

  const subtleSurfaceClass = isDark
    ? 'bg-[#18181B] border-[#262626]'
    : 'bg-[#F4F4F5] border-[#E5E5E5]';

  const textMuted = isDark ? 'text-zinc-400' : 'text-zinc-500';
  const textSubtle = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const borderClass = isDark ? 'border-[#262626] divide-[#262626]' : 'border-[#E5E5E5] divide-[#E5E5E5]';
  const rowHover = isDark ? 'hover:bg-[#18181B]/60' : 'hover:bg-zinc-50/80';

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Net Saved Hero Card (Full Width, Read-Only) */}
      <div className={`border rounded-lg p-5 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6 ${surfaceClass}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>
              Net Savings &bull; {summary.monthName}
            </span>
            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${subtleSurfaceClass} ${textMuted}`}>
              {summary.savingsRate.toFixed(1)}% Saved
            </span>
          </div>

          <p className="text-3xl sm:text-5xl font-light tracking-tight tabular-nums">
            {formatINR(summary.savedThisMonth)}
          </p>
          <p className={`text-xs sm:text-sm mt-2 ${textMuted}`}>
            Retained from total realized income of {formatINR(summary.actualIncome)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateToTab('dashboard')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium border ${borderClass} ${subtleSurfaceClass} ${textMuted} hover:text-inherit transition-colors cursor-pointer self-start sm:self-end shrink-0`}
        >
          Graphical View
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Planned vs Actual Structural Overview */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {/* Expenses Meter Card */}
        <div className={`border rounded-lg p-5 sm:p-6 ${surfaceClass}`}>
          <div className="flex items-center justify-between mb-4 gap-2">
            <div>
              <p className="text-sm font-medium">Expenses Overview</p>
              <p className={`text-xs ${textMuted}`}>
                {expensePercentage.toFixed(1)}% of planned budget spent
              </p>
            </div>
            <span className={`text-xs font-mono ${textMuted} shrink-0`}>
              Limit: {formatINR(summary.plannedExpenses)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono my-3">
            <div>
              <span className={`block text-[11px] uppercase tracking-wider ${textSubtle}`}>Actual</span>
              <span className="text-base sm:text-lg font-medium tabular-nums">
                {formatINR(summary.actualExpenses)}
              </span>
            </div>
            <div className="text-right">
              <span className={`block text-[11px] uppercase tracking-wider ${textSubtle}`}>Remaining</span>
              <span className={`text-base sm:text-lg font-medium tabular-nums ${textMuted}`}>
                {formatINR(summary.expenseDiff)}
              </span>
            </div>
          </div>

          {/* Minimal 4px hairline progress track */}
          <div className={`h-1.5 w-full rounded-sm overflow-hidden ${subtleSurfaceClass}`}>
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${Math.min(100, expensePercentage)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Read-Only Financial Ledger */}
      <div className="grid grid-cols-1 gap-6">
        {/* Expense Category Ledger */}
        <div className={`border rounded-lg overflow-hidden ${surfaceClass}`}>
          <div className={`px-4 sm:px-6 py-4 border-b ${borderClass}`}>
            <h3 className="text-sm font-medium tracking-tight">
              Expense Categories
            </h3>
            <p className={`text-xs ${textMuted}`}>
              Planned vs. actual spending breakdown
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${borderClass} ${subtleSurfaceClass} ${textMuted} font-medium tracking-wider uppercase text-[10px]`}>
                  <th className="py-2.5 px-4 sm:px-6">Category</th>
                  <th className="py-2.5 px-3 sm:px-4 text-right">Planned</th>
                  <th className="py-2.5 px-3 sm:px-4 text-right">Actual</th>
                  <th className="py-2.5 px-4 sm:px-6 text-right">Diff</th>
                </tr>
                {/* Totals Row */}
                <tr className={`border-b ${borderClass} font-semibold tabular-nums`}>
                  <td className="py-3 px-4 sm:px-6">Total</td>
                  <td className={`py-3 px-3 sm:px-4 text-right font-mono ${textMuted}`}>
                    {formatINR(summary.plannedExpenses)}
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-right font-mono">
                    {formatINR(summary.actualExpenses)}
                  </td>
                  <td className={`py-3 px-4 sm:px-6 text-right font-mono ${textMuted}`}>
                    {formatINR(summary.expenseDiff)}
                  </td>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderClass} font-normal tabular-nums`}>
                {summary.expenseCategoryTotals.map((item) => {
                  const percentUsed =
                    item.planned > 0
                      ? Math.min(100, (item.actual / item.planned) * 100)
                      : item.actual > 0
                      ? 100
                      : 0;

                  return (
                    <tr
                      key={item.category}
                      className={`${rowHover} transition-colors`}
                    >
                      <td className="py-2.5 px-4 sm:px-6 font-medium flex items-center justify-between gap-2">
                        <span className="truncate">{item.category}</span>
                        {item.actual > 0 && (
                          <span className={`text-[10px] ${textSubtle} font-mono shrink-0`}>
                            {percentUsed.toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className={`py-2.5 px-3 sm:px-4 text-right font-mono ${textMuted}`}>
                        {formatINR(item.planned)}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right font-mono font-medium">
                        {formatINR(item.actual)}
                      </td>
                      <td className={`py-2.5 px-4 sm:px-6 text-right font-mono ${item.diff < 0 ? 'text-amber-500 font-medium' : textMuted}`}>
                        {formatINR(item.diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
