import React, { useState } from 'react';
import { MonthlySummary, Transaction } from '../types';
import { calculateWeeklyMatrix, formatINR } from '../utils/expenseCalculations';

interface ExpensesByWeekViewProps {
  summary: MonthlySummary;
  transactions: Transaction[];
  onOpenAddModal: (type?: 'expense' | 'income', defaultCategory?: string) => void;
  isDark?: boolean;
}

export const ExpensesByWeekView: React.FC<ExpensesByWeekViewProps> = ({
  summary,
  transactions,
  onOpenAddModal,
  isDark = true,
}) => {
  const categories = summary.expenseCategoryTotals.map((c) => c.category);
  const matrix = calculateWeeklyMatrix(summary.monthId, transactions, categories);

  const [selectedCell, setSelectedCell] = useState<{
    category: string;
    week: number;
    amount: number;
  } | null>(null);

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

  const cellTransactions = selectedCell
    ? transactions.filter(
        (t) =>
          t.monthId === summary.monthId &&
          t.type === 'expense' &&
          t.category === selectedCell.category &&
          (t.weekNumber || 1) === selectedCell.week
      )
    : [];

  const grandTotal = summary.weeklyTotals.total || 1;

  return (
    <div className="space-y-6">
      {/* Main Weekly Accounting Ledger Table */}
      <div className={`border rounded-lg overflow-hidden ${surfaceClass}`}>
        <div className={`px-6 py-4 border-b ${borderClass} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
          <div>
            <h3 className="text-sm font-medium tracking-tight">
              Weekly Allocation Matrix
            </h3>
            <p className={`text-xs ${textMuted} mt-0.5`}>
              Weekly chronological distribution across budget categories
            </p>
          </div>
          <button
            onClick={() => onOpenAddModal('expense')}
            className={`text-xs font-medium ${textMuted} hover:text-inherit flex items-center gap-1 cursor-pointer transition-colors`}
          >
            + Add Expense
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${borderClass} ${subtleSurfaceClass} ${textMuted} font-medium tracking-wider uppercase text-[10px]`}>
                <th className="py-2.5 px-6">Category</th>
                <th className="py-2.5 px-4 text-right">W1 (1–7)</th>
                <th className="py-2.5 px-4 text-right">W2 (8–14)</th>
                <th className="py-2.5 px-4 text-right">W3 (15–21)</th>
                <th className="py-2.5 px-4 text-right">W4 (22–28)</th>
                <th className="py-2.5 px-4 text-right">W5 (29–31)</th>
                <th className="py-2.5 px-6 text-right">Total</th>
                <th className="py-2.5 px-4 text-right">% Spend</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${borderClass} font-normal tabular-nums`}>
              {categories.map((cat) => {
                const row = matrix[cat] || { week1: 0, week2: 0, week3: 0, week4: 0, week5: 0, total: 0 };
                const pct = grandTotal > 0 ? ((row.total / grandTotal) * 100).toFixed(1) : '0';

                return (
                  <tr key={cat} className={`${rowHover} transition-colors`}>
                    <td className="py-2.5 px-6 font-medium">
                      {cat}
                    </td>
                    {[1, 2, 3, 4, 5].map((wk) => {
                      const val = (row as any)[`week${wk}`] || 0;
                      const isSelected =
                        selectedCell?.category === cat && selectedCell?.week === wk;

                      return (
                        <td
                          key={wk}
                          onClick={() => {
                            if (val > 0) setSelectedCell({ category: cat, week: wk, amount: val });
                          }}
                          className={`py-2.5 px-4 text-right font-mono ${
                            val > 0
                              ? 'text-inherit font-medium cursor-pointer hover:underline'
                              : `${textSubtle}`
                          } ${isSelected ? 'bg-amber-500/10 text-amber-500 font-bold' : ''}`}
                        >
                          {val > 0 ? formatINR(val) : '—'}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-6 text-right font-mono font-medium text-inherit">
                      {formatINR(row.total)}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-mono ${textSubtle}`}>
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className={`border-t ${borderClass} font-semibold tabular-nums text-inherit`}>
                <td className="py-3 px-6">Total Expenses</td>
                <td className="py-3 px-4 text-right font-mono">
                  {formatINR(summary.weeklyTotals.week1)}
                </td>
                <td className="py-3 px-4 text-right font-mono">
                  {formatINR(summary.weeklyTotals.week2)}
                </td>
                <td className="py-3 px-4 text-right font-mono">
                  {formatINR(summary.weeklyTotals.week3)}
                </td>
                <td className="py-3 px-4 text-right font-mono">
                  {formatINR(summary.weeklyTotals.week4)}
                </td>
                <td className="py-3 px-4 text-right font-mono">
                  {formatINR(summary.weeklyTotals.week5)}
                </td>
                <td className="py-3 px-6 text-right font-mono text-amber-500 font-medium">
                  {formatINR(summary.weeklyTotals.total)}
                </td>
                <td className={`py-3 px-4 text-right font-mono ${textSubtle}`}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Selected Cell Item Inspector */}
      {selectedCell && (
        <div className={`border rounded-lg p-5 ${subtleSurfaceClass}`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-700/40 mb-3">
            <span className="text-xs font-mono font-medium">
              {selectedCell.category} &bull; Week {selectedCell.week} &bull; {formatINR(selectedCell.amount)}
            </span>
            <button
              onClick={() => setSelectedCell(null)}
              className={`text-xs ${textMuted} hover:text-inherit cursor-pointer`}
            >
              Dismiss
            </button>
          </div>

          <div className="space-y-2">
            {cellTransactions.map((tx) => (
              <div
                key={tx.id}
                className={`p-2.5 rounded border ${borderClass} flex items-center justify-between text-xs`}
              >
                <div>
                  <span className="font-medium">{tx.description}</span>
                  <span className={`text-[11px] font-mono ${textSubtle} ml-3`}>{tx.date}</span>
                  {tx.notes && <span className={`block text-[11px] ${textSubtle} mt-0.5`}>{tx.notes}</span>}
                </div>
                <span className="font-mono font-medium tabular-nums">{formatINR(tx.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
