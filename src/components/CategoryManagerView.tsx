import React, { useState, useEffect } from 'react';
import { MonthlyBudget } from '../types';
import { formatINR } from '../utils/expenseCalculations';
import { Plus, Check, RotateCcw, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';

interface CategoryManagerViewProps {
  budget: MonthlyBudget;
  onUpdateBudget: (updated: MonthlyBudget) => void;
  onRenameCategory: (oldName: string, newName: string, type: 'expense' | 'income') => void;
  onDeleteCategory: (catName: string, type: 'expense' | 'income') => void;
  onResetToDefaults: () => void;
  onResetCurrentMonthCategories?: () => void;
  isDark?: boolean;
}

export const CategoryManagerView: React.FC<CategoryManagerViewProps> = ({
  budget,
  onUpdateBudget,
  onRenameCategory,
  onDeleteCategory,
  onResetToDefaults,
  onResetCurrentMonthCategories,
  isDark = false,
}) => {
  const [expenseBudgets, setExpenseBudgets] = useState<Record<string, number>>(budget.expenseBudgets);
  const [incomeBudgets, setIncomeBudgets] = useState<Record<string, number>>(budget.incomeBudgets);
  const [startBalance, setStartBalance] = useState<number>(budget.startBalance);

  // Sync local state when switching months or external budget updates
  useEffect(() => {
    setExpenseBudgets(budget.expenseBudgets);
    setIncomeBudgets(budget.incomeBudgets);
    setStartBalance(budget.startBalance);
  }, [budget]);

  // Inline category rename state
  const [editingCat, setEditingCat] = useState<{
    originalName: string;
    newName: string;
    type: 'expense' | 'income';
  } | null>(null);

  const [newCatName, setNewCatName] = useState('');
  const [newCatBudget, setNewCatBudget] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Surface classes (60-30-10 rule)
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

  const handleExpenseChange = (cat: string, val: string) => {
    const num = parseFloat(val) || 0;
    const next = { ...expenseBudgets, [cat]: num };
    setExpenseBudgets(next);
    onUpdateBudget({
      ...budget,
      startBalance,
      expenseBudgets: next,
      incomeBudgets,
    });
  };

  const handleIncomeChange = (cat: string, val: string) => {
    const num = parseFloat(val) || 0;
    const next = { ...incomeBudgets, [cat]: num };
    setIncomeBudgets(next);
    onUpdateBudget({
      ...budget,
      startBalance,
      expenseBudgets,
      incomeBudgets: next,
    });
  };

  const handleCommitRename = () => {
    if (!editingCat) return;
    const trimmed = editingCat.newName.trim();
    if (!trimmed || trimmed === editingCat.originalName) {
      setEditingCat(null);
      return;
    }
    onRenameCategory(editingCat.originalName, trimmed, editingCat.type);
    setEditingCat(null);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const num = parseFloat(newCatBudget) || 0;
    if (newCatType === 'expense') {
      const next = { ...expenseBudgets, [trimmed]: num };
      setExpenseBudgets(next);
      onUpdateBudget({
        ...budget,
        startBalance,
        expenseBudgets: next,
        incomeBudgets,
      });
    } else {
      const next = { ...incomeBudgets, [trimmed]: num };
      setIncomeBudgets(next);
      onUpdateBudget({
        ...budget,
        startBalance,
        expenseBudgets,
        incomeBudgets: next,
      });
    }
    setNewCatName('');
    setNewCatBudget('');
  };

  const handleSaveAll = () => {
    onUpdateBudget({
      ...budget,
      startBalance,
      expenseBudgets,
      incomeBudgets,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const totalExpenseBudget = Object.values(expenseBudgets).reduce((a, b) => a + b, 0);
  const totalIncomeBudget = Object.values(incomeBudgets).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className={`border rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${surfaceClass}`}>
        <div>
          <h3 className="text-base font-medium tracking-tight">
            Edit Categories & Monthly Targets
          </h3>
          <p className={`text-xs ${textMuted} mt-0.5`}>
            Rename, remove, or add categories and configure target limits for {budget.monthName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowResetConfirmModal(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${borderClass} ${subtleSurfaceClass} ${textMuted} hover:text-inherit flex items-center gap-1.5 cursor-pointer`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-medium rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                Saved
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>

      {/* Add New Category Minimal Form */}
      <div className={`border rounded-lg p-6 ${surfaceClass}`}>
        <h4 className="text-sm font-medium tracking-tight mb-3">Add New Category</h4>
        <form onSubmit={handleAddCategory} className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            required
            placeholder="New category name (e.g. Subscriptions, Pet Care, Freelance)"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className={`flex-1 min-w-[200px] px-3 py-1.5 rounded-md text-xs border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500`}
          />
          <input
            type="number"
            placeholder="Planned budget (₹)"
            value={newCatBudget}
            onChange={(e) => setNewCatBudget(e.target.value)}
            className={`w-40 px-3 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500`}
          />
          <select
            value={newCatType}
            onChange={(e) => setNewCatType(e.target.value as any)}
            aria-label="New category type"
            className={`px-3 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none`}
          >
            <option value="expense">Expense Category</option>
            <option value="income">Income Category</option>
          </select>
          <button
            type="submit"
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            Add Category
          </button>
        </form>
      </div>

      {/* Ledgers Grid for Renaming, Deleting, and Budgeting */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expense Categories */}
        <div className={`border rounded-lg overflow-hidden ${surfaceClass}`}>
          <div className={`px-6 py-3.5 border-b ${borderClass} ${subtleSurfaceClass} flex items-center justify-between`}>
            <span className="text-xs font-medium uppercase tracking-wider text-inherit">
              Expense Categories ({Object.keys(expenseBudgets).length})
            </span>
            <span className="text-xs font-mono font-medium text-inherit">
              {formatINR(totalExpenseBudget)}
            </span>
          </div>

          <div className={`divide-y ${borderClass} max-h-[480px] overflow-y-auto`}>
            {Object.entries(expenseBudgets).map(([cat, amount]) => {
              const isRenaming =
                editingCat?.type === 'expense' && editingCat.originalName === cat;

              return (
                <div
                  key={cat}
                  className={`px-6 py-2.5 flex items-center justify-between gap-2 ${rowHover} group`}
                >
                  {isRenaming ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        autoFocus
                        value={editingCat.newName}
                        onChange={(e) =>
                          setEditingCat({ ...editingCat, newName: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCommitRename();
                          if (e.key === 'Escape') setEditingCat(null);
                        }}
                        aria-label={`Rename ${cat}`}
                        className={`flex-1 px-2.5 py-1 text-xs rounded border border-amber-500 ${subtleSurfaceClass} focus:outline-none`}
                      />
                      <button
                        type="button"
                        onClick={handleCommitRename}
                        aria-label="Save category name"
                        className="p-1 rounded bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCat(null)}
                        aria-label="Cancel rename"
                        className={`p-1 rounded border ${borderClass} ${textMuted} cursor-pointer`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-medium truncate">{cat}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingCat({
                            originalName: cat,
                            newName: cat,
                            type: 'expense',
                          })
                        }
                        aria-label={`Rename category ${cat}`}
                        title="Rename category"
                        className={`p-1 rounded ${textSubtle} hover:text-inherit opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      value={amount}
                      aria-label={`Budget for ${cat}`}
                      onChange={(e) => handleExpenseChange(cat, e.target.value)}
                      className={`w-28 px-2.5 py-1 text-right text-xs font-mono rounded border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500`}
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteCategory(cat, 'expense')}
                      aria-label={`Delete category ${cat}`}
                      title="Delete category"
                      className={`p-1 rounded ${textSubtle} hover:text-amber-500 opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Income Categories */}
        <div className={`border rounded-lg overflow-hidden ${surfaceClass}`}>
          <div className={`px-6 py-3.5 border-b ${borderClass} ${subtleSurfaceClass} flex items-center justify-between`}>
            <span className="text-xs font-medium uppercase tracking-wider text-inherit">
              Income Categories ({Object.keys(incomeBudgets).length})
            </span>
            <span className="text-xs font-mono font-medium text-inherit">
              {formatINR(totalIncomeBudget)}
            </span>
          </div>

          <div className={`divide-y ${borderClass} max-h-[480px] overflow-y-auto`}>
            {Object.entries(incomeBudgets).map(([cat, amount]) => {
              const isRenaming =
                editingCat?.type === 'income' && editingCat.originalName === cat;

              return (
                <div
                  key={cat}
                  className={`px-6 py-2.5 flex items-center justify-between gap-2 ${rowHover} group`}
                >
                  {isRenaming ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        autoFocus
                        value={editingCat.newName}
                        onChange={(e) =>
                          setEditingCat({ ...editingCat, newName: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCommitRename();
                          if (e.key === 'Escape') setEditingCat(null);
                        }}
                        aria-label={`Rename ${cat}`}
                        className={`flex-1 px-2.5 py-1 text-xs rounded border border-amber-500 ${subtleSurfaceClass} focus:outline-none`}
                      />
                      <button
                        type="button"
                        onClick={handleCommitRename}
                        aria-label="Save category name"
                        className="p-1 rounded bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCat(null)}
                        aria-label="Cancel rename"
                        className={`p-1 rounded border ${borderClass} ${textMuted} cursor-pointer`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-medium truncate">{cat}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingCat({
                            originalName: cat,
                            newName: cat,
                            type: 'income',
                          })
                        }
                        aria-label={`Rename category ${cat}`}
                        title="Rename category"
                        className={`p-1 rounded ${textSubtle} hover:text-inherit opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      value={amount}
                      aria-label={`Budget for ${cat}`}
                      onChange={(e) => handleIncomeChange(cat, e.target.value)}
                      className={`w-28 px-2.5 py-1 text-right text-xs font-mono rounded border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500`}
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteCategory(cat, 'income')}
                      aria-label={`Delete category ${cat}`}
                      title="Delete category"
                      className={`p-1 rounded ${textSubtle} hover:text-amber-500 opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mandatory Destructive Reset Confirmation Modal (P0-5) */}
      {showResetConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-confirm-title"
        >
          <div className={`border rounded-lg shadow-2xl max-w-md w-full p-6 space-y-4 ${surfaceClass}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-amber-500/15 text-amber-500 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 id="reset-confirm-title" className="text-sm font-medium tracking-tight">
                    Confirm Reset
                  </h4>
                  <p className={`text-[11px] font-mono ${textMuted}`}>
                    Destructive action confirmation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                aria-label="Close confirmation dialog"
                className={`${textSubtle} hover:text-inherit p-1 cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`text-xs ${textMuted} space-y-2 leading-relaxed`}>
              <p>
                This will permanently delete all transactions and reset every month board except{' '}
                <strong className="text-inherit">Nov-26 Expenses</strong>. Custom categories and budgets will be lost. This cannot be undone.
              </p>
              <p className="text-[11px] font-mono">
                A timestamped recovery snapshot will be saved automatically in browser storage before resetting.
              </p>
            </div>

            <div className={`pt-3 border-t ${borderClass} flex flex-wrap items-center justify-end gap-2`}>
              <button
                type="button"
                autoFocus
                onClick={() => setShowResetConfirmModal(false)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border ${borderClass} ${subtleSurfaceClass} cursor-pointer`}
              >
                Cancel
              </button>
              {onResetCurrentMonthCategories && (
                <button
                  type="button"
                  onClick={() => {
                    onResetCurrentMonthCategories();
                    setShowResetConfirmModal(false);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 cursor-pointer`}
                >
                  Reset Categories Only ({budget.monthName})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onResetToDefaults();
                  setShowResetConfirmModal(false);
                }}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-red-600 hover:bg-red-500 text-white cursor-pointer"
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
