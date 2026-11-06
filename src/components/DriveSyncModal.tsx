import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  logout,
  syncToGoogleDrive,
  generateExcelWorkbookBlob,
  listExpenseSheetsFromDrive,
  DriveFileInfo,
  getEffectiveGoogleClientId,
  getCustomGoogleClientId,
  setCustomGoogleClientId,
} from '../services/googleDriveService';
import { MonthlySummary, Transaction, MonthlyBudget } from '../types';
import { formatDriveFileTitle, isDailySyncDue, formatLocalYYYYMMDD } from '../utils/expenseCalculations';
import {
  Cloud,
  Download,
  ExternalLink,
  Check,
  Loader2,
  X,
  LogOut,
  RefreshCw,
  Clock,
  Key,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface DriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: MonthlySummary;
  transactions: Transaction[];
  budget: MonthlyBudget;
  currentUser: User | null;
  accessToken: string | null;
  needsGoogleReconnect?: boolean;
  autoSyncError?: string | null;
  onAuthSuccess: (user: User, token: string) => void;
  onAuthLogout: () => void;
  onImportDriveSheet: (file: DriveFileInfo) => Promise<void> | void;
  onUpdateBudget?: (updated: MonthlyBudget) => void;
  dailyAutoSync?: boolean;
  onToggleDailyAutoSync?: (enabled: boolean) => void;
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
  needsGoogleReconnect = false,
  autoSyncError = null,
  onAuthSuccess,
  onAuthLogout,
  onImportDriveSheet,
  onUpdateBudget,
  dailyAutoSync = true,
  onToggleDailyAutoSync,
  isDark = false,
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPopupClosedError, setIsPopupClosedError] = useState(false);
  const [isAccessDeniedError, setIsAccessDeniedError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customClientIdInput, setCustomClientIdInput] = useState(() => getCustomGoogleClientId());
  const [clientIdSavedMessage, setClientIdSavedMessage] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    url: string;
    title: string;
    id: string;
    isUpdated: boolean;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Mandatory confirmation dialog for mutating Drive operations
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Drive browsing
  const [driveFiles, setDriveFiles] = useState<DriveFileInfo[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  if (!isOpen) return null;

  const targetFileTitle = formatDriveFileTitle(summary.monthId);
  const todayStr = formatLocalYYYYMMDD();
  const syncedToday = !isDailySyncDue(budget.lastSyncedAt, todayStr);
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const hasActiveDriveSession = Boolean(currentUser && accessToken);

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

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    setIsPopupClosedError(false);
    setIsAccessDeniedError(false);
    try {
      const res = await googleSignIn();
      if (res) {
        onAuthSuccess(res.user, res.accessToken);
      }
    } catch (err: any) {
      const code = String(err?.code || err?.message || '');
      if (
        code.includes('access_denied') ||
        code.includes('403') ||
        code.includes('testing') ||
        code.includes('developer-approved')
      ) {
        setIsAccessDeniedError(true);
        setAuthError(
          'App is in Testing Mode (Error 403: access_denied). Test user permission required.'
        );
      } else if (
        code.includes('popup-closed-by-user') ||
        code.includes('popup_closed_by_user') ||
        code.includes('popup-blocked') ||
        code.includes('popup_failed_to_open') ||
        code.includes('cancelled-popup-request') ||
        code.includes('closed')
      ) {
        setIsPopupClosedError(true);
        setAuthError('Google sign-in window closed before completing authorization.');
      } else if (code.includes('unauthorized-domain') || code.includes('origin_mismatch') || code.includes('redirect_uri_mismatch')) {
        setIsPopupClosedError(true);
        setAuthError(
          `Origin "https://${currentHostname}" needs to be added to Authorized JavaScript origins in Google Cloud Console.`
        );
      } else {
        setAuthError(err?.message || 'Authentication error');
      }
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
      const result = await syncToGoogleDrive(
        accessToken,
        summary,
        transactions,
        budget,
        budget.driveFileId
      );
      setSyncResult(result);
      if (onUpdateBudget) {
        onUpdateBudget({
          ...budget,
          driveFileId: result.id,
          lastSyncedAt: Date.now(),
        });
      }
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
    a.download = `${targetFileTitle}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFetchDriveFiles = async () => {
    if (!accessToken) return;
    setIsLoadingFiles(true);
    setSyncError(null);
    try {
      const files = await listExpenseSheetsFromDrive(accessToken);
      setDriveFiles(files);
    } catch (err: any) {
      setSyncError(err?.message || 'Could not scan Drive sheets');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleImportSheetClick = async (file: DriveFileInfo) => {
    setSyncError(null);
    try {
      await onImportDriveSheet(file);
    } catch (err: any) {
      setSyncError(err?.message || 'Failed to import Google Sheet');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`border rounded-lg shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] ${surfaceClass}`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${borderClass} flex items-center justify-between ${subtleSurfaceClass}`}>
          <div>
            <h3 className="text-sm font-medium tracking-tight">
              Google Drive &amp; Excel Sync
            </h3>
            <p className={`text-xs font-mono ${textMuted} mt-0.5`}>
              File: {targetFileTitle}
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

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Account Status Card */}
          <div className={`p-4 rounded-md border ${borderClass} ${subtleSurfaceClass}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || ''}
                    className="w-8 h-8 rounded-full border border-zinc-700 shrink-0"
                  />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-medium shrink-0 ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-700'}`}>
                    {currentUser?.displayName ? currentUser.displayName[0] : 'G'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">
                    {currentUser ? currentUser.displayName || 'Google Account' : 'Not Authenticated'}
                  </p>
                  <p className={`text-[11px] ${currentUser && !accessToken ? 'text-amber-500' : textMuted} font-mono truncate`}>
                    {currentUser
                      ? accessToken
                        ? currentUser.email
                        : `${currentUser.email || 'Account restored'} (Reconnect required)`
                      : 'Sign in to sync with Google Drive'}
                  </p>
                </div>
              </div>

              {currentUser ? (
                <div className="flex items-center gap-2 shrink-0">
                  {(!accessToken || needsGoogleReconnect) && (
                    <button
                      type="button"
                      onClick={handleSignIn}
                      disabled={isLoggingIn}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Reconnect Google
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={`px-2.5 py-1 text-xs font-mono ${textMuted} hover:text-inherit flex items-center gap-1 cursor-pointer shrink-0`}
                  >
                    <LogOut className="w-3 h-3" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={isLoggingIn}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    {isLoggingIn ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
                    Connect Google
                  </button>
                </div>
              )}
            </div>

            {authError && (
              <div className={`mt-3 p-3 rounded-md border border-amber-500/40 ${surfaceClass} space-y-2.5 text-xs`}>
                <p className="text-amber-500 font-medium">{authError}</p>

                {isAccessDeniedError && (
                  <div className={`space-y-2 text-[11px] ${textMuted} leading-relaxed`}>
                    <p className="text-zinc-200">
                      When a Google OAuth app is in <strong>Testing</strong> mode, Google only permits accounts listed under <strong>Test Users</strong>:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1 text-zinc-300">
                      <li>
                        Open{' '}
                        <a
                          href="https://console.cloud.google.com/apis/credentials/consent"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-500 underline inline-flex items-center gap-0.5 font-medium"
                        >
                          Google Cloud &rarr; OAuth Consent Screen <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </li>
                      <li>
                        Scroll down to <strong>Test users</strong> and click <strong>+ ADD USERS</strong>.
                      </li>
                      <li>
                        Enter your Google email address and click <strong>Save</strong>.
                      </li>
                      <li>
                        <em>(Alternative)</em> Under <strong>Publishing status</strong>, click <strong>PUBLISH APP</strong> to allow any Google user to access without being added as a test user.
                      </li>
                    </ol>
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSignIn}
                        disabled={isLoggingIn}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-xs font-medium cursor-pointer"
                      >
                        Retry Connect Google
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSettings(!showSettings)}
                        className={`px-3 py-1.5 rounded-md text-xs font-mono border ${borderClass} ${subtleSurfaceClass} flex items-center gap-1 cursor-pointer`}
                      >
                        <Key className="w-3 h-3 text-amber-500" />
                        {showSettings ? 'Hide Client ID' : 'Client ID Settings'}
                      </button>
                    </div>
                  </div>
                )}

                {isPopupClosedError && !isAccessDeniedError && (
                  <>
                    <div className={`space-y-1.5 text-[11px] ${textMuted} leading-relaxed`}>
                      <p>
                        <strong>1. On the &ldquo;Google hasn&rsquo;t verified this app&rdquo; screen:</strong>{' '}
                        Click <strong>&ldquo;Advanced&rdquo;</strong> (bottom-left) &rarr;{' '}
                        <strong>&ldquo;Go to app (unsafe)&rdquo;</strong> &rarr; select the Google Drive &amp; Sheets permissions and click <strong>Continue</strong>.
                      </p>
                      {currentHostname && currentHostname.endsWith('github.io') && (
                        <p>
                          <strong>2. GitHub Pages Domain:</strong> Ensure{' '}
                          <code className="font-mono text-amber-500">https://{currentHostname}</code> is added under{' '}
                          <strong>Google Cloud Console &rarr; APIs &amp; Services &rarr; Credentials &rarr; OAuth 2.0 Client IDs &rarr; Authorized JavaScript origins</strong>.
                        </p>
                      )}
                    </div>
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSignIn}
                        disabled={isLoggingIn}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-xs font-medium cursor-pointer"
                      >
                        Retry Connect Google
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Custom OAuth Client ID Section */}
            <div className={`mt-3 pt-3 border-t ${borderClass}`}>
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={`w-full flex items-center justify-between text-[11px] ${textMuted} hover:${textSubtle} cursor-pointer`}
              >
                <span className="flex items-center gap-1 font-medium">
                  <Settings className="w-3 h-3 text-amber-500" />
                  Google OAuth Client ID Configuration
                </span>
                {showSettings ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {showSettings && (
                <div className="mt-2.5 space-y-2 text-xs">
                  <p className={`text-[10px] font-mono ${textMuted}`}>
                    Active Client ID:
                  </p>
                  <div className="p-2 rounded bg-black/40 font-mono text-[10px] break-all border border-zinc-800 text-zinc-300">
                    {getEffectiveGoogleClientId()}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] text-zinc-300">
                      Custom Client ID (Optional &mdash; if using your own Google Cloud project):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customClientIdInput}
                        onChange={(e) => setCustomClientIdInput(e.target.value)}
                        placeholder="123456789-xyz.apps.googleusercontent.com"
                        className={`flex-1 px-2.5 py-1.5 rounded border ${borderClass} bg-transparent font-mono text-xs focus:outline-none focus:border-amber-500`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCustomGoogleClientId(customClientIdInput);
                          setClientIdSavedMessage(true);
                          setTimeout(() => setClientIdSavedMessage(false), 3000);
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium rounded text-xs cursor-pointer shrink-0"
                      >
                        Save
                      </button>
                      {customClientIdInput && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomClientIdInput('');
                            setCustomGoogleClientId('');
                            setClientIdSavedMessage(true);
                            setTimeout(() => setClientIdSavedMessage(false), 3000);
                          }}
                          className={`px-2 py-1.5 border ${borderClass} ${textMuted} hover:text-inherit rounded text-xs cursor-pointer shrink-0`}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    {clientIdSavedMessage && (
                      <p className="text-[11px] text-emerald-400 font-mono mt-1">
                        ✓ Client ID configuration saved
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Daily Auto-Sync on App Open Setting */}
          <div className={`p-4 rounded-md border ${borderClass} ${subtleSurfaceClass} flex items-center justify-between gap-4`}>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium">Auto-Sync Once a Day on App Open</span>
              </div>
              <p className={`text-[11px] ${textMuted}`}>
                Automatically syncs <strong>{targetFileTitle}</strong> once per day when you open the app with Google connected.
              </p>
              {budget.lastSyncedAt && (
                <p className={`text-[10px] font-mono ${syncedToday ? 'text-amber-500' : textSubtle} pt-0.5`}>
                  {syncedToday ? '✓ Synced today' : 'Last synced'}:{' '}
                  {new Date(budget.lastSyncedAt).toLocaleString()}
                </p>
              )}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={dailyAutoSync}
              onClick={() => onToggleDailyAutoSync && onToggleDailyAutoSync(!dailyAutoSync)}
              className={`w-10 h-5.5 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                dailyAutoSync ? 'bg-amber-500' : isDark ? 'bg-zinc-700' : 'bg-zinc-300'
              }`}
            >
              <span
                className={`block w-4.5 h-4.5 rounded-full bg-white shadow-2xs transition-transform ${
                  dailyAutoSync ? 'translate-x-4.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sync Success Banner */}
          {syncResult && (
            <div className={`p-4 rounded-md border border-amber-500/30 ${subtleSurfaceClass} space-y-2`}>
              <div className="flex items-center gap-2 text-amber-500 text-xs font-medium">
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>
                  {syncResult.isUpdated
                    ? 'Existing spreadsheet updated in-place in Google Drive'
                    : 'New spreadsheet created in Google Drive'}
                </span>
              </div>
              <p className={`text-xs ${textMuted}`}>
                File <strong>&ldquo;{syncResult.title}&rdquo;</strong> is synchronized with all 4 tabs.
              </p>
              <div className="pt-1">
                <a
                  href={syncResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open {syncResult.title}
                </a>
              </div>
            </div>
          )}

          {(syncError || autoSyncError) && (
            <div className={`p-3 rounded-md border ${borderClass} ${subtleSurfaceClass} text-xs text-amber-500 font-mono`}>
              {syncError || autoSyncError}
            </div>
          )}

          {/* Actions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleInitiateSync}
              disabled={isSyncing || !hasActiveDriveSession}
              className={`p-4 rounded-md border text-left transition-all flex flex-col justify-between ${
                hasActiveDriveSession
                  ? `border-amber-500/30 ${subtleSurfaceClass} hover:border-amber-500/60 cursor-pointer`
                  : `opacity-40 border-dashed ${borderClass} cursor-not-allowed`
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <Cloud className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-mono uppercase text-amber-500">
                  {isSyncing ? 'Syncing...' : 'Cloud'}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium">Sync Now to Google Drive</p>
                <p className={`text-[11px] ${textSubtle} mt-0.5 font-mono truncate`}>
                  {targetFileTitle}
                </p>
              </div>
            </button>

            <button
              type="button"
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
                <p className={`text-[11px] ${textSubtle} mt-0.5 font-mono truncate`}>
                  {targetFileTitle}.xlsx
                </p>
              </div>
            </button>
          </div>

          {/* Drive Spreadsheets Scanner */}
          {hasActiveDriveSession && (
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
                  type="button"
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
                        type="button"
                        onClick={() => handleImportSheetClick(file)}
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
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-medium rounded-md cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`border rounded-lg shadow-2xl max-w-sm w-full p-6 space-y-4 ${surfaceClass}`}>
            <h4 className="text-sm font-medium tracking-tight">
              Confirm Google Drive Sync
            </h4>
            <p className={`text-xs ${textMuted} leading-relaxed`}>
              This will create or overwrite the spreadsheet titled{' '}
              <strong className="font-mono">&ldquo;{targetFileTitle}&rdquo;</strong> in your Google Drive with 4 structured tabs (Summary, Expenses by Week, Transactions, and Category).
            </p>
            <div className={`flex items-center justify-end gap-2 pt-3 border-t ${borderClass}`}>
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className={`px-3 py-1.5 rounded-md text-xs border ${borderClass} ${subtleSurfaceClass} ${textMuted} hover:text-inherit cursor-pointer`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSync}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-medium rounded-md shadow-2xs cursor-pointer"
              >
                Confirm &amp; Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
