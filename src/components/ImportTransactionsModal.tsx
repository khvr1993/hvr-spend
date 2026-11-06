import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Transaction } from '../types';
import {
  parseCSVTransactions,
  calculateWeekNumber,
  formatMonthIdToName,
  generateSampleCSVContent,
  filterDuplicateTransactions,
} from '../utils/expenseCalculations';
import {
  FileSpreadsheet,
  Check,
  X,
  ArrowRight,
  Download,
} from 'lucide-react';

interface ImportTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonthId: string;
  existingTransactions?: Transaction[];
  onImportTransactions: (
    transactions: Transaction[],
    targetMonthId: string,
    targetMonthName: string,
    includeDuplicates?: boolean
  ) => void;
  isDark?: boolean;
}

export const ImportTransactionsModal: React.FC<ImportTransactionsModalProps> = ({
  isOpen,
  onClose,
  currentMonthId,
  existingTransactions = [],
  onImportTransactions,
  isDark = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetMonth, setTargetMonth] = useState(currentMonthId || '2026-11');
  const [rawCsvCache, setRawCsvCache] = useState<string>('');
  const [allParsedItems, setAllParsedItems] = useState<Partial<Transaction>[]>([]);
  const [parsedPreview, setParsedPreview] = useState<Partial<Transaction>[]>([]);
  const [skippedDuplicatesCount, setSkippedDuplicatesCount] = useState<number>(0);
  const [includeDuplicates, setIncludeDuplicates] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingForTargetMonth = useMemo(
    () => existingTransactions.filter((t) => t.monthId === targetMonth),
    [existingTransactions, targetMonth]
  );

  // Sync default Month Code to active month when modal opens
  useEffect(() => {
    if (isOpen && currentMonthId) {
      setTargetMonth(currentMonthId);
    }
  }, [isOpen, currentMonthId]);

  // Re-parse and deduplicate with updated targetMonth if user changes Month Code after selecting a file
  useEffect(() => {
    if (rawCsvCache && /^\d{4}-\d{2}$/.test(targetMonth)) {
      const items = parseCSVTransactions(rawCsvCache, targetMonth);
      setAllParsedItems(items);
      const { unique, duplicateCount } = filterDuplicateTransactions(
        items,
        existingForTargetMonth
      );
      setParsedPreview(includeDuplicates ? items : unique);
      setSkippedDuplicatesCount(duplicateCount);
      if (!includeDuplicates && unique.length === 0 && duplicateCount > 0) {
        setErrorMsg(
          `All ${duplicateCount} transaction(s) in this file match existing entries in ${targetMonth} (same Date, Type, Category, Description & Amount).`
        );
      } else {
        setErrorMsg(null);
      }
    }
  }, [targetMonth, rawCsvCache, existingForTargetMonth, includeDuplicates]);

  if (!isOpen) return null;

  const derivedMonthName = formatMonthIdToName(targetMonth);

  // Surface classes
  const surfaceClass = isDark
    ? 'bg-[#121214] border-[#262626] text-zinc-100'
    : 'bg-white border-[#E5E5E5] text-zinc-900';

  const subtleSurfaceClass = isDark
    ? 'bg-[#18181B] border-[#262626]'
    : 'bg-[#F4F4F5] border-[#E5E5E5]';

  const textMuted = isDark ? 'text-zinc-400' : 'text-zinc-500';
  const textSubtle = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const borderClass = isDark ? 'border-[#262626] divide-[#262626]' : 'border-[#E5E5E5] divide-[#E5E5E5]';

  const handleDownloadSampleCSV = () => {
    const csvContent = generateSampleCSVContent(targetMonth);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample_expenses_${targetMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setErrorMsg(null);
    setSkippedDuplicatesCount(0);
    setIsProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const head = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8));
      const isZip =
        head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
      const oleMagic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
      const isOle = head.length >= 8 && oleMagic.every((b, i) => head[i] === b);

      let csv = '';
      if (isZip || isOle) {
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheetName =
          wb.SheetNames.find((n) => n.toLowerCase().includes('transaction')) ||
          wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        csv = XLSX.utils.sheet_to_csv(ws, { dateNF: 'yyyy-mm-dd' });
      } else {
        csv = new TextDecoder('utf-8').decode(buffer);
      }

      setRawCsvCache(csv);
      setIncludeDuplicates(false);
      const items = parseCSVTransactions(csv, targetMonth);
      if (items.length === 0) {
        throw new Error(
          'No valid transactions parsed. Download the Sample CSV to see the required columns (Date, Category, Description, Amount, Type).'
        );
      }

      setAllParsedItems(items);
      const { unique, duplicateCount } = filterDuplicateTransactions(
        items,
        existingForTargetMonth
      );
      setParsedPreview(unique);
      setSkippedDuplicatesCount(duplicateCount);
      if (unique.length === 0 && duplicateCount > 0) {
        setErrorMsg(
          `All ${duplicateCount} transaction(s) in this file match existing entries in ${targetMonth} (same Date, Type, Category, Description & Amount).`
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to parse file');
      setAllParsedItems([]);
      setParsedPreview([]);
      setSkippedDuplicatesCount(0);
      setRawCsvCache('');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = () => {
    if (parsedPreview.length === 0 || !/^\d{4}-\d{2}$/.test(targetMonth)) return;

    const finalTransactions: Transaction[] = parsedPreview.map((item, idx) => {
      const alignedDate =
        item.date && item.date.startsWith(targetMonth)
          ? item.date
          : `${targetMonth}-${(item.date || '01').slice(-2).replace(/[^0-9]/g, '') || '01'}`;

      return {
        id: `imported-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        monthId: targetMonth,
        date: alignedDate,
        type: item.type || 'expense',
        category: item.category || 'Other',
        description: item.description || 'Imported item',
        amount: Number(item.amount) || 0,
        weekNumber: calculateWeekNumber(alignedDate),
        notes: item.notes || 'Imported CSV/Excel',
        createdAt: Date.now() + idx,
      };
    });

    onImportTransactions(finalTransactions, targetMonth, derivedMonthName, includeDuplicates);
    setSelectedFile(null);
    setAllParsedItems([]);
    setParsedPreview([]);
    setSkippedDuplicatesCount(0);
    setIncludeDuplicates(false);
    setRawCsvCache('');
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`border rounded-lg shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] ${surfaceClass}`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${borderClass} flex items-center justify-between ${subtleSurfaceClass}`}>
          <div>
            <h3 className="text-sm font-medium tracking-tight">
              Import Transactions
            </h3>
            <p className={`text-xs ${textMuted} mt-0.5`}>
              Select a Month Code and upload your CSV or Excel (.xlsx) file
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${textSubtle} hover:${textMuted} p-1 cursor-pointer`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Month Code Selector & Download Sample CSV Button */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex-1">
              <label
                htmlFor="import-month-code"
                className={`block text-[11px] font-medium uppercase tracking-wider ${textSubtle} mb-1.5`}
              >
                Month Code (YYYY-MM)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="import-month-code"
                  type="month"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} focus:outline-none focus:ring-1 focus:ring-amber-500`}
                />
              </div>
              <span className={`block text-[11px] font-mono ${textMuted} mt-1`}>
                Target Board: <strong>{derivedMonthName}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={handleDownloadSampleCSV}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border ${borderClass} ${subtleSurfaceClass} hover:border-amber-500/50 transition-colors cursor-pointer shrink-0 sm:mb-5`}
            >
              <Download className="w-3.5 h-3.5 text-amber-500" />
              Download Sample CSV
            </button>
          </div>

          {/* File Dropzone / Picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed ${borderClass} hover:border-amber-500/60 ${subtleSurfaceClass} rounded-lg p-7 text-center cursor-pointer transition-colors`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <FileSpreadsheet className={`w-7 h-7 ${textSubtle} mx-auto mb-2`} />
            <p className="text-xs font-medium">
              {isProcessing
                ? 'Parsing file...'
                : selectedFile
                ? selectedFile.name
                : 'Click to select CSV or Excel (.xlsx) file'}
            </p>
            <p className={`text-[11px] ${textSubtle} mt-1 font-mono`}>
              Format: Date, Category, Description, Amount, Type
            </p>
          </div>

          {errorMsg && (
            <div className={`p-3 rounded-md border border-amber-500/40 ${subtleSurfaceClass} text-xs text-amber-500 font-mono`}>
              {errorMsg}
            </div>
          )}

          {skippedDuplicatesCount > 0 && allParsedItems.length > 0 && (
            <label
              className={`flex items-center justify-between gap-3 p-2.5 rounded-md border ${borderClass} ${subtleSurfaceClass} text-xs cursor-pointer`}
            >
              <span className={textMuted}>
                {skippedDuplicatesCount} duplicate row{skippedDuplicatesCount === 1 ? '' : 's'} detected. Import anyway?
              </span>
              <input
                type="checkbox"
                checked={includeDuplicates}
                onChange={(e) => setIncludeDuplicates(e.target.checked)}
                className="accent-amber-500 w-4 h-4 cursor-pointer"
              />
            </label>
          )}

          {/* Parsed Preview */}
          {parsedPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <span className="flex items-center gap-1.5 font-medium">
                  <Check className="w-3.5 h-3.5 text-amber-500 stroke-[2.5]" />
                  Ready to import {parsedPreview.length} transaction{parsedPreview.length === 1 ? '' : 's'}
                </span>
                <span className={textMuted}>
                  {skippedDuplicatesCount > 0 && !includeDuplicates
                    ? `${skippedDuplicatesCount} duplicate(s) skipped • Month: ${targetMonth}`
                    : `Month: ${targetMonth}`}
                </span>
              </div>

              <div className={`max-h-44 overflow-y-auto divide-y ${borderClass} border ${borderClass} rounded-md`}>
                {parsedPreview.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 text-xs flex items-center justify-between ${subtleSurfaceClass}`}
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-medium truncate block">{item.description}</span>
                      <span className={`text-[10px] font-mono ${textSubtle}`}>
                        {item.date} &bull; {item.category}
                      </span>
                    </div>
                    <span className="font-mono font-medium tabular-nums shrink-0">
                      {item.type === 'income' ? '+' : '-'}₹{Number(item.amount || 0).toFixed(2)}
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
            type="button"
            onClick={onClose}
            className={`px-3 py-1.5 text-xs font-mono ${textMuted} hover:text-inherit cursor-pointer`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={parsedPreview.length === 0}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              parsedPreview.length > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-2xs cursor-pointer'
                : 'opacity-40 bg-zinc-400 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-500 cursor-not-allowed'
            }`}
          >
            Import {parsedPreview.length > 0 ? `(${parsedPreview.length})` : ''} to {targetMonth}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
