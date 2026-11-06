import React, { useState, useEffect, useRef } from 'react';
import {
  MonthlyBudget,
  Transaction,
  RecurringTemplate,
  FullAppBackupPayload,
} from '../types';
import { INITIAL_MONTH_NAME } from '../data/initialData';
import { formatINR, formatLocalYYYYMMDD } from '../utils/expenseCalculations';
import {
  createFullBackupJSON,
  parseAndValidateBackupJSON,
} from '../utils/recurringAndBackup';
import {
  Plus,
  Check,
  RotateCcw,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Repeat,
  Download,
  Upload,
  Database,
  Play,
} from 'lucide-react';

interface CategoryManagerViewProps {
  budget: MonthlyBudget;
  months?: Record<string, MonthlyBudget>;
  transactions?: Transaction[];
  recurringTemplates?: RecurringTemplate[];
  resetTargetMonthName?: string;
  onUpdateBudget: (updated: MonthlyBudget) => void;
  onRenameCategory: (oldName: string, newName: string, type: 'expense' | 'income') => void;
  onDeleteCategory: (
    catName: string,
    type: 'expense' | 'income',
    reassignToCategory?: string
  ) => void;
  onAddRecurringTemplate?: (tpl: Omit<RecurringTemplate, 'id'>) => void;
  onToggleRecurringTemplate?: (id: string) => void;
  onDeleteRecurringTemplate?: (id: string) => void;
  onSeedRecurringToMonth?: (monthId: string) => { insertedCount: number; skippedCount: number };
  onRestoreBackup?: (payload: FullAppBackupPayload, mode: 'merge' | 'replace') => void;
  onResetToDefaults: (forceWithoutBackup?: boolean) => { ok: boolean; error?: string } | void;
  onResetCurrentMonthCategories?: () => void;
  isDark?: boolean;
}

export const CategoryManagerView: React.FC<CategoryManagerViewProps> = ({
  budget,
  months = {},
  transactions = [],
  recurringTemplates = [],
  resetTargetMonthName = INITIAL_MONTH_NAME,
  onUpdateBudget,
  onRenameCategory,
  onDeleteCategory,
  onAddRecurringTemplate,
  onToggleRecurringTemplate,
  onDeleteRecurringTemplate,
  onSeedRecurringToMonth,
  onRestoreBackup,
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

  // Recurring template form state
  const [recType, setRecType] = useState<'expense' | 'income'>('expense');
  const [recCategory, setRecCategory] = useState<string>(
    Object.keys(budget.expenseBudgets)[0] || 'Home'
  );
  const [recDesc, setRecDesc] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recDay, setRecDay] = useState('1');
  const [recSeedFeedback, setRecSeedFeedback] = useState<string | null>(null);

  // Backup & Restore state
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [backupStatusMessage, setBackupStatusMessage] = useState<string | null>(null);
  const [backupErrorMessage, setBackupErrorMessage] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    data: FullAppBackupPayload;
    stats: { monthCount: number; transactionCount: number; recurringCount: number };
    sourceLabel: string;
  } | null>(null);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [resetBackupError, setResetBackupError] = useState<string | null>(null);
  const [pendingDeleteCat, setPendingDeleteCat] = useState<{
    catName: string;
    type: 'expense' | 'income';
    txCount: number;
    reassignTo: string;
  } | null>(null);

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

  const handleRequestDeleteCategory = (catName: string, type: 'expense' | 'income') => {
    const affectedTxs = transactions.filter((t) => t.type === type && t.category === catName);
    if (affectedTxs.length === 0) {
      onDeleteCategory(catName, type);
      return;
    }
    const defaultFallback = type === 'expense' ? 'Unplanned' : 'Other';
    const availableCats = Object.keys(type === 'expense' ? expenseBudgets : incomeBudgets).filter(
      (c) => c !== catName
    );
    const reassignTo =
      catName !== defaultFallback
        ? defaultFallback
        : availableCats[0] || (type === 'expense' ? 'Other Expense' : 'Misc Income');

    setPendingDeleteCat({
      catName,
      type,
      txCount: affectedTxs.length,
      reassignTo,
    });
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
            onClick={() => {
              setResetBackupError(null);
              setShowResetConfirmModal(true);
            }}
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
                      onClick={() => handleRequestDeleteCategory(cat, 'expense')}
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
                      onClick={() => handleRequestDeleteCategory(cat, 'income')}
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

      {/* Recurring Transactions Section (Rent, Paycheck, Subscriptions) */}
      <div className={`border rounded-lg p-6 space-y-5 ${surfaceClass}`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b ${borderClass}`}>
          <div>
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-medium tracking-tight">
                Recurring Transactions (Rent, Paycheck, Subscriptions)
              </h4>
            </div>
            <p className={`text-xs ${textMuted} mt-0.5`}>
              Templates automatically pre-populate when creating a new monthly board (with confirm/skip) or can be seeded into {budget.monthName} now
            </p>
          </div>

          {onSeedRecurringToMonth && recurringTemplates.some((t) => t.enabled) && (
            <button
              type="button"
              onClick={() => {
                const res = onSeedRecurringToMonth(budget.monthId);
                if (res.insertedCount > 0) {
                  setRecSeedFeedback(
                    `Seeded ${res.insertedCount} recurring transaction${res.insertedCount === 1 ? '' : 's'} into ${budget.monthName}${
                      res.skippedCount > 0 ? ` (${res.skippedCount} already existed)` : ''
                    }.`
                  );
                } else {
                  setRecSeedFeedback(
                    `All ${res.skippedCount} enabled recurring transaction(s) already exist in ${budget.monthName}.`
                  );
                }
                setTimeout(() => setRecSeedFeedback(null), 5000);
              }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 flex items-center gap-1.5 cursor-pointer shrink-0`}
            >
              <Play className="w-3.5 h-3.5" />
              Seed into {budget.monthName} ({recurringTemplates.filter((t) => t.enabled).length})
            </button>
          )}
        </div>

        {recSeedFeedback && (
          <div className={`p-3 rounded-md border border-amber-500/40 ${subtleSurfaceClass} text-xs text-amber-500 font-mono`}>
            {recSeedFeedback}
          </div>
        )}

        {/* Add Recurring Template Form */}
        {onAddRecurringTemplate && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const amt = parseFloat(recAmount);
              if (!recDesc.trim() || isNaN(amt) || amt <= 0) return;
              const day = Math.min(31, Math.max(1, parseInt(recDay, 10) || 1));
              onAddRecurringTemplate({
                type: recType,
                category: recCategory,
                description: recDesc.trim(),
                amount: amt,
                dayOfMonth: day,
                enabled: true,
              });
              setRecDesc('');
              setRecAmount('');
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-center"
          >
            <input
              type="text"
              required
              placeholder="Item (e.g. House Rent, Salary, Netflix)"
              value={recDesc}
              onChange={(e) => setRecDesc(e.target.value)}
              className={`lg:col-span-2 px-3 py-1.5 rounded-md text-xs border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500`}
            />
            <input
              type="number"
              step="0.01"
              required
              placeholder="Amount (₹)"
              value={recAmount}
              onChange={(e) => setRecAmount(e.target.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500`}
            />
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] font-mono ${textSubtle} shrink-0`}>Day:</span>
              <input
                type="number"
                min={1}
                max={31}
                required
                value={recDay}
                onChange={(e) => setRecDay(e.target.value)}
                aria-label="Recurring day of month"
                className={`w-full px-2.5 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500`}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={recType}
                onChange={(e) => {
                  const nextType = e.target.value as 'expense' | 'income';
                  setRecType(nextType);
                  const nextCats = Object.keys(nextType === 'expense' ? expenseBudgets : incomeBudgets);
                  setRecCategory(nextCats[0] || (nextType === 'expense' ? 'Home' : 'Paycheck'));
                }}
                aria-label="Recurring transaction type"
                className={`w-24 px-2 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none`}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <select
                value={recCategory}
                onChange={(e) => setRecCategory(e.target.value)}
                aria-label="Recurring category"
                className={`flex-1 min-w-0 px-2 py-1.5 rounded-md text-xs border ${borderClass} ${subtleSurfaceClass} focus:outline-none truncate`}
              >
                {Object.keys(recType === 'expense' ? expenseBudgets : incomeBudgets).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Add Template
            </button>
          </form>
        )}

        {/* Saved Recurring Templates List */}
        {recurringTemplates.length === 0 ? (
          <p className={`text-xs ${textSubtle} font-mono py-2`}>
            No recurring templates saved yet. Add rent, salary, or monthly subscriptions above to auto-seed new months.
          </p>
        ) : (
          <div className={`divide-y ${borderClass} border ${borderClass} rounded-md overflow-hidden`}>
            {recurringTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs ${rowHover} ${
                  !tpl.enabled ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={tpl.enabled}
                    onChange={() => onToggleRecurringTemplate?.(tpl.id)}
                    aria-label={`Toggle ${tpl.description}`}
                    className="accent-amber-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                  />
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${borderClass} ${subtleSurfaceClass} shrink-0`}>
                    Day {tpl.dayOfMonth}
                  </span>
                  <div className="min-w-0">
                    <span className="font-medium truncate block">{tpl.description}</span>
                    <span className={`text-[10px] font-mono ${textMuted}`}>
                      {tpl.category} &bull; {tpl.type === 'income' ? 'Income' : 'Expense'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`font-mono font-medium tabular-nums ${
                      tpl.type === 'income' ? 'text-amber-500' : ''
                    }`}
                  >
                    {tpl.type === 'income' ? '+' : '-'}
                    {formatINR(tpl.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteRecurringTemplate?.(tpl.id)}
                    aria-label={`Delete recurring template ${tpl.description}`}
                    className={`p-1 rounded ${textSubtle} hover:text-amber-500 cursor-pointer`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Backup & Restore (JSON) Card */}
      <div className={`border rounded-lg p-6 space-y-4 ${surfaceClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-medium tracking-tight">
                Full Data Backup &amp; Restore (JSON)
              </h4>
            </div>
            <p className={`text-xs ${textMuted} mt-0.5`}>
              Export all monthly boards, transactions, and recurring templates to a local JSON file or restore from a backup
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setBackupErrorMessage(null);
                const json = createFullBackupJSON({
                  months: Object.keys(months).length > 0 ? months : { [budget.monthId]: budget },
                  transactions,
                  recurringTemplates,
                });
                const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `hvr-expense-backup-${formatLocalYYYYMMDD()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setBackupStatusMessage('Full JSON backup downloaded.');
                setTimeout(() => setBackupStatusMessage(null), 4000);
              }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium border ${borderClass} ${subtleSurfaceClass} hover:border-amber-500/50 flex items-center gap-1.5 cursor-pointer`}
            >
              <Download className="w-3.5 h-3.5 text-amber-500" />
              Export All Data (.json)
            </button>

            <input
              ref={backupFileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBackupErrorMessage(null);
                setBackupStatusMessage(null);
                try {
                  const text = await file.text();
                  const validated = parseAndValidateBackupJSON(text);
                  if (!validated.ok) {
                    setBackupErrorMessage(validated.error);
                  } else {
                    setPendingRestore({
                      data: validated.data,
                      stats: validated.stats,
                      sourceLabel: file.name,
                    });
                  }
                } catch (err: any) {
                  setBackupErrorMessage(err?.message || 'Failed to read backup file.');
                } finally {
                  if (backupFileInputRef.current) {
                    backupFileInputRef.current.value = '';
                  }
                }
              }}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => backupFileInputRef.current?.click()}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Backup (.json)
            </button>
          </div>
        </div>

        {backupStatusMessage && (
          <div className={`p-3 rounded-md border border-amber-500/40 ${subtleSurfaceClass} text-xs text-amber-500 font-mono`}>
            {backupStatusMessage}
          </div>
        )}

        {backupErrorMessage && (
          <div className="p-3 rounded-md border border-red-500/40 bg-red-500/10 text-xs text-red-400 font-mono">
            {backupErrorMessage}
          </div>
        )}
      </div>

      {/* Restore Backup Confirmation Modal */}
      {pendingRestore && onRestoreBackup && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-backup-title"
        >
          <div className={`border rounded-lg shadow-2xl max-w-md w-full p-6 space-y-4 ${surfaceClass}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-amber-500/15 text-amber-500 shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 id="restore-backup-title" className="text-sm font-medium tracking-tight">
                    Restore JSON Backup
                  </h4>
                  <p className={`text-[11px] font-mono ${textMuted}`}>
                    Source: {pendingRestore.sourceLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className={`${textSubtle} hover:text-inherit p-1 cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`p-3 rounded-md border ${borderClass} ${subtleSurfaceClass} text-xs font-mono space-y-1`}>
              <div>Month Boards: <strong>{pendingRestore.stats.monthCount}</strong></div>
              <div>Transactions: <strong>{pendingRestore.stats.transactionCount}</strong></div>
              <div>Recurring Templates: <strong>{pendingRestore.stats.recurringCount}</strong></div>
            </div>

            <p className={`text-xs ${textMuted} leading-relaxed`}>
              Choose <strong>Merge</strong> to keep your existing entries and add non-duplicate records from this backup, or <strong>Replace All</strong> to overwrite current state with this backup.
            </p>

            <div className={`pt-3 border-t ${borderClass} flex flex-wrap items-center justify-end gap-2`}>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border ${borderClass} ${subtleSurfaceClass} cursor-pointer`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onRestoreBackup(pendingRestore.data, 'merge');
                  setBackupStatusMessage(
                    `Merged backup (${pendingRestore.stats.monthCount} month(s), ${pendingRestore.stats.transactionCount} transaction(s)).`
                  );
                  setPendingRestore(null);
                }}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-amber-500 hover:bg-amber-400 text-zinc-950 cursor-pointer"
              >
                Merge with Current Data
              </button>
              <button
                type="button"
                onClick={() => {
                  onRestoreBackup(pendingRestore.data, 'replace');
                  setBackupStatusMessage(
                    `Restored full backup (${pendingRestore.stats.monthCount} month(s), ${pendingRestore.stats.transactionCount} transaction(s)).`
                  );
                  setPendingRestore(null);
                }}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-red-600 hover:bg-red-500 text-white cursor-pointer"
              >
                Replace All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Deletion Reassignment Modal (Prevents Orphaned Transactions) */}
      {pendingDeleteCat && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-cat-confirm-title"
        >
          <div className={`border rounded-lg shadow-2xl max-w-md w-full p-6 space-y-4 ${surfaceClass}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-amber-500/15 text-amber-500 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 id="delete-cat-confirm-title" className="text-sm font-medium tracking-tight">
                    Reassign Transactions Before Deleting
                  </h4>
                  <p className={`text-[11px] font-mono ${textMuted}`}>
                    Category in use ({pendingDeleteCat.txCount} transaction{pendingDeleteCat.txCount === 1 ? '' : 's'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingDeleteCat(null)}
                aria-label="Close category delete dialog"
                className={`${textSubtle} hover:text-inherit p-1 cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`text-xs ${textMuted} space-y-2 leading-relaxed`}>
              <p>
                Category <strong className="text-inherit">{pendingDeleteCat.catName}</strong> has{' '}
                <strong className="text-inherit">{pendingDeleteCat.txCount}</strong> recorded transaction
                {pendingDeleteCat.txCount === 1 ? '' : 's'}. Deleting it will reassign those transactions to{' '}
                <strong className="text-inherit">{pendingDeleteCat.reassignTo}</strong> so your ledger totals stay accurate.
              </p>
            </div>

            <div className={`pt-3 border-t ${borderClass} flex items-center justify-end gap-2`}>
              <button
                type="button"
                autoFocus
                onClick={() => setPendingDeleteCat(null)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border ${borderClass} ${subtleSurfaceClass} cursor-pointer`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteCategory(
                    pendingDeleteCat.catName,
                    pendingDeleteCat.type,
                    pendingDeleteCat.reassignTo
                  );
                  setPendingDeleteCat(null);
                }}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-amber-500 hover:bg-amber-400 text-zinc-950 cursor-pointer"
              >
                Reassign to {pendingDeleteCat.reassignTo} &amp; Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
                onClick={() => {
                  setResetBackupError(null);
                  setShowResetConfirmModal(false);
                }}
                aria-label="Close confirmation dialog"
                className={`${textSubtle} hover:text-inherit p-1 cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`text-xs ${textMuted} space-y-2 leading-relaxed`}>
              <p>
                This will permanently delete all transactions and reset every month board except{' '}
                <strong className="text-inherit">{resetTargetMonthName}</strong>. Custom categories and budgets will be lost. This cannot be undone.
              </p>
              <p className="text-[11px] font-mono">
                A timestamped recovery snapshot is saved to browser storage before resetting. If backup creation fails, the reset is blocked unless you explicitly proceed without a backup.
              </p>
            </div>

            {resetBackupError && (
              <div className="p-3 rounded-md border border-red-500/40 bg-red-500/10 text-xs text-red-400 space-y-2">
                <p className="font-medium">Backup could not be saved: {resetBackupError}</p>
                <button
                  type="button"
                  onClick={() => {
                    onResetToDefaults(true);
                    setResetBackupError(null);
                    setShowResetConfirmModal(false);
                  }}
                  className="px-3 py-1 rounded text-xs font-medium bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                >
                  Proceed Without Backup
                </button>
              </div>
            )}

            <div className={`pt-3 border-t ${borderClass} flex flex-wrap items-center justify-end gap-2`}>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setResetBackupError(null);
                  setShowResetConfirmModal(false);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border ${borderClass} ${subtleSurfaceClass} cursor-pointer`}
              >
                Cancel
              </button>
              {onResetCurrentMonthCategories && (
                <button
                  type="button"
                  onClick={() => {
                    onResetCurrentMonthCategories();
                    setResetBackupError(null);
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
                  const res = onResetToDefaults(false);
                  if (res && res.ok === false) {
                    setResetBackupError(res.error || 'Browser storage quota exceeded.');
                    return;
                  }
                  setResetBackupError(null);
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
