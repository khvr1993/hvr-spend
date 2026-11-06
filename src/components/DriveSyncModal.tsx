import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  logout,
  syncToGoogleDrive,
  generateExcelWorkbookBlob,
  listExpenseSheetsFromDrive,
  DriveFileInfo,
} from '../services/googleDriveService';
import { MonthlySummary, Transaction, MonthlyBudget } from '../types';
import {
  Cloud,
  Download,
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
  X,
  LogOut,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';

interface DriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: MonthlySummary;
  transactions: Transaction[];
  budget: MonthlyBudget;
  currentUser: User | null;
  accessToken: string | null;
  onAuthSuccess: (user: User, token: string) => void;
  onAuthLogout: () => void;
  onImportDriveSheet: (file: DriveFileInfo) => void;
  isDark?: boolean;
}

export const DriveSyncModal: React.FC<DriveSyncModalProps> = ({
  isOpen,
  onClose,
  summary,
  transactions,
  budget,
  currentUser,
  accessToken,
  onAuthSuccess,
  onAuthLogout,
  onImportDriveSheet,
  isDark = true,
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    url: string;
    title: string;
    id: string;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Mandatory confirmation dialog for mutating Drive operations
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Drive browsing
  const [driveFiles, setDriveFiles] = useState<DriveFileInfo[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

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

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        onAuthSuccess(res.user, res.accessToken);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onAuthLogout();
    setSyncResult(null);
    setDriveFiles([]);
  };

  const handleInitiateSync = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmSync = async () => {
    setShowConfirmDialog(false);
    if (!accessToken) {
      setSyncError('Please authenticate with Google first.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    try {
      const result = await syncToGoogleDrive(accessToken, summary, transactions, budget);
      setSyncResult(result);
    } catch (err: any) {
      setSyncError(err?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadExcel = () => {
    const blob = generateExcelWorkbookBlob(summary, transactions, budget);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${summary.monthName || 'Expenses'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFetchDriveFiles = async () => {
    if (!accessToken) return;
    setIsLoadingFiles(true);
    try {
      const files = await listExpenseSheetsFromDrive(accessToken);
      setDriveFiles(files);
    } catch (err: any) {
      setSyncError(err?.message || 'Could not scan Drive sheets');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`border rounded-lg shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] ${surfaceClass}`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${borderClass} flex items-center justify-between ${subtleSurfaceClass}`}>
          <div>
            <h3 className="text-sm font-medium tracking-tight">
              Google Drive & Excel Sync
            </h3>
            <p className={`text-xs ${textMuted} mt-0.5`}>
              Synchronize {summary.monthName} to Google Sheets or download .xlsx
            </p>
          </div>
          <button
            onClick={onClose}
            className={`${textSubtle} hover:${textMuted} p-1`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Account Status Card */}
          <div className={`p-4 rounded-md border ${borderClass} ${subtleSurfaceClass}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || ''}
                    className="w-8 h-8 rounded-full border border-zinc-700"
                  />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-medium ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-700'}`}>
                    {currentUser?.displayName ? currentUser.displayName[0] : 'G'}
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium">
                    {currentUser ? currentUser.displayName || 'Google Account' : 'Not Authenticated'}
                  </p>
                  <p className={`text-[11px] ${textMuted} font-mono truncate max-w-[200px]`}>
                    {currentUser ? currentUser.email : 'Sign in to access Google Drive storage'}
                  </p>
                </div>
              </div>

              {currentUser ? (
                <button
                  onClick={handleLogout}
                  className={`px-2.5 py-1 text-xs font-mono ${textMuted} hover:text-inherit flex items-center gap-1 cursor-pointer`}
                >
                  <LogOut className="w-3 h-3" />
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  disabled={isLoggingIn}
                  className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  Connect Google
                </button>
              )}
            </div>

            {authError && (
              <p className="mt-2 text-xs text-amber-500 font-mono">
                {authError}
              </p>
            )}
          </div>

          {/* Sync Success Banner */}
          {syncResult && (
            <div className={`p-4 rounded-md border border-amber-500/30 ${subtleSurfaceClass} space-y-2`}>
              <div className="flex items-center gap-2 text-amber-500 text-xs font-medium">
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Spreadsheet successfully updated in Google Drive</span>
              </div>
              <p className={`text-xs ${textMuted}`}>
                Document &ldquo;{syncResult.title}&rdquo; is synchronized with all 4 sheets.
              </p>
              <div className="pt-1">
                <a
                  href={syncResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in Google Sheets
                </a>
              </div>
            </div>
          )}

          {syncError && (
            <div className={`p-3 rounded-md border ${borderClass} ${subtleSurfaceClass} text-xs text-amber-500 font-mono`}>
              {syncError}
            </div>
          )}

          {/* Actions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleInitiateSync}
              disabled={isSyncing || !currentUser}
              className={`p-4 rounded-md border text-left transition-all flex flex-col justify-between ${
                currentUser
                  ? `border-amber-500/30 ${subtleSurfaceClass} hover:border-amber-500/60 cursor-pointer`
                  : `opacity-40 border-dashed ${borderClass} cursor-not-allowed`
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <Cloud className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-mono uppercase text-amber-500">
                  Cloud
                </span>
              </div>
              <div>
                <p className="text-xs font-medium">Sync to Google Drive</p>
                <p className={`text-[11px] ${textSubtle} mt-0.5`}>
                  Update native Google Sheet directly in your Drive
                </p>
              </div>
            </button>

            <button
              onClick={handleDownloadExcel}
              className={`p-4 rounded-md border ${borderClass} ${subtleSurfaceClass} hover:border-zinc-500 text-left transition-all flex flex-col justify-between cursor-pointer`}
            >
              <div className="flex items-center justify-between mb-3">
                <Download className="w-4 h-4 text-zinc-400" />
                <span className={`text-[10px] font-mono uppercase ${textSubtle}`}>
                  Local
                </span>
              </div>
              <div>
                <p className="text-xs font-medium">Download Excel (.xlsx)</p>
                <p className={`text-[11px] ${textSubtle} mt-0.5`}>
                  Generate complete offline workbook backup
                </p>
              </div>
            </button>
          </div>

          {/* Drive Spreadsheets Scanner */}
          {currentUser && (
            <div className={`pt-4 border-t ${borderClass} space-y-3`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`text-xs font-medium uppercase tracking-wider ${textSubtle}`}>
                    Sheets in Drive
                  </h4>
                  <p className={`text-[11px] ${textMuted}`}>
                    Import ledger items from existing Drive spreadsheets
                  </p>
                </div>
                <button
                  onClick={handleFetchDriveFiles}
                  disabled={isLoadingFiles}
                  className={`text-xs font-mono font-medium ${textMuted} hover:text-inherit flex items-center gap-1 cursor-pointer`}
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  Scan
                </button>
              </div>

              {driveFiles.length > 0 && (
                <div className={`divide-y ${borderClass} border ${borderClass} rounded-md max-h-36 overflow-y-auto`}>
                  {driveFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`p-2.5 flex items-center justify-between ${subtleSurfaceClass} text-xs`}
                    >
                      <span className="font-medium truncate pr-2">{file.name}</span>
                      <button
                        onClick={() => onImportDriveSheet(file)}
                        className={`px-2 py-0.5 text-xs font-mono rounded border ${borderClass} hover:opacity-80 transition-opacity cursor-pointer`}
                      >
                        Import
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-3 border-t ${borderClass} ${subtleSurfaceClass} flex justify-end`}>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-200 dark:bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium rounded-md cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Confirmation Dialog (Mandatory for destructive/mutating operations) */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`border rounded-lg shadow-2xl max-w-sm w-full p-6 space-y-4 ${surfaceClass}`}>
            <h4 className="text-sm font-medium tracking-tight">
              Confirm Google Drive Synchronization
            </h4>
            <p className={`text-xs ${textMuted} leading-relaxed`}>
              This action will create or update the spreadsheet titled <strong>&ldquo;{summary.monthName}&rdquo;</strong> in your Google Drive with 4 structured tabs (Summary, Expenses by Week, Transactions, and Category).
            </p>
            <div className={`flex items-center justify-end gap-2 pt-3 border-t ${borderClass}`}>
              <button
                onClick={() => setShowConfirmDialog(false)}
                className={`px-3 py-1.5 rounded-md text-xs border ${borderClass} ${subtleSurfaceClass} ${textMuted} hover:text-inherit cursor-pointer`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSync}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-medium rounded-md shadow-2xs cursor-pointer"
              >
                Confirm & Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
