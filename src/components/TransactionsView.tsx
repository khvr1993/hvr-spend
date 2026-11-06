import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import {
  formatINR,
  calculateWeekNumber,
  exportTransactionsToCSV,
} from '../utils/expenseCalculations';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  X,
  FileSpreadsheet,
  Download,
} from 'lucide-react';

interface TransactionsViewProps {
  transactions: Transaction[];
  monthId: string;
  categories: string[];
  incomeCategories: string[];
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onOpenImportModal: () => void;
  isDark?: boolean;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  monthId,
  categories,
  incomeCategories,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onOpenImportModal,
  isDark = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [weekFilter, setWeekFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formCategory, setFormCategory] = useState(categories[0] || 'Food');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

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

  // Filtered transactions for current month
  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => t.monthId === monthId);
  }, [transactions, monthId]);

  const filteredTransactions = useMemo(() => {
    return monthTransactions
      .filter((t) => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        if (weekFilter !== 'all' && String(t.weekNumber || 1) !== weekFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchDesc = t.description.toLowerCase().includes(q);
          const matchCat = t.category.toLowerCase().includes(q);
          const matchNotes = (t.notes || '').toLowerCase().includes(q);
          const matchAmt = String(t.amount).includes(q);
          if (!matchDesc && !matchCat && !matchNotes && !matchAmt) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') return b.date.localeCompare(a.date);
        if (sortBy === 'date-asc') return a.date.localeCompare(b.date);
        if (sortBy === 'amount-desc') return b.amount - a.amount;
        if (sortBy === 'amount-asc') return a.amount - b.amount;
        return 0;
      });
  }, [monthTransactions, typeFilter, categoryFilter, weekFilter, searchQuery, sortBy]);

  const totalFilteredExpenses = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalFilteredIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const handleOpenAddModal = (type: TransactionType = 'expense', defaultCat?: string) => {
    setEditingTransaction(null);
    setFormType(type);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormCategory(defaultCat || (type === 'expense' ? categories[0] : incomeCategories[0]));
    setFormDesc('');
    setFormAmount('');
    setFormNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: Transaction) => {
    setEditingTransaction(t);
    setFormType(t.type);
    setFormDate(t.date);
    setFormCategory(t.category);
    setFormDesc(t.description);
    setFormAmount(String(t.amount));
    setFormNotes(t.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Please specify a positive numerical amount.');
      return;
    }
    if (!formDesc.trim()) {
      setFormError('Please enter a description or vendor name.');
      return;
    }

    const weekNumber = calculateWeekNumber(formDate);

    if (editingTransaction) {
      onUpdateTransaction({
        ...editingTransaction,
        date: formDate,
        type: formType,
        category: formCategory,
        description: formDesc.trim(),
        amount: amt,
        weekNumber,
        notes: formNotes.trim(),
      });
    } else {
      onAddTransaction({
        monthId,
        date: formDate,
        type: formType,
        category: formCategory,
        description: formDesc.trim(),
        amount: amt,
        weekNumber,
        notes: formNotes.trim(),
      });
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (deletingId) {
      onDeleteTransaction(deletingId);
      setDeletingId(null);
    }
  };

  const handleDownloadCSV = () => {
    const csvContent = exportTransactionsToCSV(monthTransactions, monthId);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${monthId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Search & Rigid Control Bar */}
      <div className={`border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${surfaceClass}`}>
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${textSubtle}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions by vendor, notes, category..."
            className={`w-full pl-9 pr-4 py-1.5 rounded-md text-xs font-sans border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 ${textSubtle} hover:${textMuted}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none`}
          >
            <option value="all">All Types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none max-w-[140px]`}
          >
            <option value="all">All Categories</option>
            {Array.from(new Set([...categories, ...incomeCategories])).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none`}
          >
            <option value="all">All Weeks</option>
            <option value="1">Week 1 (1–7)</option>
            <option value="2">Week 2 (8–14)</option>
            <option value="3">Week 3 (15–21)</option>
            <option value="4">Week 4 (22–28)</option>
            <option value="5">Week 5 (29–31)</option>
          </select>

          <button
            onClick={() => handleOpenAddModal('expense')}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            New
          </button>
          <button
            onClick={onOpenImportModal}
            className={`px-3 py-1.5 border ${borderClass} ${subtleSurfaceClass} rounded-md text-xs font-medium hover:opacity-80 transition-opacity flex items-center gap-1.5 cursor-pointer`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
            Import
          </button>
          <button
            onClick={handleDownloadCSV}
            title="Download transactions CSV for this month"
            className={`px-3 py-1.5 border ${borderClass} ${subtleSurfaceClass} rounded-md text-xs font-medium hover:opacity-80 transition-opacity flex items-center gap-1.5 cursor-pointer`}
          >
            <Download className="w-3.5 h-3.5 text-amber-500" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className={`border rounded-lg px-6 py-3 flex flex-wrap items-center justify-between text-xs font-mono ${subtleSurfaceClass}`}>
        <div className="flex items-center gap-4">
          <span className={textMuted}>
            Showing <strong className="text-inherit font-medium">{filteredTransactions.length}</strong> of {monthTransactions.length} items
          </span>
        </div>
        <div className="flex items-center gap-6 tabular-nums">
          <span className={textMuted}>
            Expenses: <strong className="text-inherit font-medium">{formatINR(totalFilteredExpenses)}</strong>
          </span>
          <span className={textMuted}>
            Income: <strong className="text-inherit font-medium">{formatINR(totalFilteredIncome)}</strong>
          </span>
        </div>
      </div>

      {/* Modern Ledger Grid */}
      <div className={`border rounded-lg overflow-hidden ${surfaceClass}`}>
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-sm font-medium">No transactions found</p>
            <p className={`text-xs ${textMuted} mt-1`}>
              No records match your active search or filters.
            </p>
            <button
              onClick={() => handleOpenAddModal('expense')}
              className="mt-4 px-4 py-1.5 bg-amber-500 text-zinc-950 rounded-md text-xs font-medium hover:bg-amber-400 cursor-pointer"
            >
              + Record Transaction
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${borderClass} ${subtleSurfaceClass} ${textMuted} font-medium tracking-wider uppercase text-[10px]`}>
                  <th className="py-2.5 px-6">Date</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-6">Description</th>
                  <th className="py-2.5 px-4">Week</th>
                  <th className="py-2.5 px-6 text-right">Amount</th>
                  <th className="py-2.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderClass} font-normal tabular-nums`}>
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className={`${rowHover} transition-colors group`}>
                    <td className={`py-3 px-6 font-mono ${textMuted} whitespace-nowrap`}>
                      {t.date}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono ${textMuted}`}>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            t.type === 'expense' ? 'bg-zinc-400' : 'bg-amber-500'
                          }`}
                        ></span>
                        {t.type === 'expense' ? 'Expense' : 'Income'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium whitespace-nowrap">
                      {t.category}
                    </td>
                    <td className="py-3 px-6">
                      <div className="max-w-xs md:max-w-md truncate font-medium text-inherit">
                        {t.description}
                      </div>
                      {t.notes && (
                        <div className={`text-[11px] ${textSubtle} truncate mt-0.5 font-sans`}>
                          {t.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${borderClass} ${subtleSurfaceClass} ${textMuted}`}>
                        W{t.weekNumber || 1}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right whitespace-nowrap font-mono font-medium">
                      <span className={t.type === 'income' ? 'text-amber-500' : 'text-inherit'}>
                        {t.type === 'expense' ? '-' : '+'}
                        {formatINR(t.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          aria-label={`Edit ${t.description}`}
                          className={`p-1.5 ${textSubtle} hover:text-inherit rounded transition-colors cursor-pointer`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingId(t.id)}
                          aria-label={`Delete ${t.description}`}
                          className={`p-1.5 ${textSubtle} hover:text-amber-500 rounded transition-colors cursor-pointer`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`border rounded-lg shadow-2xl max-w-md w-full overflow-hidden ${surfaceClass}`}>
            <div className={`px-6 py-4 border-b ${borderClass} flex items-center justify-between`}>
              <h3 className="text-sm font-medium tracking-tight">
                {editingTransaction ? 'Edit Transaction' : 'Record Transaction'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`${textSubtle} hover:${textMuted} p-1`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className={`p-3 rounded-md border ${borderClass} ${subtleSurfaceClass} text-xs text-amber-500 font-medium`}>
                  {formError}
                </div>
              )}

              {/* Type Switcher */}
              <div>
                <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1.5`}>
                  Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('expense');
                      setFormCategory(categories[0] || 'Food');
                    }}
                    className={`py-1.5 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      formType === 'expense'
                        ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                        : `${borderClass} ${subtleSurfaceClass} ${textMuted}`
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('income');
                      setFormCategory(incomeCategories[0] || 'Paycheck');
                    }}
                    className={`py-1.5 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      formType === 'income'
                        ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                        : `${borderClass} ${subtleSurfaceClass} ${textMuted}`
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              {/* Amount and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full px-3 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-md text-xs border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
                >
                  {(formType === 'expense' ? categories : incomeCategories).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                  Description / Item
                </label>
                <input
                  type="text"
                  required
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="e.g. Supermarket, Cab, Electricity bill"
                  className={`w-full px-3 py-1.5 rounded-md text-xs border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
                />
              </div>

              {/* Notes */}
              <div>
                <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Payment receipt / metadata"
                  className={`w-full px-3 py-1.5 rounded-md text-xs border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
                />
              </div>

              <div className={`pt-4 border-t ${borderClass} flex items-center justify-end gap-2`}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-3.5 py-1.5 rounded-md text-xs border ${borderClass} ${subtleSurfaceClass} ${textMuted} hover:text-inherit cursor-pointer`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-medium rounded-md shadow-2xs cursor-pointer"
                >
                  {editingTransaction ? 'Save Changes' : 'Confirm Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`border rounded-lg shadow-2xl max-w-sm w-full p-6 space-y-4 ${surfaceClass}`}>
            <h4 className="text-sm font-medium tracking-tight">Delete record?</h4>
            <p className={`text-xs ${textMuted} leading-relaxed`}>
              Are you sure you want to permanently delete this transaction? All associated monthly calculations will update automatically.
            </p>
            <div className={`flex items-center justify-end gap-2 pt-3 border-t ${borderClass}`}>
              <button
                onClick={() => setDeletingId(null)}
                className={`px-3 py-1.5 rounded-md text-xs border ${borderClass} ${subtleSurfaceClass} ${textMuted} hover:text-inherit cursor-pointer`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-zinc-200 dark:bg-zinc-100 text-zinc-950 text-xs font-medium rounded-md hover:bg-white cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
