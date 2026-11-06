/**
 * Pure, timezone-safe date parsing and formatting utilities.
 * Prevents UTC off-by-one shifts caused by `new Date(...).toISOString().slice(0, 10)`
 * in positive UTC offset timezones such as IST (UTC+05:30).
 */

/**
 * Formats a Date object as local YYYY-MM-DD using local calendar components.
 */
export function formatLocalYYYYMMDD(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Validates whether (year, month, day) forms a real calendar date.
 */
function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const maxDays = new Date(year, month, 0).getDate();
  return day <= maxDays;
}

function formatComponents(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parses a wide variety of spreadsheet and CSV date representations into a strict
 * `YYYY-MM-DD` string without timezone-induced day shifts.
 *
 * Supported formats:
 * 1. `YYYY-MM-DD`, `YYYY/MM/DD`, `YYYY.MM.DD` (with optional time suffix)
 * 2. Excel serial numbers (e.g., 45678 -> days since 1899-12-30)
 * 3. `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`, or `MM/DD/YYYY`:
 *    - If first > 12 -> DD/MM/YYYY
 *    - If second > 12 -> MM/DD/YYYY
 *    - If both <= 12 -> defaults to DD/MM/YYYY (Indian/international standard),
 *      unless `preferMonthFirst` is true
 * 4. JS `Date` instance or month-name strings (e.g., `Nov 2, 2026`, `2 Nov 2026`)
 *
 * Returns `null` if the input cannot be parsed as a valid date.
 */
export function parseFlexibleDate(
  raw: unknown,
  options?: { preferMonthFirst?: boolean }
): string | null {
  if (raw === null || raw === undefined) return null;

  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return formatLocalYYYYMMDD(raw);
  }

  // Handle numeric Excel serial dates (typical range: 20000 to 80000, i.e., years 1954-2119)
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return parseExcelSerialDate(raw);
  }

  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Numeric string representing Excel serial date (e.g. "45678" or "46328.5")
  if (/^\d{5}(\.\d+)?$/.test(trimmed)) {
    const serial = parseFloat(trimmed);
    const excelDate = parseExcelSerialDate(serial);
    if (excelDate) return excelDate;
  }

  // Case 1: ISO-like YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD (ignore trailing time if present)
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      return formatComponents(year, month, day);
    }
    return null;
  }

  // Case 2: Slash, dash, or dot separated D/M/Y or M/D/Y (2 or 4 digit year)
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$/);
  if (dmyMatch) {
    const first = parseInt(dmyMatch[1], 10);
    const second = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (dmyMatch[3].length === 2) {
      year += year >= 70 ? 1900 : 2000;
    }

    let day: number;
    let month: number;

    if (first > 12) {
      // Unambiguously DD/MM/YYYY
      day = first;
      month = second;
    } else if (second > 12) {
      // Unambiguously MM/DD/YYYY
      month = first;
      day = second;
    } else if (options?.preferMonthFirst) {
      month = first;
      day = second;
    } else {
      // Default to DD/MM/YYYY (Indian/UK locale standard)
      day = first;
      month = second;
    }

    if (isValidCalendarDate(year, month, day)) {
      return formatComponents(year, month, day);
    }
    return null;
  }

  // Case 3: Named months (e.g. "2 Nov 2026", "Nov 2, 2026", "2026 Nov 2")
  if (/[a-zA-Z]/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = parsed.getMonth() + 1;
      const day = parsed.getDate();
      if (isValidCalendarDate(year, month, day)) {
        return formatComponents(year, month, day);
      }
    }
  }

  return null;
}

/**
 * Converts an Excel 1900-epoch serial number to YYYY-MM-DD using UTC math.
 * Excel's epoch is 1899-12-30 (accounting for the historic 1900 leap-year bug).
 */
export function parseExcelSerialDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 10000 || serial > 100000) {
    return null;
  }
  const wholeDays = Math.floor(serial);
  const excelEpochUtc = Date.UTC(1899, 11, 30);
  const utcMs = excelEpochUtc + wholeDays * 86400 * 1000;
  const d = new Date(utcMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (!isValidCalendarDate(year, month, day)) return null;
  return formatComponents(year, month, day);
}
