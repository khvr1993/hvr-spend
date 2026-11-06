import React, { useState } from 'react';
import { MonthlySummary, Transaction } from '../types';
import { formatINR, calculateBurnRateStats } from '../utils/expenseCalculations';

interface GraphicalDashboardViewProps {
  summary: MonthlySummary;
  transactions: Transaction[];
  allMonthsSummaries: MonthlySummary[];
  onSelectMonth: (monthId: string) => void;
  onOpenAddModal: (type?: 'expense' | 'income') => void;
  isDark?: boolean;
}

// Sophisticated monochromatic tonal palette with single accent highlight
const TONAL_GRAYS = [
  '#F59E0B', // Muted accent for top category
  '#E4E4E7', // Zinc 200
  '#D4D4D8', // Zinc 300
  '#A1A1AA', // Zinc 400
  '#71717A', // Zinc 500
  '#52525B', // Zinc 600
  '#3F3F46', // Zinc 700
  '#27272A', // Zinc 800
];

export const GraphicalDashboardView: React.FC<GraphicalDashboardViewProps> = ({
  summary,
  allMonthsSummaries,
  onSelectMonth,
  onOpenAddModal,
  isDark = true,
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'weekly' | 'history'>('weekly');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Surface classes
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

  const activeExpenseCategories = summary.expenseCategoryTotals.filter(
    (c) => c.actual > 0 || c.planned > 0
  );

  const categoriesWithSpend = summary.expenseCategoryTotals
    .filter((c) => c.actual > 0)
    .sort((a, b) => b.actual - a.actual);

  // Calculate refined monochromatic donut slices
  const totalActual = summary.actualExpenses || 1;
  let accumulatedAngle = 0;
  const donutSlices = categoriesWithSpend.map((c, idx) => {
    const fraction = c.actual / totalActual;
    const startAngle = accumulatedAngle;
    accumulatedAngle += fraction * 360;
    const endAngle = accumulatedAngle;
    const color = TONAL_GRAYS[idx % TONAL_GRAYS.length];
    return {
      category: c.category,
      amount: c.actual,
      percentage: (fraction * 100).toFixed(1),
      startAngle,
      endAngle,
      color,
    };
  });

  // Month-aware burn rate stats (uses active month's real calendar days and past/current/future status)
  const {
    daysInMonth,
    avgDailySpend,
    remainingBudgetPerDay,
    monthStatus,
  } = calculateBurnRateStats(
    summary.monthId,
    summary.actualExpenses,
    summary.expenseDiff
  );

  return (
    <div className="space-y-8">
      {/* 4 Structural Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={`border rounded-lg p-6 flex flex-col justify-between ${surfaceClass}`}>
          <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>
            Total Expenses
          </span>
          <div className="my-3">
            <p className="text-3xl font-light tracking-tight tabular-nums">
              {formatINR(summary.actualExpenses)}
            </p>
          </div>
          <div className={`pt-3 border-t ${borderClass} flex items-center justify-between text-xs font-mono`}>
            <span className={textSubtle}>Budget Used:</span>
            <span className={textMuted}>
              {summary.plannedExpenses > 0
                ? ((summary.actualExpenses / summary.plannedExpenses) * 100).toFixed(1)
                : '0'}%
            </span>
          </div>
        </div>

        <div className={`border rounded-lg p-6 flex flex-col justify-between ${surfaceClass}`}>
          <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>
            Total Income
          </span>
          <div className="my-3">
            <p className="text-3xl font-light tracking-tight tabular-nums">
              {formatINR(summary.actualIncome)}
            </p>
          </div>
          <div className={`pt-3 border-t ${borderClass} flex items-center justify-between text-xs font-mono`}>
            <span className={textSubtle}>Realized:</span>
            <span className={textMuted}>
              {summary.plannedIncome > 0
                ? ((summary.actualIncome / summary.plannedIncome) * 100).toFixed(1)
                : '100'}%
            </span>
          </div>
        </div>

        <div className={`border rounded-lg p-6 flex flex-col justify-between ${surfaceClass}`}>
          <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>
            Net Saved
          </span>
          <div className="my-3">
            <p className="text-3xl font-light tracking-tight tabular-nums text-amber-500">
              {formatINR(summary.savedThisMonth)}
            </p>
          </div>
          <div className={`pt-3 border-t ${borderClass} flex items-center justify-between text-xs font-mono`}>
            <span className={textSubtle}>Savings Rate:</span>
            <span className="text-amber-500 font-medium">
              {summary.savingsRate.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className={`border rounded-lg p-6 flex flex-col justify-between ${surfaceClass}`}>
          <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>
            Daily Run-Rate
          </span>
          <div className="my-3">
            <p className="text-3xl font-light tracking-tight tabular-nums">
              {formatINR(avgDailySpend, false)}
              <span className={`text-xs font-normal ${textSubtle}`}> / day</span>
            </p>
          </div>
          <div className={`pt-3 border-t ${borderClass} flex items-center justify-between text-xs font-mono`}>
            {monthStatus === 'past' ? (
              <>
                <span className={textSubtle}>Period:</span>
                <span className={textMuted}>Completed ({daysInMonth}d)</span>
              </>
            ) : (
              <>
                <span className={textSubtle}>Daily Allowance:</span>
                <span className={textMuted}>
                  {formatINR(remainingBudgetPerDay, false)} / day
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Analytical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Category Planned vs Actual Bar Chart (7 Cols) */}
        <div className={`lg:col-span-7 border rounded-lg p-8 flex flex-col justify-between ${surfaceClass}`}>
          <div>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b ${borderClass}`}>
              <div>
                <h3 className="text-base font-medium tracking-tight">
                  Budget Allocations
                </h3>
                <p className={`text-xs ${textMuted} mt-0.5`}>
                  Comparison of planned thresholds against actual expenditure
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <span className={`flex items-center gap-1.5 ${textMuted}`}>
                  <span className={`w-2.5 h-2.5 rounded-xs ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`}></span>
                  Planned
                </span>
                <span className={`flex items-center gap-1.5 font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                  <span className={`w-2.5 h-2.5 rounded-xs ${isDark ? 'bg-zinc-100' : 'bg-zinc-900'}`}></span>
                  Actual
                </span>
              </div>
            </div>

            {/* Horizontal comparison bars */}
            <div className="space-y-4 my-6">
              {activeExpenseCategories.map((cat, idx) => {
                const maxVal = Math.max(cat.planned, cat.actual, 1000);
                const plannedWidth = Math.min(100, (cat.planned / maxVal) * 100);
                const actualWidth = Math.min(100, (cat.actual / maxVal) * 100);
                const isHovered = hoveredCategory === cat.category;

                return (
                  <div
                    key={cat.category}
                    className={`p-2.5 rounded-md transition-colors ${
                      isHovered ? subtleSurfaceClass : ''
                    }`}
                    onMouseEnter={() => setHoveredCategory(cat.category)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
                      <span className="font-sans font-medium text-inherit">
                        {cat.category}
                      </span>
                      <div className="space-x-3 text-[11px] tabular-nums">
                        <span className={textMuted}>
                          Target: {formatINR(cat.planned)}
                        </span>
                        <span className="font-medium text-inherit">
                          Actual: {formatINR(cat.actual)}
                        </span>
                        <span className={cat.diff < 0 ? 'text-amber-500 font-medium' : textSubtle}>
                          ({cat.diff >= 0 ? '+' : ''}{formatINR(cat.diff)})
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {/* Planned hairline track */}
                      <div className={`h-1.5 w-full rounded-xs overflow-hidden ${isDark ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
                        <div
                          className={`h-full rounded-xs transition-all duration-500 ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`}
                          style={{ width: `${plannedWidth}%` }}
                        ></div>
                      </div>
                      {/* Actual track */}
                      <div className={`h-1.5 w-full rounded-xs overflow-hidden ${isDark ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
                        <div
                          className="h-full rounded-xs transition-all duration-500"
                          style={{
                            width: `${actualWidth}%`,
                            backgroundColor: idx === 0 ? '#F59E0B' : (isDark ? '#E4E4E7' : '#27272A'),
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`pt-4 border-t ${borderClass} flex items-center justify-between text-xs`}>
            <span className={textSubtle}>
              Tabular breakdown available in Summary ledger
            </span>
            <button
              onClick={() => onOpenAddModal('expense')}
              className={`font-medium ${textMuted} hover:text-inherit flex items-center gap-1 cursor-pointer transition-colors`}
            >
              + Add Transaction
            </button>
          </div>
        </div>

        {/* Monochromatic Spending Share Donut (5 Cols) */}
        <div className={`lg:col-span-5 border rounded-lg p-8 flex flex-col justify-between ${surfaceClass}`}>
          <div>
            <div className={`pb-6 border-b ${borderClass}`}>
              <h3 className="text-base font-medium tracking-tight">
                Expenditure Distribution
              </h3>
              <p className={`text-xs ${textMuted} mt-0.5`}>
                Proportional category weight of current month
              </p>
            </div>

            {/* Donut SVG Ring */}
            <div className="my-8 flex items-center justify-center">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    className={isDark ? 'stroke-zinc-800' : 'stroke-zinc-200'}
                    strokeWidth="12"
                    fill="transparent"
                  />
                  {donutSlices.map((slice) => {
                    const strokeDash = `${(slice.endAngle - slice.startAngle) * (Math.PI * 76 / 360)} ${Math.PI * 76}`;
                    const strokeOffset = `-${(slice.startAngle * (Math.PI * 76)) / 360}`;
                    const isHovered = hoveredCategory === slice.category;

                    return (
                      <circle
                        key={slice.category}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth={isHovered ? 16 : 12}
                        strokeDasharray={strokeDash}
                        strokeDashoffset={strokeOffset}
                        className="transition-all duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredCategory(slice.category)}
                        onMouseLeave={() => setHoveredCategory(null)}
                      />
                    );
                  })}
                </svg>

                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className={`text-[10px] font-mono uppercase tracking-wider ${textSubtle}`}>
                    {hoveredCategory || 'Total Spent'}
                  </span>
                  <span className="text-xl font-light tracking-tight tabular-nums mt-0.5">
                    {hoveredCategory
                      ? formatINR(
                          summary.expenseCategoryTotals.find(
                            (c) => c.category === hoveredCategory
                          )?.actual || 0
                        )
                      : formatINR(summary.actualExpenses)}
                  </span>
                  {hoveredCategory && (
                    <span className="text-[10px] font-mono text-amber-500 mt-0.5">
                      {(
                        ((summary.expenseCategoryTotals.find(
                          (c) => c.category === hoveredCategory
                        )?.actual || 0) /
                          totalActual) *
                        100
                      ).toFixed(1)}% of total
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quiet Monochromatic Legend */}
            <div className={`space-y-1.5 max-h-44 overflow-y-auto pr-1 text-xs font-mono`}>
              {donutSlices.map((slice) => (
                <div
                  key={slice.category}
                  className={`flex items-center justify-between py-1 px-2.5 rounded transition-colors cursor-pointer ${
                    hoveredCategory === slice.category ? subtleSurfaceClass : 'hover:bg-zinc-800/20'
                  }`}
                  onMouseEnter={() => setHoveredCategory(slice.category)}
                  onMouseLeave={() => setHoveredCategory(null)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: slice.color }}
                    ></span>
                    <span className="font-sans text-inherit truncate max-w-[130px]">
                      {slice.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="font-medium text-inherit">{formatINR(slice.amount)}</span>
                    <span className={`text-[11px] ${textSubtle} w-10 text-right`}>
                      {slice.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Pacing & Multi-Month Trends */}
      <div className={`border rounded-lg p-8 ${surfaceClass}`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b ${borderClass}`}>
          <div>
            <h3 className="text-base font-medium tracking-tight">
              Pacing & Historical Trends
            </h3>
            <p className={`text-xs ${textMuted} mt-0.5`}>
              Weekly trajectory and historical monthly performance
            </p>
          </div>

          <div className={`flex items-center p-0.5 rounded-md border ${borderClass} ${subtleSurfaceClass} text-xs font-medium`}>
            <button
              onClick={() => setActiveChartTab('weekly')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                activeChartTab === 'weekly'
                  ? isDark ? 'bg-zinc-800 text-zinc-100 shadow-2xs' : 'bg-white text-zinc-900 shadow-2xs'
                  : textMuted
              }`}
            >
              Weekly Pacing
            </button>
            <button
              onClick={() => setActiveChartTab('history')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                activeChartTab === 'history'
                  ? isDark ? 'bg-zinc-800 text-zinc-100 shadow-2xs' : 'bg-white text-zinc-900 shadow-2xs'
                  : textMuted
              }`}
            >
              Multi-Month History
            </button>
          </div>
        </div>

        {activeChartTab === 'weekly' ? (
          <div className="pt-8">
            <div className="grid grid-cols-5 gap-4 text-center">
              {[
                { label: 'Week 1 (1–7)', amount: summary.weeklyTotals.week1 },
                { label: 'Week 2 (8–14)', amount: summary.weeklyTotals.week2 },
                { label: 'Week 3 (15–21)', amount: summary.weeklyTotals.week3 },
                { label: 'Week 4 (22–28)', amount: summary.weeklyTotals.week4 },
                { label: 'Week 5 (29–31)', amount: summary.weeklyTotals.week5 },
              ].map((w) => {
                const maxWeek = Math.max(
                  summary.weeklyTotals.week1,
                  summary.weeklyTotals.week2,
                  summary.weeklyTotals.week3,
                  summary.weeklyTotals.week4,
                  summary.weeklyTotals.week5,
                  1000
                );
                const heightPercent = Math.max(6, (w.amount / maxWeek) * 100);

                return (
                  <div key={w.label} className="flex flex-col items-center">
                    <div className={`w-full h-36 rounded-md flex items-end justify-center p-2 border ${borderClass} ${subtleSurfaceClass}`}>
                      <div
                        className={`w-8 rounded-xs transition-all duration-500 ${
                          w.amount > 0 ? (isDark ? 'bg-zinc-300' : 'bg-zinc-700') : 'bg-transparent'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs font-medium mt-3 ${textMuted}`}>{w.label}</span>
                    <span className="text-xs font-mono font-medium mt-1 tabular-nums">
                      {formatINR(w.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="pt-6 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${borderClass} ${subtleSurfaceClass} ${textMuted} font-medium tracking-wider uppercase text-[10px]`}>
                  <th className="py-2.5 px-6">Month</th>
                  <th className="py-2.5 px-4 text-right">Income</th>
                  <th className="py-2.5 px-4 text-right">Expenses</th>
                  <th className="py-2.5 px-4 text-right">Net Saved</th>
                  <th className="py-2.5 px-4 text-right">Rate</th>
                  <th className="py-2.5 px-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderClass} font-normal tabular-nums`}>
                {allMonthsSummaries.map((m) => (
                  <tr
                    key={m.monthId}
                    className={`${rowHover} transition-colors ${
                      m.monthId === summary.monthId ? subtleSurfaceClass : ''
                    }`}
                  >
                    <td className="py-3 px-6 font-medium flex items-center gap-2">
                      <span>{m.monthName}</span>
                      {m.monthId === summary.monthId && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-amber-500/30 text-amber-500">
                          Active
                        </span>
                      )}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono ${textMuted}`}>
                      {formatINR(m.actualIncome)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium">
                      {formatINR(m.actualExpenses)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-amber-500">
                      {formatINR(m.savedThisMonth)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium">
                      {m.savingsRate.toFixed(1)}%
                    </td>
                    <td className="py-3 px-6 text-center">
                      {m.monthId !== summary.monthId ? (
                        <button
                          onClick={() => onSelectMonth(m.monthId)}
                          className={`text-xs font-mono font-medium px-2.5 py-1 rounded border ${borderClass} ${subtleSurfaceClass} hover:opacity-80 transition-opacity cursor-pointer`}
                        >
                          View
                        </button>
                      ) : (
                        <span className={`text-xs font-mono ${textSubtle}`}>Viewing</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
