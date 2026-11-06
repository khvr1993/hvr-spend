import React from 'react';
import { MonthlySummary, MonthlyBudget } from '../types';
import { formatINR } from '../utils/expenseCalculations';
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  Lock,
} from 'lucide-react';

interface SummaryViewProps {
  summary: MonthlySummary;
  budget: MonthlyBudget;
  onOpenAddModal: (type?: 'expense' | 'income', defaultCategory?: string) => void;
  onNavigateToTab: (tab: string) => void;
  onOpenSyncModal: () => void;
  isDark?: boolean;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  summary,
  budget,
  onOpenAddModal,
  onNavigateToTab,
  onOpenSyncModal,
  isDark = true,
}) => {
  const expensePercentage =
    summary.plannedExpenses > 0
      ? Math.min(100, (summary.actualExpenses / summary.plannedExpenses) * 100)
      : 0;

  const incomePercentage =
    summary.plannedIncome > 0
      ? Math.min(100, (summary.actualIncome / summary.plannedIncome) * 100)
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
  const borderClass = isDark ? 'border-[#262626]' : 'border-[#E5E5E5]';
  const rowHover = isDark ? 'hover:bg-[#18181B]' : 'hover:bg-zinc-50';

  return (
    <div className="space-y-8">
      {/* Hero Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Net Saved Hero Card (7 Cols) */}
        <div className={`lg:col-span-7 border rounded-lg p-8 flex flex-col justify-between ${surfaceClass}`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>
                Net Savings &bull; {summary.monthName}
              </span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${subtleSurfaceClass} ${textMuted}`}>
                {summary.savingsRate.toFixed(1)}% Saved
              </span>
            </div>

            <div className="mt-2">
              <p className="text-4xl sm:text-5xl font-light tracking-tight tabular-nums">
                {formatINR(summary.savedThisMonth)}
              </p>
              <p className={`text-sm mt-2 ${textMuted}`}>
                Retained from total realized income of {formatINR(summary.actualIncome)}
              </p>
            </div>
          </div>

          <div className={`mt-8 pt-6 border-t ${borderClass} flex flex-wrap items-center gap-3`}>
            <button
              onClick={() => onOpenAddModal('expense')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              New Expense
            </button>
            <button
              onClick={() => onOpenAddModal('income')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border ${borderClass} ${subtleSurfaceClass} hover:opacity-90 transition-opacity cursor-pointer`}
            >
              <Plus className="w-3.5 h-3.5" />
              New Income
            </button>
            <button
              onClick={() => onNavigateToTab('dashboard')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium ${textMuted} hover:text-inherit ml-auto transition-colors cursor-pointer`}
            >
              Graphical View
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Start / End Balance Structural Card (5 Cols) */}
        <div className={`lg:col-span-5 border rounded-lg p-8 flex flex-col justify-between ${surfaceClass}`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className={`text-xs font-medium uppercase tracking-wider ${textMuted} flex items-center gap-1.5`}>
                <Lock className="w-3 h-3 text-zinc-400" />
                Ledger Balance
              </span>
              <span className={`text-xs font-mono ${textMuted}`}>
                Reconciliation
              </span>
            </div>

            <div className="grid grid-cols-2 gap-6 mt-4">
              <div>
                <p className={`text-xs font-medium uppercase tracking-wider ${textSubtle}`}>
                  Start Balance
                </p>
                <p className="text-2xl font-normal tracking-tight tabular-nums mt-1.5">
                  {formatINR(summary.startBalance)}
                </p>
              </div>
              <div className={`border-l ${borderClass} pl-6`}>
                <p className={`text-xs font-medium uppercase tracking-wider text-amber-500`}>
                  End Balance
                </p>
                <p className="text-2xl font-normal tracking-tight tabular-nums text-amber-500 mt-1.5">
                  {formatINR(summary.endBalance)}
                </p>
              </div>
            </div>
          </div>

          <div className={`mt-8 pt-6 border-t ${borderClass} flex items-center justify-between text-xs`}>
            <span className={textMuted}>Net Variance:</span>
            <span className="font-mono font-medium flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
              {formatINR(summary.savedThisMonth)}
            </span>
          </div>
        </div>
      </div>

      {/* Planned vs Actual Structural Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expenses Meter Card */}
        <div className={`border rounded-lg p-6 ${surfaceClass}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium">Expenses Overview</p>
              <p className={`text-xs ${textMuted}`}>
                {expensePercentage.toFixed(1)}% of planned budget spent
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              Limit: {formatINR(summary.plannedExpenses)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono my-3">
            <div>
              <span className={`block text-[11px] uppercase tracking-wider ${textSubtle}`}>Actual</span>
              <span className="text-lg font-medium tabular-nums text-zinc-100 dark:text-zinc-100">
                {formatINR(summary.actualExpenses)}
              </span>
            </div>
            <div className="text-right">
              <span className={`block text-[11px] uppercase tracking-wider ${textSubtle}`}>Remaining</span>
              <span className="text-lg font-medium tabular-nums text-zinc-300">
                {formatINR(summary.expenseDiff)}
              </span>
            </div>
          </div>

          {/* Minimal 4px hairline progress track */}
          <div className={`h-1.5 w-full rounded-sm overflow-hidden ${subtleSurfaceClass}`}>
            <div
              className="h-full bg-zinc-300 dark:bg-zinc-200 transition-all duration-500"
              style={{ width: `${Math.min(100, expensePercentage)}%` }}
            ></div>
          </div>
        </div>

        {/* Income Meter Card */}
        <div className={`border rounded-lg p-6 ${surfaceClass}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium">Income Overview</p>
              <p className={`text-xs ${textMuted}`}>
                {incomePercentage.toFixed(1)}% realized
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              Target: {formatINR(summary.plannedIncome)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono my-3">
            <div>
              <span className={`block text-[11px] uppercase tracking-wider ${textSubtle}`}>Actual</span>
              <span className="text-lg font-medium tabular-nums">
                {formatINR(summary.actualIncome)}
              </span>
            </div>
            <div className="text-right">
              <span className={`block text-[11px] uppercase tracking-wider ${textSubtle}`}>Variance</span>
              <span className="text-lg font-medium tabular-nums text-zinc-400">
                {formatINR(summary.incomeDiff)}
              </span>
            </div>
          </div>

          {/* Minimal 4px hairline progress track */}
          <div className={`h-1.5 w-full rounded-sm overflow-hidden ${subtleSurfaceClass}`}>
            <div
              className="h-full bg-zinc-400 dark:bg-zinc-300 transition-all duration-500"
              style={{ width: `${Math.min(100, incomePercentage)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Financial Ledgers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Category Ledger */}
        <div className={`border rounded-lg overflow-hidden ${surfaceClass}`}>
          <div className={`px-6 py-4 border-b ${borderClass} flex items-center justify-between`}>
            <div>
              <h3 className="text-sm font-medium tracking-tight">
                Expense Categories
              </h3>
              <p className={`text-xs ${textMuted}`}>
                Planned vs. actual spending breakdown
              </p>
            </div>
            <button
              onClick={() => onOpenAddModal('expense')}
              className={`text-xs font-medium ${textMuted} hover:text-inherit flex items-center gap-1 cursor-pointer transition-colors`}
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${borderClass} ${subtleSurfaceClass} ${textMuted} font-medium tracking-wider uppercase text-[10px]`}>
                  <th className="py-2.5 px-6">Category</th>
                  <th className="py-2.5 px-4 text-right">Planned</th>
                  <th className="py-2.5 px-4 text-right">Actual</th>
                  <th className="py-2.5 px-6 text-right">Diff</th>
                </tr>
                {/* Totals Row */}
                <tr className={`border-b ${borderClass} font-semibold tabular-nums`}>
                  <td className="py-3 px-6">Total</td>
                  <td className={`py-3 px-4 text-right font-mono ${textMuted}`}>
                    {formatINR(summary.plannedExpenses)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-100 dark:text-zinc-100">
                    {formatINR(summary.actualExpenses)}
                  </td>
                  <td className="py-3 px-6 text-right font-mono text-zinc-300">
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
                      onClick={() => onOpenAddModal('expense', item.category)}
                      className={`${rowHover} transition-colors cursor-pointer group`}
                      title={`Add expense in ${item.category}`}
                    >
                      <td className="py-2.5 px-6 font-medium flex items-center justify-between">
                        <span>{item.category}</span>
                        {item.actual > 0 && (
                          <span className={`text-[10px] ${textSubtle} font-mono opacity-0 group-hover:opacity-100 transition-opacity`}>
                            {percentUsed.toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-mono ${textMuted}`}>
                        {formatINR(item.planned)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium">
                        {formatINR(item.actual)}
                      </td>
                      <td className={`py-2.5 px-6 text-right font-mono ${item.diff < 0 ? 'text-amber-500 font-medium' : textMuted}`}>
                        {formatINR(item.diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Income Category Ledger */}
        <div className={`border rounded-lg overflow-hidden ${surfaceClass}`}>
          <div className={`px-6 py-4 border-b ${borderClass} flex items-center justify-between`}>
            <div>
              <h3 className="text-sm font-medium tracking-tight">
                Income Categories
              </h3>
              <p className={`text-xs ${textMuted}`}>
                Planned vs. realized earnings
              </p>
            </div>
            <button
              onClick={() => onOpenAddModal('income')}
              className={`text-xs font-medium ${textMuted} hover:text-inherit flex items-center gap-1 cursor-pointer transition-colors`}
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${borderClass} ${subtleSurfaceClass} ${textMuted} font-medium tracking-wider uppercase text-[10px]`}>
                  <th className="py-2.5 px-6">Category</th>
                  <th className="py-2.5 px-4 text-right">Planned</th>
                  <th className="py-2.5 px-4 text-right">Actual</th>
                  <th className="py-2.5 px-6 text-right">Diff</th>
                </tr>
                {/* Totals Row */}
                <tr className={`border-b ${borderClass} font-semibold tabular-nums`}>
                  <td className="py-3 px-6">Total</td>
                  <td className={`py-3 px-4 text-right font-mono ${textMuted}`}>
                    {formatINR(summary.plannedIncome)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-100 dark:text-zinc-100">
                    {formatINR(summary.actualIncome)}
                  </td>
                  <td className="py-3 px-6 text-right font-mono text-zinc-300">
                    {formatINR(summary.incomeDiff)}
                  </td>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderClass} font-normal tabular-nums`}>
                {summary.incomeCategoryTotals.map((item) => (
                  <tr
                    key={item.category}
                    onClick={() => onOpenAddModal('income', item.category)}
                    className={`${rowHover} transition-colors cursor-pointer`}
                    title={`Add income in ${item.category}`}
                  >
                    <td className="py-2.5 px-6 font-medium">
                      {item.category}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-mono ${textMuted}`}>
                      {formatINR(item.planned)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium">
                      {formatINR(item.actual)}
                    </td>
                    <td className={`py-2.5 px-6 text-right font-mono ${textMuted}`}>
                      {formatINR(item.diff)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
