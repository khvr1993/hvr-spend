import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  MonthlyBudget,
  Transaction,
  MonthlySummary,
  TransactionType,
} from './types';
import {
  INITIAL_MONTH_ID,
  INITIAL_MONTH_NAME,
  INITIAL_EXPENSE_BUDGETS_NOV,
  INITIAL_INCOME_BUDGETS_NOV,
  INITIAL_TRANSACTIONS_NOV,
  INITIAL_MONTH_OCT,
  INITIAL_TRANSACTIONS_OCT,
} from './data/initialData';
import {
  calculateSummary,
  calculateWeekNumber,
  getMonthIdFromDate,
  formatMonthIdToName,
  isDailySyncDue,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from './utils/expenseCalculations';
import {
  initAuth,
  DriveFileInfo,
  importTransactionsFromGoogleSheet,
  syncToGoogleDrive,
} from './services/googleDriveService';

// View Components
import { QuickEntryHomeView } from './components/QuickEntryHomeView';
import { SummaryView } from './components/SummaryView';
import { GraphicalDashboardView } from './components/GraphicalDashboardView';
import { TransactionsView } from './components/TransactionsView';
import { ExpensesByWeekView } from './components/ExpensesByWeekView';
import { CategoryManagerView } from './components/CategoryManagerView';
import { DriveSyncModal } from './components/DriveSyncModal';
import { ImportTransactionsModal } from './components/ImportTransactionsModal';

// Icons
import {
  Cloud,
  Plus,
  Upload,
  Sun,
  Moon,
  ChevronDown,
  FolderPlus,
} from 'lucide-react';

export type AppTab = 'home' | 'summary' | 'dashboard' | 'transactions' | 'week' | 'category';

export default function App() {
  // Theme state: Light mode supported and defaulted so user can experience crisp Light Mode immediately, with instant toggle to Dark Mode
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('saas_theme_mode_v2');
    return saved !== null ? saved === 'dark' : false;
  });

  // Navigation: Default to 'home' (Minimal Quick Entry Landing Page)
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [activeMonthId, setActiveMonthId] = useState<string>(INITIAL_MONTH_ID);

  // Month Budgets registry
  const [months, setMonths] = useState<Record<string, MonthlyBudget>>(() => {
    const saved = localStorage.getItem('expense_app_months');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse months:', e);
      }
    }
    return {
      '2026-11': {
        monthId: INITIAL_MONTH_ID,
        monthName: INITIAL_MONTH_NAME,
        startBalance: 0,
        expenseBudgets: INITIAL_EXPENSE_BUDGETS_NOV,
        incomeBudgets: INITIAL_INCOME_BUDGETS_NOV,
      },
      '2026-10': INITIAL_MONTH_OCT,
    };
  });

  // Transactions list
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('expense_app_transactions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse transactions:', e);
      }
    }
    return [...INITIAL_TRANSACTIONS_NOV, ...INITIAL_TRANSACTIONS_OCT];
  });

  // Auth & Drive
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [dailyAutoSync, setDailyAutoSync] = useState<boolean>(() => {
    const saved = localStorage.getItem('expense_app_daily_autosync');
    return saved !== null ? saved === 'true' : true;
  });
  const [isAutoSyncingDaily, setIsAutoSyncingDaily] = useState(false);

  // Create New Month Modal State
  const [isNewMonthModalOpen, setIsNewMonthModalOpen] = useState(false);
  const [newMonthInput, setNewMonthInput] = useState('2026-12');
  const [newMonthStartBalance, setNewMonthStartBalance] = useState('0');

  // Quick Add Modal state (from header button)
  const [quickAddType, setQuickAddType] = useState<TransactionType>('expense');
  const [quickAddCat, setQuickAddCat] = useState<string | undefined>(undefined);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDesc, setQuickAddDesc] = useState('');
  const [quickAddAmount, setQuickAddAmount] = useState('');
  const [quickAddDate, setQuickAddDate] = useState(new Date().toISOString().slice(0, 10));

  // Sync theme to root class
  useEffect(() => {
    localStorage.setItem('saas_theme_mode_v2', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('theme-light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('theme-light');
    }
  }, [isDark]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Persist to local storage
  useEffect(() => {
    localStorage.setItem('expense_app_months', JSON.stringify(months));
  }, [months]);

  useEffect(() => {
    localStorage.setItem('expense_app_transactions', JSON.stringify(transactions));
  }, [transactions]);

  // Current active budget config (uses template if month not yet registered)
  const currentBudget = useMemo<MonthlyBudget>(() => {
    if (months[activeMonthId]) return months[activeMonthId];
    return {
      monthId: activeMonthId,
      monthName: formatMonthIdToName(activeMonthId),
      startBalance: 0,
      expenseBudgets: { ...INITIAL_EXPENSE_BUDGETS_NOV },
      incomeBudgets: { ...INITIAL_INCOME_BUDGETS_NOV },
    };
  }, [months, activeMonthId]);

  // Helper to ensure a month board exists in `months`, cloning template categories from currentBudget
  const ensureMonthBoardExists = (monthId: string, customStartBalance?: number) => {
    setMonths((prev) => {
      if (prev[monthId]) return prev;
      const templateExpense = { ...currentBudget.expenseBudgets };
      const templateIncome = { ...currentBudget.incomeBudgets };
      return {
        ...prev,
        [monthId]: {
          monthId,
          monthName: formatMonthIdToName(monthId),
          startBalance: customStartBalance ?? 0,
          expenseBudgets: templateExpense,
          incomeBudgets: templateIncome,
        },
      };
    });
  };

  // Summary for active month
  const currentSummary = useMemo<MonthlySummary>(() => {
    return calculateSummary(
      activeMonthId,
      currentBudget.monthName,
      currentBudget.startBalance,
      transactions,
      currentBudget.expenseBudgets,
      currentBudget.incomeBudgets
    );
  }, [activeMonthId, currentBudget, transactions]);

  // Daily Auto-Sync Once a Day when app opens and Google Drive is connected
  useEffect(() => {
    if (!dailyAutoSync || !accessToken || isAutoSyncingDaily) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    if (!isDailySyncDue(currentBudget.lastSyncedAt, todayStr)) return;

    let cancelled = false;
    setIsAutoSyncingDaily(true);
    syncToGoogleDrive(
      accessToken,
      currentSummary,
      transactions,
      currentBudget,
      currentBudget.driveFileId
    )
      .then((res) => {
        if (cancelled) return;
        setMonths((prev) => ({
          ...prev,
          [activeMonthId]: {
            ...currentBudget,
            driveFileId: res.id,
            lastSyncedAt: Date.now(),
          },
        }));
      })
      .catch((err) => {
        console.error('Daily auto-sync error:', err);
      })
      .finally(() => {
        if (!cancelled) setIsAutoSyncingDaily(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dailyAutoSync, accessToken, activeMonthId, currentBudget, currentSummary, transactions, isAutoSyncingDaily]);

  // Summaries for all months (for historical comparison chart)
  const allMonthsSummaries = useMemo<MonthlySummary[]>(() => {
    return Object.keys(months)
      .sort((a, b) => b.localeCompare(a))
      .map((mId) => {
        const b = months[mId];
        return calculateSummary(
          mId,
          b.monthName,
          b.startBalance,
          transactions,
          b.expenseBudgets,
          b.incomeBudgets
        );
      });
  }, [months, transactions]);

  // Handlers for Transactions — Always route to the month matching `tx.date`
  const handleAddTransaction = (newTx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const derivedMonthId = getMonthIdFromDate(newTx.date);
    ensureMonthBoardExists(derivedMonthId);

    const item: Transaction = {
      ...newTx,
      monthId: derivedMonthId,
      weekNumber: calculateWeekNumber(newTx.date),
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
    };
    setTransactions((prev) => [item, ...prev]);
    // Switch activeMonthId to the transaction's month so the user sees their updated board
    setActiveMonthId(derivedMonthId);
  };

  const handleUpdateTransaction = (updatedTx: Transaction) => {
    const derivedMonthId = getMonthIdFromDate(updatedTx.date);
    ensureMonthBoardExists(derivedMonthId);

    const normalized: Transaction = {
      ...updatedTx,
      monthId: derivedMonthId,
      weekNumber: calculateWeekNumber(updatedTx.date),
    };

    setTransactions((prev) =>
      prev.map((t) => (t.id === normalized.id ? normalized : t))
    );
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // Handlers for Budget & Category updates
  const handleUpdateBudget = (updated: MonthlyBudget) => {
    setMonths((prev) => ({
      ...prev,
      [updated.monthId]: updated,
    }));
  };

  // Rename category across the active month (and all template months) + existing transactions
  const handleRenameCategory = (oldName: string, newName: string, type: 'expense' | 'income') => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;

    setMonths((prev) => {
      const next: Record<string, MonthlyBudget> = {};
      for (const [mId, b] of Object.entries(prev)) {
        if (type === 'expense') {
          const updatedMap: Record<string, number> = {};
          for (const [k, v] of Object.entries(b.expenseBudgets)) {
            if (k === oldName) {
              updatedMap[trimmed] = v;
            } else {
              updatedMap[k] = v;
            }
          }
          next[mId] = { ...b, expenseBudgets: updatedMap };
        } else {
          const updatedMap: Record<string, number> = {};
          for (const [k, v] of Object.entries(b.incomeBudgets)) {
            if (k === oldName) {
              updatedMap[trimmed] = v;
            } else {
              updatedMap[k] = v;
            }
          }
          next[mId] = { ...b, incomeBudgets: updatedMap };
        }
      }
      return next;
    });

    setTransactions((prev) =>
      prev.map((t) =>
        t.type === type && t.category === oldName ? { ...t, category: trimmed } : t
      )
    );
  };

  // Delete category from budgets
  const handleDeleteCategory = (catName: string, type: 'expense' | 'income') => {
    setMonths((prev) => {
      const next: Record<string, MonthlyBudget> = {};
      for (const [mId, b] of Object.entries(prev)) {
        if (type === 'expense') {
          const copy = { ...b.expenseBudgets };
          delete copy[catName];
          next[mId] = { ...b, expenseBudgets: copy };
        } else {
          const copy = { ...b.incomeBudgets };
          delete copy[catName];
          next[mId] = { ...b, incomeBudgets: copy };
        }
      }
      return next;
    });
  };

  const handleResetToDefaults = () => {
    setMonths({
      '2026-11': {
        monthId: INITIAL_MONTH_ID,
        monthName: INITIAL_MONTH_NAME,
        startBalance: 0,
        expenseBudgets: INITIAL_EXPENSE_BUDGETS_NOV,
        incomeBudgets: INITIAL_INCOME_BUDGETS_NOV,
      },
      '2026-10': INITIAL_MONTH_OCT,
    });
    setTransactions([...INITIAL_TRANSACTIONS_NOV, ...INITIAL_TRANSACTIONS_OCT]);
  };

  // Create a new month board explicitly
  const handleCreateMonth = (monthId: string, startBalanceVal = 0) => {
    if (!/^\d{4}-\d{2}$/.test(monthId)) return;
    ensureMonthBoardExists(monthId, startBalanceVal);
    setActiveMonthId(monthId);
  };

  const handleNewMonthModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(newMonthInput)) return;
    const bal = parseFloat(newMonthStartBalance) || 0;
    handleCreateMonth(newMonthInput, bal);
    setIsNewMonthModalOpen(false);
    setActiveTab('summary');
  };

  // Import handler
  const handleImportTransactions = (
    imported: Transaction[],
    targetMonthId: string,
    targetMonthName: string
  ) => {
    if (!months[targetMonthId]) {
      setMonths((prev) => ({
        ...prev,
        [targetMonthId]: {
          monthId: targetMonthId,
          monthName: targetMonthName,
          startBalance: 0,
          expenseBudgets: { ... currentBudget.expenseBudgets },
          incomeBudgets: { ... currentBudget.incomeBudgets },
        },
      }));
    }

    setTransactions((prev) => [...imported, ...prev]);
    setActiveMonthId(targetMonthId);
    setActiveTab('dashboard');
  };

  const handleImportFromDriveFile = async (file: DriveFileInfo) => {
    if (!accessToken) return;
    try {
      const items = await importTransactionsFromGoogleSheet(
        accessToken,
        file.id,
        activeMonthId
      );
      if (items.length > 0) {
        handleImportTransactions(items, activeMonthId, file.name);
        setIsDriveModalOpen(false);
      }
    } catch (e: any) {
      console.error('Import error:', e);
    }
  };

  const openAddModalFromView = (type: TransactionType = 'expense', defaultCat?: string) => {
    setQuickAddType(type);
    setQuickAddCat(defaultCat);
    setQuickAddDate(new Date().toISOString().slice(0, 10));
    setQuickAddDesc('');
    setQuickAddAmount('');
    setIsQuickAddOpen(true);
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(quickAddAmount);
    if (isNaN(amt) || amt <= 0) return;

    const cat =
      quickAddCat ||
      (quickAddType === 'expense'
        ? currentSummary.expenseCategoryTotals[0]?.category || DEFAULT_EXPENSE_CATEGORIES[0]
        : currentSummary.incomeCategoryTotals[0]?.category || DEFAULT_INCOME_CATEGORIES[1]);

    const targetMonthId = getMonthIdFromDate(quickAddDate);

    handleAddTransaction({
      monthId: targetMonthId,
      date: quickAddDate,
      type: quickAddType,
      category: cat,
      description: quickAddDesc.trim() || `${cat} ${quickAddType}`,
      amount: amt,
      weekNumber: calculateWeekNumber(quickAddDate),
    });

    setIsQuickAddOpen(false);
  };

  // Theme-aware utility classes (60-30-10 rule)
  const canvasClass = isDark ? 'bg-[#0A0A0B] text-zinc-100' : 'bg-[#F8F9FA] text-zinc-900';
  const navSurfaceClass = isDark ? 'bg-[#121214] border-[#262626]' : 'bg-white border-[#E5E5E5]';
  const borderClass = isDark ? 'border-[#262626]' : 'border-[#E5E5E5]';
  const textMuted = isDark ? 'text-zinc-400' : 'text-zinc-500';
  const textSubtle = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const subtleBtn = isDark
    ? 'bg-[#18181B] border-[#262626] text-zinc-300 hover:text-white'
    : 'bg-[#F4F4F5] border-[#E5E5E5] text-zinc-700 hover:text-black';

  return (
    <div className={`min-h-screen flex flex-col font-sans antialiased transition-colors duration-150 ${canvasClass}`}>
      {/* Sticky High-End Application Header */}
      <header className={`sticky top-0 z-40 border-b ${navSurfaceClass}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="min-h-14 py-2 sm:py-0 flex items-center justify-between gap-1.5 sm:gap-3">
            {/* Left brand & Month Switcher + New Month Creator */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="font-mono text-xs font-semibold px-2 py-1 rounded border border-amber-500/30 text-amber-500 cursor-pointer shrink-0"
                title="Go to Quick Entry Home"
              >
                ₹
              </button>

              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span className="hidden lg:inline text-sm font-medium tracking-tight truncate">
                  {currentBudget.monthName}
                </span>

                {/* Select Month Dropdown */}
                <div className="relative min-w-0">
                  <select
                    value={activeMonthId}
                    onChange={(e) => setActiveMonthId(e.target.value)}
                    className={`w-full max-w-[132px] sm:max-w-none truncate text-xs font-mono font-medium rounded-md px-2 sm:px-2.5 py-1.5 pr-6 sm:pr-7 border ${borderClass} ${subtleBtn} cursor-pointer focus:outline-none appearance-none`}
                    aria-label="Select ledger month"
                  >
                    {Object.keys(months)
                      .sort((a, b) => b.localeCompare(a))
                      .map((mId) => (
                        <option key={mId} value={mId}>
                          {months[mId]?.monthName || mId}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                </div>

                {/* Create New Month Board Button */}
                <button
                  type="button"
                  onClick={() => {
                    const sorted = Object.keys(months).sort((a, b) => b.localeCompare(a));
                    const latest = sorted[0] || '2026-11';
                    const [yr, mo] = latest.split('-').map(Number);
                    const nextYr = mo === 12 ? yr + 1 : yr;
                    const nextMo = mo === 12 ? 1 : mo + 1;
                    setNewMonthInput(`${nextYr}-${String(nextMo).padStart(2, '0')}`);
                    setNewMonthStartBalance('0');
                    setIsNewMonthModalOpen(true);
                  }}
                  className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-md text-xs font-medium border ${borderClass} ${subtleBtn} transition-colors cursor-pointer shrink-0`}
                  title="Create a new monthly board from template"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">New Month</span>
                </button>
              </div>
            </div>

            {/* Right Action Bar */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Explicit Light / Dark Theme Toggle */}
              <button
                type="button"
                onClick={() => setIsDark((prev) => !prev)}
                aria-label="Toggle visual theme"
                className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md text-xs font-medium border ${borderClass} ${subtleBtn} transition-colors cursor-pointer`}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden md:inline">Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Dark Mode</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium border ${borderClass} ${subtleBtn} transition-colors cursor-pointer`}
                title="Import Transactions"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Import</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDriveModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium border ${borderClass} ${subtleBtn} transition-colors cursor-pointer whitespace-nowrap`}
              >
                <Cloud className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Drive </span>
                <span>Sync</span>
              </button>

              {currentUser && (
                <button
                  type="button"
                  onClick={() => setIsDriveModalOpen(true)}
                  className="p-1 rounded-md transition-colors cursor-pointer"
                  title={`Signed in: ${currentUser.email}`}
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt=""
                      className="w-6 h-6 rounded-full border border-zinc-700"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-mono flex items-center justify-center">
                      {currentUser.displayName ? currentUser.displayName[0] : 'G'}
                    </div>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Minimalist Segmented Navigation Tabs */}
          <nav className={`flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar py-1.5 border-t ${borderClass}`}>
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'home'
                  ? isDark
                    ? 'bg-zinc-800 text-zinc-100 shadow-2xs'
                    : 'bg-zinc-200 text-zinc-900 shadow-2xs'
                  : `${textMuted} hover:text-inherit`
              }`}
            >
              Quick Entry
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'summary'
                  ? isDark
                    ? 'bg-zinc-800 text-zinc-100 shadow-2xs'
                    : 'bg-zinc-200 text-zinc-900 shadow-2xs'
                  : `${textMuted} hover:text-inherit`
              }`}
            >
              Summary Board
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'dashboard'
                  ? isDark
                    ? 'bg-zinc-800 text-zinc-100 shadow-2xs'
                    : 'bg-zinc-200 text-zinc-900 shadow-2xs'
                  : `${textMuted} hover:text-inherit`
              }`}
            >
              Graphical Dashboard
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'transactions'
                  ? isDark
                    ? 'bg-zinc-800 text-zinc-100 shadow-2xs'
                    : 'bg-zinc-200 text-zinc-900 shadow-2xs'
                  : `${textMuted} hover:text-inherit`
              }`}
            >
              Transactions
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${borderClass} opacity-80`}>
                {transactions.filter((t) => t.monthId === activeMonthId).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'week'
                  ? isDark
                    ? 'bg-zinc-800 text-zinc-100 shadow-2xs'
                    : 'bg-zinc-200 text-zinc-900 shadow-2xs'
                  : `${textMuted} hover:text-inherit`
              }`}
            >
              Weekly Breakdown
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('category')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'category'
                  ? isDark
                    ? 'bg-zinc-800 text-zinc-100 shadow-2xs'
                    : 'bg-zinc-200 text-zinc-900 shadow-2xs'
                  : `${textMuted} hover:text-inherit`
              }`}
            >
              Categories &amp; Targets
            </button>
          </nav>
        </div>
      </header>

      {/* Main Structural Layout with generous negative space */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 flex-1 w-full">
        {activeTab === 'home' && (
          <QuickEntryHomeView
            activeMonthId={activeMonthId}
            currentSummary={currentSummary}
            months={months}
            recentTransactions={transactions}
            expenseCategories={currentSummary.expenseCategoryTotals.map((c) => c.category)}
            incomeCategories={currentSummary.incomeCategoryTotals.map((c) => c.category)}
            onAddTransaction={handleAddTransaction}
            onSelectMonth={(mId) => setActiveMonthId(mId)}
            onCreateMonth={(mId) => handleCreateMonth(mId, 0)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            isDark={isDark}
          />
        )}

        {activeTab === 'summary' && (
          <SummaryView
            summary={currentSummary}
            budget={currentBudget}
            onOpenAddModal={openAddModalFromView}
            onNavigateToTab={(tab) => setActiveTab(tab as AppTab)}
            onOpenSyncModal={() => setIsDriveModalOpen(true)}
            isDark={isDark}
          />
        )}

        {activeTab === 'dashboard' && (
          <GraphicalDashboardView
            summary={currentSummary}
            transactions={transactions}
            allMonthsSummaries={allMonthsSummaries}
            onSelectMonth={(mId) => setActiveMonthId(mId)}
            onOpenAddModal={openAddModalFromView}
            isDark={isDark}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={transactions}
            monthId={activeMonthId}
            categories={currentSummary.expenseCategoryTotals.map((c) => c.category)}
            incomeCategories={currentSummary.incomeCategoryTotals.map((c) => c.category)}
            onAddTransaction={handleAddTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            isDark={isDark}
          />
        )}

        {activeTab === 'week' && (
          <ExpensesByWeekView
            summary={currentSummary}
            transactions={transactions}
            onOpenAddModal={openAddModalFromView}
            isDark={isDark}
          />
        )}

        {activeTab === 'category' && (
          <CategoryManagerView
            budget={currentBudget}
            onUpdateBudget={handleUpdateBudget}
            onRenameCategory={handleRenameCategory}
            onDeleteCategory={handleDeleteCategory}
            onResetToDefaults={handleResetToDefaults}
            isDark={isDark}
          />
        )}
      </main>

      {/* Create New Month Modal */}
      {isNewMonthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`border rounded-lg shadow-2xl max-w-sm w-full p-6 space-y-4 ${
              isDark ? 'bg-[#121214] border-[#262626] text-zinc-100' : 'bg-white border-[#E5E5E5] text-zinc-900'
            }`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${borderClass}`}>
              <h3 className="text-sm font-medium tracking-tight">
                Create Monthly Template Board
              </h3>
              <button
                type="button"
                onClick={() => setIsNewMonthModalOpen(false)}
                className={`${textSubtle} hover:${textMuted} text-xs font-mono cursor-pointer`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleNewMonthModalSubmit} className="space-y-4">
              <p className={`text-xs ${textMuted}`}>
                Generates a fresh monthly board following your category template and planned limits.
              </p>

              <div>
                <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                  Select Month (YYYY-MM)
                </label>
                <input
                  type="month"
                  required
                  value={newMonthInput}
                  onChange={(e) => setNewMonthInput(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md text-xs font-mono border ${borderClass} ${
                    isDark ? 'bg-[#18181B]' : 'bg-[#F4F4F5]'
                  } focus:outline-none focus:ring-1 focus:ring-amber-500`}
                />
                {newMonthInput && (
                  <span className={`block text-[11px] font-mono ${textSubtle} mt-1`}>
                    Board Title: <strong>{formatMonthIdToName(newMonthInput)}</strong>
                  </span>
                )}
              </div>

              <div>
                <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                  Starting Balance (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newMonthStartBalance}
                  onChange={(e) => setNewMonthStartBalance(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md text-xs font-mono border ${borderClass} ${
                    isDark ? 'bg-[#18181B]' : 'bg-[#F4F4F5]'
                  } focus:outline-none focus:ring-1 focus:ring-amber-500`}
                />
              </div>

              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${borderClass}`}>
                <button
                  type="button"
                  onClick={() => setIsNewMonthModalOpen(false)}
                  className={`px-3 py-1.5 rounded-md text-xs border ${borderClass} ${textMuted} hover:text-inherit cursor-pointer`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-medium rounded-md shadow-2xs cursor-pointer"
                >
                  Create &amp; Open Board
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`border rounded-lg shadow-2xl max-w-sm w-full p-6 space-y-4 ${isDark ? 'bg-[#121214] border-[#262626] text-zinc-100' : 'bg-white border-[#E5E5E5] text-zinc-900'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${borderClass}`}>
              <h3 className="text-sm font-medium tracking-tight">
                Quick Record: {quickAddType === 'expense' ? 'Expense' : 'Income'}
              </h3>
              <button
                onClick={() => setIsQuickAddOpen(false)}
                className={`${textSubtle} hover:${textMuted} text-xs font-mono cursor-pointer`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-3.5">
              <div>
                <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  required
                  placeholder="0.00"
                  value={quickAddAmount}
                  onChange={(e) => setQuickAddAmount(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${isDark ? 'bg-[#18181B]' : 'bg-[#F4F4F5]'} focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                  Category
                </label>
                <select
                  value={
                    quickAddCat ||
                    (quickAddType === 'expense'
                      ? currentSummary.expenseCategoryTotals[0]?.category
                      : currentSummary.incomeCategoryTotals[0]?.category)
                  }
                  onChange={(e) => setQuickAddCat(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-md text-xs border ${borderClass} ${isDark ? 'bg-[#18181B]' : 'bg-[#F4F4F5]'} focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
                >
                  {(quickAddType === 'expense'
                    ? currentSummary.expenseCategoryTotals
                    : currentSummary.incomeCategoryTotals
                  ).map((c) => (
                    <option key={c.category} value={c.category}>
                      {c.category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                  Description / Item
                </label>
                <input
                  type="text"
                  placeholder="e.g. Supermarket, Cab, Electricity"
                  value={quickAddDesc}
                  onChange={(e) => setQuickAddDesc(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-md text-xs border ${borderClass} ${isDark ? 'bg-[#18181B]' : 'bg-[#F4F4F5]'} focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                  Date (Auto-routes to month)
                </label>
                <input
                  type="date"
                  required
                  value={quickAddDate}
                  onChange={(e) => setQuickAddDate(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${isDark ? 'bg-[#18181B]' : 'bg-[#F4F4F5]'} focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
                />
                <span className={`block text-[10px] font-mono ${textSubtle} mt-1`}>
                  Target Board: {formatMonthIdToName(getMonthIdFromDate(quickAddDate))}
                </span>
              </div>

              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${borderClass}`}>
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className={`px-3 py-1.5 rounded-md text-xs border ${borderClass} ${textMuted} hover:text-inherit cursor-pointer`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-medium rounded-md shadow-2xs cursor-pointer"
                >
                  Confirm Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drive Sync Modal */}
      <DriveSyncModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        summary={currentSummary}
        transactions={transactions}
        budget={currentBudget}
        currentUser={currentUser}
        accessToken={accessToken}
        onAuthSuccess={(user, token) => {
          setCurrentUser(user);
          setAccessToken(token);
        }}
        onAuthLogout={() => {
          setCurrentUser(null);
          setAccessToken(null);
        }}
        onImportDriveSheet={handleImportFromDriveFile}
        onUpdateBudget={handleUpdateBudget}
        dailyAutoSync={dailyAutoSync}
        onToggleDailyAutoSync={(enabled) => {
          setDailyAutoSync(enabled);
          localStorage.setItem('expense_app_daily_autosync', String(enabled));
        }}
        isDark={isDark}
      />

      {/* Import Transactions Modal */}
      <ImportTransactionsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        currentMonthId={activeMonthId}
        onImportTransactions={handleImportTransactions}
        isDark={isDark}
      />
    </div>
  );
}
