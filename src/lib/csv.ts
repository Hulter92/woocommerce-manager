import Papa from "papaparse";

function toCsvField(value: string | number): string {
  const str = String(value);
  if (/[;"\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows: (string | number)[][]): string {
  const csv = rows.map((row) => row.map(toCsvField).join(";")).join("\r\n");
  // UTF-8 BOM so Excel on Windows renders å/ä/ö correctly instead of mojibake.
  return `﻿${csv}`;
}

export function parseCsv(text: string): string[][] {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return result.data;
}
