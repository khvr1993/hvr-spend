import React, { useState } from 'react';
import { Transaction, TransactionType, MonthlySummary, MonthlyBudget } from '../types';
import {
  formatINR,
  calculateWeekNumber,
  getMonthIdFromDate,
  formatMonthIdToName,
} from '../utils/expenseCalculations';
import {
  Plus,
  Calendar,
  Tag,
  FileText,
  ArrowRight,
  Check,
  SlidersHorizontal,
  FolderPlus,
  Clock,
} from 'lucide-react';

interface QuickEntryHomeViewProps {
  activeMonthId: string;
  currentSummary: MonthlySummary;
  months: Record<string, MonthlyBudget>;
  recentTransactions: Transaction[];
  expenseCategories: string[];
  incomeCategories: string[];
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onSelectMonth: (monthId: string) => void;
  onCreateMonth: (monthId: string) => void;
  onNavigateToTab: (tab: 'summary' | 'dashboard' | 'transactions' | 'week' | 'category') => void;
  isDark?: boolean;
}

export const QuickEntryHomeView: React.FC<QuickEntryHomeViewProps> = ({
  activeMonthId,
  currentSummary,
  months,
  recentTransactions,
  expenseCategories,
  incomeCategories,
  onAddTransaction,
  onSelectMonth,
  onCreateMonth,
  onNavigateToTab,
  isDark = false,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr);
  const [category, setCategory] = useState(expenseCategories[0] || 'Food');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [justAdded, setJustAdded] = useState<{
    description: string;
    amount: number;
    monthName: string;
    monthId: string;
  } | null>(null);

  // Target month based on selected date
  const targetMonthId = getMonthIdFromDate(date);
  const targetMonthExists = Boolean(months[targetMonthId]);
  const targetMonthName = months[targetMonthId]?.monthName || formatMonthIdToName(targetMonthId);
  const targetWeek = calculateWeekNumber(date);

  const categoriesList = type === 'expense' ? expenseCategories : incomeCategories;

  // Theme classes (60-30-10 rule)
  const surfaceClass = isDark
    ? 'bg-[#121214] border-[#262626] text-zinc-100'
    : 'bg-white border-[#E5E5E5] text-zinc-900';

  const subtleSurfaceClass = isDark
    ? 'bg-[#18181B] border-[#262626]'
    : 'bg-[#F4F4F5] border-[#E5E5E5]';

  const textMuted = isDark ? 'text-zinc-400' : 'text-zinc-500';
  const textSubtle = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const borderClass = isDark ? 'border-[#262626] divide-[#262626]' : 'border-[#E5E5E5] divide-[#E5E5E5]';

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const list = newType === 'expense' ? expenseCategories : incomeCategories;
    if (!list.includes(category)) {
      setCategory(list[0] || 'Other');
    }
  };

  const handleQuickIncrement = (val: number) => {
    const current = parseFloat(amount) || 0;
    setAmount(String(current + val));
    setError('');
  };

  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().slice(0, 10));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    const activeCat = categoriesList.includes(category)
      ? category
      : categoriesList[0] || 'Other';

    const cleanDesc = description.trim() || `${activeCat} ${type}`;

    onAddTransaction({
      monthId: targetMonthId,
      date,
      type,
      category: activeCat,
      description: cleanDesc,
      amount: parsedAmt,
      weekNumber: targetWeek,
    });

    setJustAdded({
      description: cleanDesc,
      amount: parsedAmt,
      monthName: targetMonthName,
      monthId: targetMonthId,
    });

    setAmount('');
    setDescription('');
    setError('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-2">
      {/* Minimal Header & Month Switcher Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-light tracking-tight">Quick Expense Entry</h2>
          <p className={`text-xs ${textMuted} mt-1`}>
            Log an expense or income below. It automatically routes to the month of the selected date.
          </p>
        </div>

        {/* Active Month Quick Status */}
        <div className={`px-3.5 py-2 rounded-lg border ${borderClass} ${surfaceClass} flex items-center gap-4 text-xs`}>
          <div>
            <span className={`block text-[10px] font-mono uppercase tracking-wider ${textSubtle}`}>
              Viewing Board
            </span>
            <span className="font-medium">{currentSummary.monthName}</span>
          </div>
          <div className={`border-l ${borderClass} pl-4`}>
            <span className={`block text-[10px] font-mono uppercase tracking-wider ${textSubtle}`}>
              Month Spend
            </span>
            <span className="font-mono font-medium tabular-nums">
              {formatINR(currentSummary.actualExpenses)}
            </span>
          </div>
          <button
            onClick={() => onNavigateToTab('summary')}
            className={`text-xs font-mono text-amber-500 hover:underline flex items-center gap-1 cursor-pointer ml-1`}
          >
            Board
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Minimal Entry Card */}
      <div className={`border rounded-lg p-6 sm:p-8 shadow-2xs ${surfaceClass}`}>
        {/* Type Segmented Control */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className={`inline-flex p-0.5 rounded-md border ${borderClass} ${subtleSurfaceClass}`}>
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`px-4 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                type === 'expense'
                  ? isDark
                    ? 'bg-zinc-800 text-zinc-100 shadow-2xs'
                    : 'bg-white text-zinc-900 shadow-2xs'
                  : textMuted
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`px-4 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                type === 'income'
                  ? isDark
                    ? 'bg-zinc-800 text-zinc-100 shadow-2xs'
                    : 'bg-white text-zinc-900 shadow-2xs'
                  : textMuted
              }`}
            >
              Income
            </button>
          </div>

          {/* Automatic Month Routing Indicator */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`px-2.5 py-1 rounded border ${borderClass} ${subtleSurfaceClass} ${textMuted}`}>
              {targetMonthExists ? `Board: ${targetMonthName}` : `New Board: ${targetMonthName}`} &bull; W{targetWeek}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className={`p-3 rounded-md border border-amber-500/40 ${subtleSurfaceClass} text-xs text-amber-500 font-medium`}>
              {error}
            </div>
          )}

          {justAdded && (
            <div className={`p-3.5 rounded-md border border-amber-500/30 ${subtleSurfaceClass} flex flex-wrap items-center justify-between gap-2 text-xs`}>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Logged <strong>{formatINR(justAdded.amount)}</strong> ({justAdded.description}) into{' '}
                  <strong>{justAdded.monthName}</strong>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onSelectMonth(justAdded.monthId);
                    onNavigateToTab('summary');
                  }}
                  className="font-mono font-medium text-amber-500 hover:underline cursor-pointer flex items-center gap-1"
                >
                  Open {justAdded.monthName} Board
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Row 1: Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
            {/* Amount Input (7 Cols) */}
            <div className="sm:col-span-7">
              <label
                htmlFor="quick-amount-input"
                className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-2`}
              >
                Amount (₹)
              </label>
              <div className="relative">
                <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-mono ${textMuted}`}>
                  ₹
                </span>
                <input
                  id="quick-amount-input"
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                  }}
                  placeholder="0.00"
                  className={`w-full pl-9 pr-4 py-2.5 rounded-md text-xl font-mono font-light tabular-nums border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500`}
                />
              </div>
              {/* Quick Amount Chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {[100, 250, 500, 1000, 2500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleQuickIncrement(preset)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border ${borderClass} ${subtleSurfaceClass} ${textMuted} hover:text-inherit transition-colors cursor-pointer`}
                  >
                    +₹{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Input (5 Cols) */}
            <div className="sm:col-span-5">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="quick-date-input"
                  className={`text-[11px] font-medium uppercase tracking-wider ${textSubtle} flex items-center gap-1`}
                >
                  <Calendar className="w-3 h-3" />
                  Date
                </label>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setDate(todayStr)}
                    className={`${date === todayStr ? 'text-amber-500 font-medium' : textMuted} hover:underline cursor-pointer`}
                  >
                    Today
                  </button>
                  <span className={textSubtle}>&bull;</span>
                  <button
                    type="button"
                    onClick={setYesterday}
                    className={`${textMuted} hover:underline cursor-pointer`}
                  >
                    Yesterday
                  </button>
                </div>
              </div>
              <input
                id="quick-date-input"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-md text-sm font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500`}
              />
              <p className={`text-[11px] font-mono ${textSubtle} mt-2`}>
                Automatically logs into <strong>{targetMonthName}</strong>
              </p>
            </div>
          </div>

          {/* Row 2: Category Selection (Pills + Edit Shortcut) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="quick-category-select"
                className={`text-[11px] font-medium uppercase tracking-wider ${textSubtle} flex items-center gap-1`}
              >
                <Tag className="w-3 h-3" />
                Select Category
              </label>
              <button
                type="button"
                onClick={() => onNavigateToTab('category')}
                className={`text-[11px] font-mono ${textMuted} hover:text-amber-500 flex items-center gap-1 cursor-pointer transition-colors`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                Edit / Customize Categories
              </button>
            </div>

            {/* Interactive Category Pills for 1-Tap Selection */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {categoriesList.map((cat) => {
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-amber-500 shadow-2xs'
                        : `${borderClass} ${subtleSurfaceClass} ${textMuted} hover:text-inherit`
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Accessible Select Dropdown synced with pills */}
            <select
              id="quick-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="sr-only"
              aria-label="Category"
            >
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Row 3: Small Description */}
          <div>
            <label
              htmlFor="quick-description-input"
              className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-2 flex items-center gap-1`}
            >
              <FileText className="w-3 h-3" />
              Small Description
            </label>
            <input
              id="quick-description-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Morning coffee, Weekly groceries, Metro recharge (optional)"
              className={`w-full px-3.5 py-2.5 rounded-md text-xs border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500`}
            />
          </div>

          {/* Submit Action */}
          <div className={`pt-4 border-t ${borderClass} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
            <span className={`text-xs ${textSubtle}`}>
              Template columns (Summary, Week 1–5, Transactions, Category) update automatically.
            </span>
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              {type === 'expense' ? 'Add Expense' : 'Add Income'}
            </button>
          </div>
        </form>
      </div>

      {/* Month Boards Switcher & Recent Activity Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Monthly Boards Directory (5 Cols) */}
        <div className={`md:col-span-5 border rounded-lg p-5 flex flex-col justify-between ${surfaceClass}`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium uppercase tracking-wider">
                Monthly Boards
              </h3>
              <span className={`text-[11px] font-mono ${textSubtle}`}>
                {Object.keys(months).length} Months
              </span>
            </div>
            <p className={`text-xs ${textMuted} mb-4`}>
              Select any month to inspect its expenses, or start a new monthly template board.
            </p>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {Object.keys(months)
                .sort((a, b) => b.localeCompare(a))
                .map((mId) => {
                  const isCurrent = mId === activeMonthId;
                  return (
                    <div
                      key={mId}
                      onClick={() => {
                        onSelectMonth(mId);
                        onNavigateToTab('summary');
                      }}
                      className={`px-3 py-2 rounded-md border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isCurrent
                          ? `border-amber-500/40 ${subtleSurfaceClass} font-medium`
                          : `${borderClass} hover:${subtleSurfaceClass}`
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{months[mId]?.monthName || mId}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-mono text-amber-500">Active</span>
                        )}
                      </span>
                      <span className={`text-[11px] font-mono ${textMuted} flex items-center gap-1`}>
                        Open
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Quick Create Next Month Board */}
          <div className={`mt-4 pt-3 border-t ${borderClass}`}>
            <button
              type="button"
              onClick={() => {
                // Suggest next month not yet in months, e.g. 2026-12
                const sorted = Object.keys(months).sort((a, b) => b.localeCompare(a));
                const latest = sorted[0] || '2026-11';
                const [yr, mo] = latest.split('-').map(Number);
                const nextYr = mo === 12 ? yr + 1 : yr;
                const nextMo = mo === 12 ? 1 : mo + 1;
                const nextId = `${nextYr}-${String(nextMo).padStart(2, '0')}`;
                onCreateMonth(nextId);
              }}
              className={`w-full py-2 px-3 rounded-md border border-dashed ${borderClass} text-xs font-medium ${textMuted} hover:text-inherit flex items-center justify-center gap-1.5 cursor-pointer transition-colors`}
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
              + Create Next Month Board
            </button>
          </div>
        </div>

        {/* Recent Activity Feed (7 Cols) */}
        <div className={`md:col-span-7 border rounded-lg p-5 flex flex-col justify-between ${surfaceClass}`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                Recent Entries Across Months
              </h3>
              <button
                type="button"
                onClick={() => onNavigateToTab('transactions')}
                className={`text-xs font-mono ${textMuted} hover:text-inherit cursor-pointer`}
              >
                View All &rarr;
              </button>
            </div>

            <div className={`divide-y ${borderClass}`}>
              {recentTransactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{tx.description}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${borderClass} ${subtleSurfaceClass} ${textMuted}`}>
                        {tx.category}
                      </span>
                    </div>
                    <div className={`text-[11px] font-mono ${textSubtle} mt-0.5`}>
                      {tx.date} &bull; {months[tx.monthId]?.monthName || formatMonthIdToName(tx.monthId)}
                    </div>
                  </div>
                  <span
                    className={`font-mono font-medium tabular-nums shrink-0 ${
                      tx.type === 'income' ? 'text-amber-500' : 'text-inherit'
                    }`}
                  >
                    {tx.type === 'expense' ? '-' : '+'}
                    {formatINR(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={`mt-4 pt-3 border-t ${borderClass} flex items-center justify-between text-[11px] ${textSubtle}`}>
            <span>Tip: Pick any past or future date above to log directly into that month.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
