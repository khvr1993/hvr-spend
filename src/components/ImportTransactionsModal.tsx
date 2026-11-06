import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Transaction } from '../types';
import { parseCSVTransactions, calculateWeekNumber } from '../utils/expenseCalculations';
import {
  Upload,
  FileSpreadsheet,
  Check,
  X,
  ArrowRight,
} from 'lucide-react';

interface ImportTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonthId: string;
  onImportTransactions: (
    transactions: Transaction[],
    targetMonthId: string,
    targetMonthName: string
  ) => void;
  isDark?: boolean;
}

export const ImportTransactionsModal: React.FC<ImportTransactionsModalProps> = ({
  isOpen,
  onClose,
  currentMonthId,
  onImportTransactions,
  isDark = true,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetMonth, setTargetMonth] = useState('2026-09');
  const [targetMonthName, setTargetMonthName] = useState('Sep-26 Expenses');
  const [parsedPreview, setParsedPreview] = useState<Partial<Transaction>[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeMode, setActiveMode] = useState<'upload' | 'sample'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const sheetName =
        wb.SheetNames.find((n) => n.toLowerCase().includes('transaction')) ||
        wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws);

      const items = parseCSVTransactions(csv, targetMonth);
      if (items.length === 0) {
        throw new Error('No valid transactions parsed. Ensure columns include Date, Category, Amount.');
      }
      setParsedPreview(items);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to parse file');
      setParsedPreview([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSamplePreviousMonth = () => {
    const sepTxs: Partial<Transaction>[] = [
      {
        date: '2026-09-01',
        type: 'income',
        category: 'Paycheck',
        description: 'September Monthly Salary',
        amount: 250000,
        weekNumber: 1,
        monthId: '2026-09',
      },
      {
        date: '2026-09-02',
        type: 'expense',
        category: 'Bills and Debt',
        description: 'Housing rent payment',
        amount: 19000,
        weekNumber: 1,
        monthId: '2026-09',
      },
      {
        date: '2026-09-05',
        type: 'expense',
        category: 'Food',
        description: 'Supermarket supplies',
        amount: 3200,
        weekNumber: 1,
        monthId: '2026-09',
      },
      {
        date: '2026-09-10',
        type: 'expense',
        category: 'Transportation',
        description: 'Monthly metro & transit',
        amount: 4500,
        weekNumber: 2,
        monthId: '2026-09',
      },
      {
        date: '2026-09-15',
        type: 'expense',
        category: 'Shopping',
        description: 'Hardware accessories',
        amount: 5400,
        weekNumber: 3,
        monthId: '2026-09',
      },
      {
        date: '2026-09-22',
        type: 'expense',
        category: 'Guilt free',
        description: 'Weekend dinner',
        amount: 3800,
        weekNumber: 4,
        monthId: '2026-09',
      },
      {
        date: '2026-09-28',
        type: 'expense',
        category: 'Entertainment & Leisure',
        description: 'Entertainment passes',
        amount: 2200,
        weekNumber: 4,
        monthId: '2026-09',
      },
    ];

    setTargetMonth('2026-09');
    setTargetMonthName('Sep-26 Expenses');
    setParsedPreview(sepTxs);
    setSelectedFile(null);
    setErrorMsg(null);
  };

  const handleConfirmImport = () => {
    if (parsedPreview.length === 0) return;

    const finalTransactions: Transaction[] = parsedPreview.map((item, idx) => ({
      id: `imported-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      monthId: item.monthId || targetMonth,
      date: item.date || `${targetMonth}-01`,
      type: item.type || 'expense',
      category: item.category || 'Other',
      description: item.description || 'Imported item',
      amount: item.amount || 0,
      weekNumber: item.weekNumber || calculateWeekNumber(item.date || `${targetMonth}-01`),
      notes: item.notes || 'Imported ledger',
      createdAt: Date.now() + idx,
    }));

    onImportTransactions(finalTransactions, targetMonth, targetMonthName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`border rounded-lg shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] ${surfaceClass}`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${borderClass} flex items-center justify-between ${subtleSurfaceClass}`}>
          <div>
            <h3 className="text-sm font-medium tracking-tight">
              Import Previous Ledger Data
            </h3>
            <p className={`text-xs ${textMuted} mt-0.5`}>
              Upload Excel (.xlsx, .xls) or CSV records to build historical analytics
            </p>
          </div>
          <button
            onClick={onClose}
            className={`${textSubtle} hover:${textMuted} p-1`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Target Month Identifier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                Month Code
              </label>
              <input
                type="text"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                placeholder="YYYY-MM"
                className={`w-full px-3 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
              />
            </div>
            <div>
              <label className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1`}>
                Ledger Label
              </label>
              <input
                type="text"
                value={targetMonthName}
                onChange={(e) => setTargetMonthName(e.target.value)}
                placeholder="e.g. Sep-26 Expenses"
                className={`w-full px-3 py-1.5 rounded-md text-xs border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
              />
            </div>
          </div>

          {/* Mode Switcher */}
          <div className={`flex items-center gap-4 border-b ${borderClass} pb-2 text-xs font-mono`}>
            <button
              onClick={() => setActiveMode('upload')}
              className={`pb-1 border-b transition-colors cursor-pointer ${
                activeMode === 'upload'
                  ? 'border-amber-500 text-amber-500'
                  : `border-transparent ${textMuted} hover:text-inherit`
              }`}
            >
              Upload Local File
            </button>
            <button
              onClick={() => {
                setActiveMode('sample');
                handleLoadSamplePreviousMonth();
              }}
              className={`pb-1 border-b transition-colors cursor-pointer ${
                activeMode === 'sample'
                  ? 'border-amber-500 text-amber-500'
                  : `border-transparent ${textMuted} hover:text-inherit`
              }`}
            >
              Load Sample (Sep-26)
            </button>
          </div>

          {activeMode === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed ${borderClass} hover:border-zinc-500 ${subtleSurfaceClass} rounded-lg p-8 text-center cursor-pointer transition-colors`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileSpreadsheet className={`w-8 h-8 ${textSubtle} mx-auto mb-2`} />
              <p className="text-xs font-medium">
                {selectedFile ? selectedFile.name : 'Select or drop Excel (.xlsx) / CSV file'}
              </p>
              <p className={`text-[11px] ${textSubtle} mt-1 font-mono`}>
                Columns: Date, Category, Amount, Description
              </p>
            </div>
          )}

          {errorMsg && (
            <div className={`p-3 rounded-md border ${borderClass} ${subtleSurfaceClass} text-xs text-amber-500 font-mono`}>
              {errorMsg}
            </div>
          )}

          {/* Parsed Preview */}
          {parsedPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 font-medium">
                  <Check className="w-3.5 h-3.5 text-amber-500 stroke-[2.5]" />
                  Parsed {parsedPreview.length} records
                </span>
                <span className={textMuted}>Target: {targetMonthName}</span>
              </div>

              <div className={`max-h-44 overflow-y-auto divide-y ${borderClass} border ${borderClass} rounded-md`}>
                {parsedPreview.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 text-xs flex items-center justify-between ${subtleSurfaceClass}`}
                  >
                    <div>
                      <span className="font-medium">{item.description}</span>
                      <span className={`text-[11px] font-mono ${textSubtle} ml-3`}>{item.date}</span>
                      <span className={`block text-[10px] ${textSubtle}`}>{item.category}</span>
                    </div>
                    <span className="font-mono font-medium tabular-nums">
                      {item.type === 'income' ? '+' : '-'}₹{item.amount?.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-3 border-t ${borderClass} ${subtleSurfaceClass} flex items-center justify-between`}>
          <button
            onClick={onClose}
            className={`px-3 py-1.5 text-xs font-mono ${textMuted} hover:text-inherit cursor-pointer`}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={parsedPreview.length === 0}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              parsedPreview.length > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-2xs'
                : 'opacity-40 bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            Import Into Ledger
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
