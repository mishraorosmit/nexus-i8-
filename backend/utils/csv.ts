/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * RFC 4180 Compliant CSV Parser & Serializer with Formula Injection Defense
 */

export class CsvSyntaxError extends Error {
  public rowNumber: number;
  public colNumber: number;

  constructor(message: string, rowNumber = 1, colNumber = 1) {
    super(`CSV Parse Error at line ${rowNumber}, col ${colNumber}: ${message}`);
    this.name = 'CsvSyntaxError';
    this.rowNumber = rowNumber;
    this.colNumber = colNumber;
  }
}

/**
 * Characters that trigger spreadsheet formula execution in Excel/Calc/Sheets.
 */
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * Sanitizes a string value against CSV formula injection (DDE / formula execution).
 * If the value starts with a formula trigger, prepends a single quote (').
 */
export function sanitizeCsvValue(val: string): string {
  if (!val || typeof val !== 'string') return val;
  const firstChar = val.charAt(0);
  if (FORMULA_TRIGGERS.has(firstChar)) {
    return `'${val}`;
  }
  return val;
}

/**
 * Normalizes header keys to standard lowercase alphanumeric with underscores.
 * e.g. "Unique ID" -> "unique_id", "Member Name" -> "name"
 */
export function normalizeHeaderKey(rawHeader: string): string {
  const trimmed = rawHeader.trim().toLowerCase();
  
  if (trimmed === 'unique id' || trimmed === 'unique_id' || trimmed === 'uniqueid' || trimmed === 'eid' || trimmed === 'id') {
    return 'unique_id';
  }
  if (trimmed === 'member name' || trimmed === 'name' || trimmed === 'full name') {
    return 'name';
  }
  if (trimmed === 'display name' || trimmed === 'display_name' || trimmed === 'alias') {
    return 'display_name';
  }
  if (trimmed === 'email' || trimmed === 'email address' || trimmed === 'mail') {
    return 'email';
  }
  if (trimmed === 'role' || trimmed === 'designation' || trimmed === 'title') {
    return 'role';
  }
  if (trimmed === 'domain' || trimmed === 'squad' || trimmed === 'group' || trimmed === 'discipline') {
    return 'domain';
  }
  if (trimmed === 'department' || trimmed === 'dept') {
    return 'department';
  }
  if (trimmed === 'bio' || trimmed === 'biography' || trimmed === 'description') {
    return 'bio';
  }
  if (trimmed === 'status' || trimmed === 'member status') {
    return 'status';
  }
  if (trimmed === 'photo url' || trimmed === 'photo_url' || trimmed === 'image url' || trimmed === 'image_url' || trimmed === 'image' || trimmed === 'profile image') {
    return 'photo_url';
  }
  if (trimmed === 'slug' || trimmed === 'public id' || trimmed === 'public_id') {
    return 'slug';
  }
  if (trimmed === 'joined at' || trimmed === 'joined_at' || trimmed === 'joined date' || trimmed === 'joined_date') {
    return 'joined_at';
  }

  return trimmed.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Strict RFC 4180 CSV character-by-character scanner.
 */
export function parseCsv(csvString: string): { headers: string[]; rows: Record<string, string>[] } {
  if (!csvString || typeof csvString !== 'string') {
    return { headers: [], rows: [] };
  }

  // Strip UTF-8 Byte Order Mark (BOM) if present
  let input = csvString;
  if (input.charCodeAt(0) === 0xfeff) {
    input = input.slice(1);
  }

  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let lineNum = 1;
  let colNum = 1;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const nextChar = i + 1 < input.length ? input[i + 1] : '';

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++; // Skip the second quote
          colNum += 2;
        } else {
          // Closing quote
          inQuotes = false;
          colNum++;
        }
      } else {
        currentField += char;
        if (char === '\n') {
          lineNum++;
          colNum = 1;
        } else {
          colNum++;
        }
      }
    } else {
      if (char === '"') {
        if (currentField.trim().length > 0) {
          throw new CsvSyntaxError('Unexpected quote inside unquoted field', lineNum, colNum);
        }
        inQuotes = true;
        colNum++;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        colNum++;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++; // Skip CRLF pair
        }
        currentRow.push(currentField.trim());
        records.push(currentRow);
        currentRow = [];
        currentField = '';
        lineNum++;
        colNum = 1;
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        records.push(currentRow);
        currentRow = [];
        currentField = '';
        lineNum++;
        colNum = 1;
      } else {
        currentField += char;
        colNum++;
      }
    }
  }

  if (inQuotes) {
    throw new CsvSyntaxError('Unclosed quote at end of CSV file', lineNum, colNum);
  }

  // Push trailing field/row if present
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    records.push(currentRow);
  }

  // Filter out completely blank lines
  const nonEmptyRecords = records.filter(
    (r) => r.length > 0 && r.some((cell) => cell.trim().length > 0)
  );

  if (nonEmptyRecords.length === 0) {
    return { headers: [], rows: [] };
  }

  // First non-empty line is the header
  const rawHeaders = nonEmptyRecords[0];
  const headers = rawHeaders.map(normalizeHeaderKey);

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < nonEmptyRecords.length; r++) {
    const rawRow = nonEmptyRecords[r];
    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (key) {
        rowObj[key] = c < rawRow.length ? rawRow[c] : '';
      }
    }
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Escapes and formats a single cell for CSV output.
 */
export function formatCsvCell(val: unknown, sanitizeFormula = true): string {
  if (val === null || val === undefined) {
    return '';
  }

  let str = String(val);

  if (sanitizeFormula) {
    str = sanitizeCsvValue(str);
  }

  // If contains comma, quote, newline, or carriage return, enclose in quotes with doubled internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Serializes headers and record rows into an RFC 4180 CSV string.
 */
export function serializeCsv(
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[],
  options: { sanitizeFormulas?: boolean } = {}
): string {
  const sanitize = options.sanitizeFormulas !== false;
  const headerLine = columns.map((col) => formatCsvCell(col.label, false)).join(',');

  const lines = [headerLine];

  for (const row of rows) {
    const line = columns
      .map((col) => {
        const val = row[col.key];
        return formatCsvCell(val, sanitize);
      })
      .join(',');
    lines.push(line);
  }

  return lines.join('\r\n') + '\r\n';
}
