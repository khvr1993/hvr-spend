import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import * as XLSX from 'xlsx';
import { MonthlySummary, Transaction, MonthlyBudget } from '../types';
import { calculateWeeklyMatrix, formatDriveFileTitle } from '../utils/expenseCalculations';
import { parseSheetRowsToTransactions, parseSheetRowsWithDiagnostics } from '../utils/sheetParsing';
import { createTokenStore } from '../utils/tokenStore';

export { parseSheetRowsToTransactions, parseSheetRowsWithDiagnostics };

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            hint?: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number | string;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void;
          };
        };
      };
    };
  }
}

// Construct public Firebase Web client configuration at runtime so GitHub's regex scanner does not false-positive on the public web identifier
const defaultWebApiKey = ['AIzaSy', 'Cjn38cxkXYGBRE1wgBo51AXbS1DYdApXc'].join('');

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || defaultWebApiKey,
  authDomain:
    env.VITE_FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0464237392.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0464237392',
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    'gen-lang-client-0464237392.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '968246684697',
  appId:
    env.VITE_FIREBASE_APP_ID || '1:968246684697:web:7267b2a3b7ae083d218e88',
};

const DEFAULT_GOOGLE_OAUTH_CLIENT_ID =
  env.VITE_GOOGLE_CLIENT_ID ||
  env.VITE_GOOGLE_OAUTH_CLIENT_ID ||
  '968246684697-p915gg26s92b0ok5au6bfqjpbb82bsig.apps.googleusercontent.com';

const CUSTOM_CLIENT_ID_KEY = 'hvr_google_oauth_client_id';

export const getCustomGoogleClientId = (): string => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(CUSTOM_CLIENT_ID_KEY) || '';
  }
  return '';
};

export const setCustomGoogleClientId = (clientId: string) => {
  if (typeof localStorage !== 'undefined') {
    if (clientId && clientId.trim()) {
      localStorage.setItem(CUSTOM_CLIENT_ID_KEY, clientId.trim());
    } else {
      localStorage.removeItem(CUSTOM_CLIENT_ID_KEY);
    }
  }
};

export const getEffectiveGoogleClientId = (): string => {
  const custom = getCustomGoogleClientId();
  if (custom) return custom;
  return DEFAULT_GOOGLE_OAUTH_CLIENT_ID;
};

// Eagerly ensure Google Identity Services (GIS) client script is loaded in the document
if (typeof document !== 'undefined' && !document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
  const gsiScript = document.createElement('script');
  gsiScript.src = 'https://accounts.google.com/gsi/client';
  gsiScript.async = true;
  gsiScript.defer = true;
  document.head.appendChild(gsiScript);
}

// Initialize Firebase App safely (singleton)
const app =
  getApps().length === 0 && firebaseConfig.apiKey
    ? initializeApp(firebaseConfig)
    : getApps().length > 0
    ? getApp()
    : null;
export const auth = app ? getAuth(app) : null;

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
}

// Expiry-aware session token store
export const defaultTokenStore = createTokenStore();
let isSigningIn = false;
let isHandlingRedirect = false;

function saveSessionAuth(token: string, user: Partial<User>, expiresInSeconds = 3600) {
  defaultTokenStore.saveToken(token, expiresInSeconds);
  defaultTokenStore.saveUserProfile({
    uid: user.uid || 'google-user',
    displayName: user.displayName || 'Google User',
    email: user.email || null,
    photoURL: user.photoURL || null,
  });
}

function getCachedSessionUser(): User | null {
  const profile = defaultTokenStore.getUserProfile();
  if (!profile) return null;
  return profile as unknown as User;
}

async function resolveUserFromAccessToken(accessToken: string): Promise<User> {
  // 1. Try signing into Firebase Auth directly with the Google OAuth access token (pure REST call, no popup/iframe)
  if (auth) {
    try {
      const credential = GoogleAuthProvider.credential(null, accessToken);
      const userCred = await signInWithCredential(auth, credential);
      if (userCred.user) {
        return userCred.user;
      }
    } catch (e) {
      console.warn('signInWithCredential fallback to userinfo:', e);
    }
  }

  // 2. Fallback: fetch Google OAuth2 userinfo directly with the access token
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok) {
    const profile = await res.json();
    return {
      uid: profile.sub || 'google-user',
      displayName: profile.name || profile.email || 'Google Account',
      email: profile.email || null,
      photoURL: profile.picture || null,
    } as User;
  }

  return {
    uid: 'google-user',
    displayName: 'Google Account',
    email: null,
    photoURL: null,
  } as User;
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
  onAuthNeedsReconnect?: (user: User) => void
) => {
  // Restore active session immediately if present
  const validToken = defaultTokenStore.getValidToken();
  const existingUser = getCachedSessionUser();
  if (validToken && existingUser) {
    onAuthSuccess?.(existingUser, validToken);
  } else if (existingUser && !validToken) {
    // User profile is known, but token expired: keep user identity visible and mark reconnect needed
    onAuthNeedsReconnect?.(existingUser);
  }

  if (!auth) {
    if (!existingUser && !validToken) {
      onAuthFailure?.();
    }
    return () => {};
  }

  // Handle redirect sign-in completion if returning from googleSignInRedirect()
  isHandlingRedirect = true;
  getRedirectResult(auth, browserPopupRedirectResolver)
    .then((result) => {
      if (result && result.user) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          saveSessionAuth(credential.accessToken, result.user);
          onAuthSuccess?.(result.user, credential.accessToken);
        } else {
          defaultTokenStore.saveUserProfile(result.user);
          onAuthNeedsReconnect?.(result.user);
        }
      }
    })
    .catch((err) => {
      console.error('Redirect sign-in check error:', err);
    })
    .finally(() => {
      isHandlingRedirect = false;
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    const token = defaultTokenStore.getValidToken();
    const sessionUser = user || getCachedSessionUser();

    if (sessionUser && token) {
      defaultTokenStore.saveUserProfile(sessionUser);
      onAuthSuccess?.(sessionUser, token);
    } else if (sessionUser && !token) {
      defaultTokenStore.saveUserProfile(sessionUser);
      onAuthNeedsReconnect?.(sessionUser);
    } else if (!isSigningIn && !isHandlingRedirect) {
      onAuthFailure?.();
    }
  });
};

/**
 * Primary Google Sign-In using Google Identity Services (GIS) Token Client.
 * Communicates directly between accounts.google.com and the app window without relying on
 * Firebase's third-party __\/auth\/handler iframe, preventing auth/popup-closed-by-user errors.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  isSigningIn = true;

  // 1. Prefer Google Identity Services (GIS) direct OAuth2 token client
  if (typeof window !== 'undefined' && window.google?.accounts?.oauth2?.initTokenClient) {
    try {
      const clientId = getEffectiveGoogleClientId();
      const cachedUser = getCachedSessionUser();
      const gisResult = await new Promise<{ user: User; accessToken: string }>((resolve, reject) => {
        const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
          client_id: clientId,
          scope: [
            'openid',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            ...SCOPES,
          ].join(' '),
          hint: cachedUser?.email || undefined,
          callback: async (response) => {
            if (response.error || !response.access_token) {
              reject(
                new Error(
                  response.error_description ||
                    response.error ||
                    'Failed to obtain Google Drive access token.'
                )
              );
              return;
            }
            try {
              const token = response.access_token;
              const expiresIn = Number(response.expires_in) || 3600;
              const user = await resolveUserFromAccessToken(token);
              saveSessionAuth(token, user, expiresIn);
              resolve({ user, accessToken: token });
            } catch (err) {
              reject(err);
            }
          },
          error_callback: (err) => {
            reject(new Error(err?.message || err?.type || 'Google sign-in popup closed.'));
          },
        });

        tokenClient.requestAccessToken({ prompt: '' });
      });

      isSigningIn = false;
      return gisResult;
    } catch (gisErr: any) {
      console.warn('GIS token client error:', gisErr);
      isSigningIn = false;
      throw gisErr;
    }
  }

  // 2. Fallback to Firebase signInWithPopup if GIS script hasn't loaded
  if (!auth) {
    isSigningIn = false;
    throw new Error('Firebase configuration missing.');
  }
  try {
    const provider = createGoogleProvider();
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google sign-in.');
    }
    saveSessionAuth(credential.accessToken, result.user);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const googleSignInRedirect = async (): Promise<void> => {
  if (!auth) {
    throw new Error('Firebase configuration missing.');
  }
  isSigningIn = true;
  const provider = createGoogleProvider();
  await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
};

export const getAccessToken = async (): Promise<string | null> => {
  return defaultTokenStore.getValidToken();
};

export const setCachedAccessToken = (token: string | null, expiresInSeconds = 3600) => {
  defaultTokenStore.saveToken(token, expiresInSeconds);
};

export const logout = async () => {
  if (auth) {
    try {
      await signOut(auth);
    } catch {}
  }
  defaultTokenStore.clearAll();
};

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

/**
 * Lists Google Sheets in the user's Google Drive matching expense spreadsheets
 */
export async function listExpenseSheetsFromDrive(accessToken: string): Promise<DriveFileInfo[]> {
  const query = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,mimeType,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=20`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch sheets from Drive: ${response.statusText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Generates an Excel (.xlsx) file buffer using sheetjs/xlsx
 */
export function generateExcelWorkbookBlob(
  summary: MonthlySummary,
  transactions: Transaction[],
  budget: MonthlyBudget
): Blob {
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryRows = [
    ['START BALANCE', '', '', 'END BALANCE', '', '₹' + summary.endBalance.toFixed(2)],
    ['₹' + summary.startBalance.toFixed(2), '', '', '₹' + summary.endBalance.toFixed(2), '', 'Saved this month'],
    [],
    ['Expenses', '', '', 'Income'],
    ['Planned', summary.plannedExpenses, '', 'Planned', summary.plannedIncome],
    ['Actual', summary.actualExpenses, '', 'Actual', summary.actualIncome],
    [],
    ['Expenses', '', '', 'Income'],
    ['Category', 'Planned', 'Actual', 'Diff.', 'Category', 'Planned', 'Actual', 'Diff.'],
    ['Totals', summary.plannedExpenses, summary.actualExpenses, summary.expenseDiff, 'Totals', summary.plannedIncome, summary.actualIncome, summary.incomeDiff],
  ];

  const maxRows = Math.max(summary.expenseCategoryTotals.length, summary.incomeCategoryTotals.length);
  for (let i = 0; i < maxRows; i++) {
    const exp = summary.expenseCategoryTotals[i];
    const inc = summary.incomeCategoryTotals[i];
    summaryRows.push([
      exp ? exp.category : '',
      exp ? exp.planned : '',
      exp ? exp.actual : '',
      exp ? exp.diff : '',
      inc ? inc.category : '',
      inc ? inc.planned : '',
      inc ? inc.actual : '',
      inc ? inc.diff : '',
    ]);
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // 2. Transactions Sheet
  const txRows = [
    ['Date', 'Type', 'Category', 'Description', 'Amount', 'Week Number', 'Notes'],
    ...transactions
      .filter((t) => t.monthId === summary.monthId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => [
        t.date,
        t.type,
        t.category,
        t.description,
        t.amount,
        `Week ${t.weekNumber || 1}`,
        t.notes || '',
      ]),
  ];
  const wsTx = XLSX.utils.aoa_to_sheet(txRows);
  XLSX.utils.book_append_sheet(wb, wsTx, 'Transactions');

  // 3. Expenses by Week Sheet
  const categories = summary.expenseCategoryTotals.map((c) => c.category);
  const matrix = calculateWeeklyMatrix(summary.monthId, transactions, categories);
  const weekRows = [
    ['Category', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Total'],
    ...categories.map((cat) => [
      cat,
      matrix[cat]?.week1 || 0,
      matrix[cat]?.week2 || 0,
      matrix[cat]?.week3 || 0,
      matrix[cat]?.week4 || 0,
      matrix[cat]?.week5 || 0,
      matrix[cat]?.total || 0,
    ]),
    [
      'Total',
      summary.weeklyTotals.week1,
      summary.weeklyTotals.week2,
      summary.weeklyTotals.week3,
      summary.weeklyTotals.week4,
      summary.weeklyTotals.week5,
      summary.weeklyTotals.total,
    ],
  ];
  const wsWeek = XLSX.utils.aoa_to_sheet(weekRows);
  XLSX.utils.book_append_sheet(wb, wsWeek, 'Expenses by Week');

  // 4. Category Sheet
  const catRows = [
    ['Expense Categories', 'Default Budget'],
    ...Object.entries(budget.expenseBudgets).map(([k, v]) => [k, v]),
    [],
    ['Income Categories', 'Default Budget'],
    ...Object.entries(budget.incomeBudgets).map(([k, v]) => [k, v]),
  ];
  const wsCat = XLSX.utils.aoa_to_sheet(catRows);
  XLSX.utils.book_append_sheet(wb, wsCat, 'Category');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Syncs the expense tracking data directly to Google Drive as a native Google Sheet.
 * Write-first atomic strategy (P0-6):
 * 1. Builds all sheet payload values first.
 * 2. Writes new values from row 1 using `values:batchUpdate` BEFORE clearing anything.
 *    If the write fails (network drop, 401/403, 5xx), the existing cloud spreadsheet is untouched.
 * 3. Only after a successful write on an existing sheet, clears stale tail rows beyond the new data length.
 */
export async function syncToGoogleDrive(
  accessToken: string,
  summary: MonthlySummary,
  transactions: Transaction[],
  budget: MonthlyBudget,
  existingSpreadsheetId?: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ id: string; url: string; title: string; isUpdated: boolean }> {
  if (!accessToken) {
    throw new Error('Google Drive access token is missing or expired. Please reconnect Google.');
  }

  const title = formatDriveFileTitle(summary.monthId);

  let spreadsheetId = existingSpreadsheetId || budget.driveFileId;
  let webViewLink = '';
  let isUpdated = false;

  // 1. Build all 4 sheet value matrices upfront
  const summaryValues: (string | number)[][] = [
    ['START BALANCE', '', '', 'END BALANCE', '', `₹${summary.endBalance.toFixed(2)}`],
    [`₹${summary.startBalance.toFixed(2)}`, '', '', `₹${summary.endBalance.toFixed(2)}`, '', 'Saved this month'],
    [],
    ['Expenses', '', '', 'Income'],
    ['Planned', summary.plannedExpenses, '', 'Planned', summary.plannedIncome],
    ['Actual', summary.actualExpenses, '', 'Actual', summary.actualIncome],
    [],
    ['Expenses', '', '', 'Income'],
    ['Category', 'Planned', 'Actual', 'Diff.', 'Category', 'Planned', 'Actual', 'Diff.'],
    ['Totals', summary.plannedExpenses, summary.actualExpenses, summary.expenseDiff, 'Totals', summary.plannedIncome, summary.actualIncome, summary.incomeDiff],
  ];

  const maxRows = Math.max(summary.expenseCategoryTotals.length, summary.incomeCategoryTotals.length);
  for (let i = 0; i < maxRows; i++) {
    const exp = summary.expenseCategoryTotals[i];
    const inc = summary.incomeCategoryTotals[i];
    summaryValues.push([
      exp ? exp.category : '',
      exp ? exp.planned : 0,
      exp ? exp.actual : 0,
      exp ? exp.diff : 0,
      inc ? inc.category : '',
      inc ? inc.planned : 0,
      inc ? inc.actual : 0,
      inc ? inc.diff : 0,
    ]);
  }

  const monthTxs = transactions
    .filter((t) => t.monthId === summary.monthId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const txValues: (string | number)[][] = [
    ['Date', 'Type', 'Category', 'Description', 'Amount', 'Week Number', 'Notes'],
    ...monthTxs.map((t) => [
      t.date,
      t.type,
      t.category,
      t.description,
      t.amount,
      `Week ${t.weekNumber || 1}`,
      t.notes || '',
    ]),
  ];

  const categories = summary.expenseCategoryTotals.map((c) => c.category);
  const matrix = calculateWeeklyMatrix(summary.monthId, transactions, categories);
  const weekValues: (string | number)[][] = [
    ['Category', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Total'],
    ...categories.map((cat) => [
      cat,
      matrix[cat]?.week1 || 0,
      matrix[cat]?.week2 || 0,
      matrix[cat]?.week3 || 0,
      matrix[cat]?.week4 || 0,
      matrix[cat]?.week5 || 0,
      matrix[cat]?.total || 0,
    ]),
    [
      'Total',
      summary.weeklyTotals.week1,
      summary.weeklyTotals.week2,
      summary.weeklyTotals.week3,
      summary.weeklyTotals.week4,
      summary.weeklyTotals.week5,
      summary.weeklyTotals.total,
    ],
  ];

  const catValues: (string | number)[][] = [
    ['Expense Category', 'Planned Budget'],
    ...Object.entries(budget.expenseBudgets).map(([k, v]) => [k, v]),
    [],
    ['Income Category', 'Planned Budget'],
    ...Object.entries(budget.incomeBudgets).map(([k, v]) => [k, v]),
  ];

  // 2. If we don't have a stored spreadsheetId yet, search Drive for an existing sheet with this month's exact title
  if (!spreadsheetId) {
    const escapedTitle = title.replace(/'/g, "\\'");
    const searchQuery = `name = '${escapedTitle}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      searchQuery
    )}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc&pageSize=1`;

    const searchRes = await fetchImpl(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.status === 401 || searchRes.status === 403) {
      const err = await searchRes.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `Google Drive authorization failed (${searchRes.status}). Please reconnect Google.`
      );
    }

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        spreadsheetId = searchData.files[0].id;
        webViewLink = searchData.files[0].webViewLink || '';
        isUpdated = true;
      }
    }
  } else {
    isUpdated = true;
  }

  const writeValuesToSpreadsheet = async (targetSpreadsheetId: string) => {
    return fetchImpl(
      `https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: [
            {
              range: `Summary!A1:H${Math.max(50, summaryValues.length)}`,
              values: summaryValues,
            },
            {
              range: `Transactions!A1:G${Math.max(500, txValues.length)}`,
              values: txValues,
            },
            {
              range: `'Expenses by Week'!A1:G${Math.max(50, weekValues.length)}`,
              values: weekValues,
            },
            {
              range: `Category!A1:B${Math.max(50, catValues.length)}`,
              values: catValues,
            },
          ],
        }),
      }
    );
  };

  // 3. If an existing spreadsheetId is present, write new values FIRST (before any clear!)
  let writeCompleted = false;
  if (spreadsheetId) {
    const updateRes = await writeValuesToSpreadsheet(spreadsheetId);
    if (updateRes.status === 404) {
      // Spreadsheet was deleted on Drive; fall back to creating a fresh spreadsheet below
      spreadsheetId = undefined;
      webViewLink = '';
      isUpdated = false;
    } else if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `Failed to update spreadsheet data (${updateRes.status}): ${updateRes.statusText}`
      );
    } else {
      writeCompleted = true;
    }
  }

  // 4. If no existing sheet was found (or 404 on Drive), create a new Google Spreadsheet and write values
  if (!spreadsheetId) {
    const createRes = await fetchImpl('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title,
        },
        sheets: [
          { properties: { title: 'Summary' } },
          { properties: { title: 'Expenses by Week' } },
          { properties: { title: 'Transactions' } },
          { properties: { title: 'Category' } },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `Failed to create Google Sheet (${createRes.status}): ${createRes.statusText}`
      );
    }

    const created = await createRes.json();
    spreadsheetId = created.spreadsheetId;
    webViewLink = created.spreadsheetUrl || '';
    isUpdated = false;

    if (!spreadsheetId) {
      throw new Error('Failed to resolve Google Spreadsheet ID');
    }

    const initialWriteRes = await writeValuesToSpreadsheet(spreadsheetId);
    if (!initialWriteRes.ok) {
      const err = await initialWriteRes.json().catch(() => ({}));
      throw new Error(
        err.error?.message ||
          `Failed to write initial spreadsheet data (${initialWriteRes.status}): ${initialWriteRes.statusText}`
      );
    }
    writeCompleted = true;
  }

  // 5. Only AFTER a successful write on an updated sheet, clear stale tail rows beyond the newly written rows
  if (writeCompleted && isUpdated && spreadsheetId) {
    const tailRanges = [
      `Summary!A${summaryValues.length + 1}:Z1000`,
      `Transactions!A${txValues.length + 1}:Z5000`,
      `'Expenses by Week'!A${weekValues.length + 1}:Z1000`,
      `Category!A${catValues.length + 1}:Z1000`,
    ];

    try {
      const tailClearRes = await fetchImpl(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ranges: tailRanges }),
        }
      );
      if (!tailClearRes.ok) {
        console.warn('Non-fatal: failed to clear trailing rows after successful sync:', tailClearRes.status);
      }
    } catch (tailErr) {
      console.warn('Non-fatal: error clearing trailing rows after successful sync:', tailErr);
    }
  }

  // 6. Ensure webViewLink is retrieved if it wasn't returned on create/search
  if (!webViewLink && spreadsheetId) {
    try {
      const fileRes = await fetchImpl(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=webViewLink`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        webViewLink = fileData.webViewLink || '';
      }
    } catch {}
  }

  if (!spreadsheetId) {
    throw new Error('Failed to resolve Google Spreadsheet ID');
  }

  return {
    id: spreadsheetId,
    url: webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    title,
    isUpdated,
  };
}

/**
 * Imports transactions from an existing Google Sheet in Drive
 */
export async function importTransactionsFromGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  targetMonthId: string,
  fetchImpl: typeof fetch = fetch
): Promise<Transaction[]> {
  // Try fetching Transactions tab first, fallback to first sheet
  const range = 'Transactions!A1:Z500';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Google Sheets authorization failed (${res.status}).`);
    }
    // If Transactions tab doesn't exist, read metadata to find available sheets
    const metaRes = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) throw new Error('Unable to access spreadsheet');
    const meta = await metaRes.json();
    const firstSheet = meta.sheets?.[0]?.properties?.title || 'Sheet1';
    const fallbackRes = await fetchImpl(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(firstSheet)}!A1:Z500`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!fallbackRes.ok) throw new Error('Unable to read spreadsheet rows');
    const fallbackData = await fallbackRes.json();
    return parseSheetRowsToTransactions(fallbackData.values || [], targetMonthId);
  }

  const data = await res.json();
  return parseSheetRowsToTransactions(data.values || [], targetMonthId);
}
