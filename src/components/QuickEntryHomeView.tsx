import React, { useState, useRef, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

interface QuickEntryHomeViewProps {
  activeMonthId: string;
  currentSummary: MonthlySummary;
  months: Record<string, MonthlyBudget>;
  recentTransactions?: Transaction[];
  expenseCategories: string[];
  incomeCategories: string[];
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onSelectMonth: (monthId: string) => void;
  onCreateMonth: (monthId: string) => void;
  onNavigateToTab: (tab: 'summary' | 'dashboard' | 'transactions' | 'week' | 'category') => void;
  isDark?: boolean;
}

const MONTH_FULL_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [yr, mo, dy] = parts;
  const dateObj = new Date(yr, mo - 1, dy);
  return dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const QuickEntryHomeView: React.FC<QuickEntryHomeViewProps> = ({
  activeMonthId,
  currentSummary,
  months,
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

  // Modern Custom Date Picker Popover State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Calendar view month/year state synced with selected date
  const parsedDateParts = date.split('-').map(Number);
  const [viewYear, setViewYear] = useState<number>(parsedDateParts[0] || 2026);
  const [viewMonth, setViewMonth] = useState<number>((parsedDateParts[1] || 11) - 1); // 0-indexed

  useEffect(() => {
    const [yr, mo] = date.split('-').map(Number);
    if (!isNaN(yr) && !isNaN(mo)) {
      setViewYear(yr);
      setViewMonth(mo - 1);
    }
  }, [date]);

  // Close custom calendar popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCalendarOpen]);

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

  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().slice(0, 10));
    setIsCalendarOpen(false);
  };

  const handlePrevCalendarMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextCalendarMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectCalendarDay = (day: number) => {
    const formatted = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setDate(formatted);
    setIsCalendarOpen(false);
  };

  // Build days grid for viewYear & viewMonth
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

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
    <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8 py-1 sm:py-2">
      {/* Minimal Header & Month Status Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-light tracking-tight">Enter an Expense</h2>

        {/* Active Month Quick Status */}
        <div className={`px-3.5 py-2 rounded-lg border ${borderClass} ${surfaceClass} flex items-center justify-between sm:justify-start gap-4 text-xs`}>
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
            type="button"
            onClick={() => onNavigateToTab('summary')}
            className="text-xs font-mono text-amber-500 hover:underline flex items-center gap-1 cursor-pointer ml-1"
          >
            Board
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Minimal Entry Card */}
      <div className={`border rounded-lg p-5 sm:p-8 shadow-2xs ${surfaceClass}`}>
        {/* Type Segmented Control */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
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
              {targetMonthExists ? targetMonthName : `New: ${targetMonthName}`} &bull; W{targetWeek}
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
              <button
                type="button"
                onClick={() => {
                  onSelectMonth(justAdded.monthId);
                  onNavigateToTab('summary');
                }}
                className="font-mono font-medium text-amber-500 hover:underline cursor-pointer flex items-center gap-1"
              >
                Open {justAdded.monthName}
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Row 1: Amount & Modern Date Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
            {/* Amount Input (7 Cols) - No spin arrows, no quick preset chips */}
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
                  inputMode="decimal"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                  }}
                  placeholder="0.00"
                  className={`w-full pl-9 pr-4 py-2.5 rounded-md text-lg sm:text-xl font-mono font-light tabular-nums border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                />
              </div>
            </div>

            {/* Modern Custom Date Selector (5 Cols) */}
            <div className="sm:col-span-5 relative" ref={calendarRef}>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="quick-date-trigger"
                  className={`text-[11px] font-medium uppercase tracking-wider ${textSubtle} flex items-center gap-1`}
                >
                  <Calendar className="w-3 h-3" />
                  Date
                </label>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setDate(todayStr);
                      setIsCalendarOpen(false);
                    }}
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

              {/* Sleek Date Picker Trigger Button */}
              <button
                id="quick-date-trigger"
                type="button"
                onClick={() => setIsCalendarOpen((prev) => !prev)}
                aria-expanded={isCalendarOpen}
                aria-label="Select date"
                className={`w-full px-3.5 py-2.5 rounded-md text-sm font-mono border ${borderClass} ${subtleSurfaceClass} flex items-center justify-between gap-2 text-left transition-colors hover:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="tabular-nums font-medium">{formatDisplayDate(date)}</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 ${textMuted} transition-transform duration-150 shrink-0 ${
                    isCalendarOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Modern SaaS Calendar Popover */}
              {isCalendarOpen && (
                <div
                  className={`absolute right-0 left-0 sm:left-auto sm:w-72 mt-2 p-4 rounded-lg border shadow-xl z-50 ${surfaceClass}`}
                >
                  {/* Month / Year Navigation Header */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={handlePrevCalendarMonth}
                      className={`p-1.5 rounded-md border ${borderClass} ${subtleSurfaceClass} hover:opacity-80 cursor-pointer`}
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-xs font-medium tracking-tight">
                      {MONTH_FULL_NAMES[viewMonth]} {viewYear}
                    </span>

                    <button
                      type="button"
                      onClick={handleNextCalendarMonth}
                      className={`p-1.5 rounded-md border ${borderClass} ${subtleSurfaceClass} hover:opacity-80 cursor-pointer`}
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Weekday Labels */}
                  <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                    {WEEKDAYS_SHORT.map((wd) => (
                      <span
                        key={wd}
                        className={`text-[10px] font-mono uppercase tracking-wider ${textSubtle} py-1`}
                      >
                        {wd}
                      </span>
                    ))}
                  </div>

                  {/* Calendar Days Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((dayNum, idx) => {
                      if (dayNum === null) {
                        return <div key={`empty-${idx}`} className="h-8" />;
                      }

                      const cellDateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(
                        dayNum
                      ).padStart(2, '0')}`;
                      const isSelected = cellDateStr === date;
                      const isToday = cellDateStr === todayStr;

                      return (
                        <button
                          key={cellDateStr}
                          type="button"
                          onClick={() => handleSelectCalendarDay(dayNum)}
                          className={`h-8 rounded-md text-xs font-mono tabular-nums flex items-center justify-center transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-zinc-950 font-semibold shadow-2xs'
                              : isToday
                              ? `border border-amber-500/60 text-amber-500 font-medium`
                              : `hover:${subtleSurfaceClass}`
                          }`}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>

                  {/* Popover Footer */}
                  <div className={`mt-3 pt-2.5 border-t ${borderClass} flex items-center justify-between text-[11px] font-mono`}>
                    <button
                      type="button"
                      onClick={() => {
                        setDate(todayStr);
                        setIsCalendarOpen(false);
                      }}
                      className="text-amber-500 hover:underline cursor-pointer"
                    >
                      Jump to Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(false)}
                      className={`${textMuted} hover:text-inherit cursor-pointer`}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
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
                Edit Categories
              </button>
            </div>

            {/* Interactive Category Pills for 1-Tap Selection */}
            <div className="flex flex-wrap gap-1.5">
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

          {/* Row 3: Description */}
          <div>
            <label
              htmlFor="quick-description-input"
              className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-2 flex items-center gap-1`}
            >
              <FileText className="w-3 h-3" />
              Description
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
          <div className={`pt-4 border-t ${borderClass} flex justify-end`}>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              {type === 'expense' ? 'Add Expense' : 'Add Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
