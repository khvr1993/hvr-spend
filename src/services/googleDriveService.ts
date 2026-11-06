import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import * as XLSX from 'xlsx';
import firebaseConfig from '../../firebase-applet-config.json';
import { MonthlySummary, Transaction, MonthlyBudget } from '../types';
import { calculateWeeklyMatrix, formatINR } from '../utils/expenseCalculations';

// Initialize Firebase App safely (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

// Memory-only cache for access token
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google sign in');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
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
 * Syncs the expense tracking data directly to Google Drive as a native Google Sheet
 */
export async function syncToGoogleDrive(
  accessToken: string,
  summary: MonthlySummary,
  transactions: Transaction[],
  budget: MonthlyBudget,
  existingSpreadsheetId?: string
): Promise<{ id: string; url: string; title: string }> {
  const title = `${summary.monthName || 'Monthly Expenses'}`;

  let spreadsheetId = existingSpreadsheetId;
  let webViewLink = '';

  if (!spreadsheetId) {
    // Create new Google Spreadsheet via Sheets API
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
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
      throw new Error(err.error?.message || `Failed to create Google Sheet: ${createRes.statusText}`);
    }

    const created = await createRes.json();
    spreadsheetId = created.spreadsheetId;
    webViewLink = created.spreadsheetUrl;
  }

  // Populate data into the sheets using spreadsheets.values.batchUpdate
  const summaryValues = [
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

  // Transactions Values
  const monthTxs = transactions
    .filter((t) => t.monthId === summary.monthId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const txValues = [
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

  // Expenses by Week Values
  const categories = summary.expenseCategoryTotals.map((c) => c.category);
  const matrix = calculateWeeklyMatrix(summary.monthId, transactions, categories);
  const weekValues = [
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

  // Categories Values
  const catValues = [
    ['Expense Category', 'Planned Budget'],
    ...Object.entries(budget.expenseBudgets).map(([k, v]) => [k, v]),
    [],
    ['Income Category', 'Planned Budget'],
    ...Object.entries(budget.incomeBudgets).map(([k, v]) => [k, v]),
  ];

  const batchUpdateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
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
            range: 'Summary!A1:H50',
            values: summaryValues,
          },
          {
            range: 'Transactions!A1:G500',
            values: txValues,
          },
          {
            range: "'Expenses by Week'!A1:G50",
            values: weekValues,
          },
          {
            range: 'Category!A1:B50',
            values: catValues,
          },
        ],
      }),
    }
  );

  if (!batchUpdateRes.ok) {
    const err = await batchUpdateRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to update spreadsheet data: ${batchUpdateRes.statusText}`);
  }

  // Ensure webViewLink is retrieved if it wasn't returned on create
  if (!webViewLink) {
    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=webViewLink`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (fileRes.ok) {
      const fileData = await fileRes.json();
      webViewLink = fileData.webViewLink;
    }
  }

  if (!spreadsheetId) {
    throw new Error('Failed to resolve Google Spreadsheet ID');
  }

  return {
    id: spreadsheetId,
    url: webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    title,
  };
}

/**
 * Imports transactions from an existing Google Sheet in Drive
 */
export async function importTransactionsFromGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  targetMonthId: string
): Promise<Transaction[]> {
  // Try fetching Transactions tab first, fallback to first sheet
  const range = 'Transactions!A1:Z500';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    // If Transactions tab doesn't exist, read metadata to find available sheets
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) throw new Error('Unable to access spreadsheet');
    const meta = await metaRes.json();
    const firstSheet = meta.sheets?.[0]?.properties?.title || 'Sheet1';
    const fallbackRes = await fetch(
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

function parseSheetRowsToTransactions(rows: any[][], defaultMonthId: string): Transaction[] {
  if (!rows || rows.length <= 1) return [];

  const headers = (rows[0] || []).map((h) => String(h || '').toLowerCase().trim());
  const dateIdx = headers.findIndex((h) => h.includes('date'));
  const typeIdx = headers.findIndex((h) => h.includes('type'));
  const catIdx = headers.findIndex((h) => h.includes('cat'));
  const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('item') || h.includes('detail'));
  const amtIdx = headers.findIndex((h) => h.includes('amount') || h.includes('amt') || h.includes('price') || h.includes('cost'));
  const notesIdx = headers.findIndex((h) => h.includes('note'));

  const parsed: Transaction[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawAmt = amtIdx >= 0 ? String(row[amtIdx] || '') : '0';
    const cleanedAmt = parseFloat(rawAmt.replace(/[^0-9.-]/g, '')) || 0;
    if (cleanedAmt <= 0) continue;

    const rawDate = dateIdx >= 0 ? String(row[dateIdx] || '') : '';
    let dateStr = new Date().toISOString().slice(0, 10);
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().slice(0, 10);
      }
    }

    const rawType = typeIdx >= 0 ? String(row[typeIdx] || '').toLowerCase() : '';
    const rawCat = catIdx >= 0 ? String(row[catIdx] || '') : 'Unplanned';
    const rawDesc = descIdx >= 0 ? String(row[descIdx] || '') : 'Imported transaction';
    const rawNotes = notesIdx >= 0 ? String(row[notesIdx] || '') : '';

    const isIncome = rawType.includes('income') || rawCat.toLowerCase().includes('paycheck') || rawCat.toLowerCase().includes('salary');

    parsed.push({
      id: `imported-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      monthId: dateStr.slice(0, 7) || defaultMonthId,
      date: dateStr,
      type: isIncome ? 'income' : 'expense',
      category: rawCat,
      description: rawDesc,
      amount: cleanedAmt,
      weekNumber: parseInt(dateStr.split('-')[2] || '1', 10) <= 7 ? 1 : 2,
      notes: rawNotes,
      createdAt: Date.now() + i,
    });
  }

  return parsed;
}
