import type { WooMonthlyReport } from "./types";

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("sv-SE", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatMonthlyReportText(report: WooMonthlyReport): string {
  const lines: string[] = [];
  lines.push(`MÅNADSRAPPORT ${report.yearMonth}`);
  lines.push("");
  lines.push(`1930 Bank: ${formatAmount(report.bankTotal, report.currency)}`);
  lines.push(`2630 Utgående moms 6%: ${formatAmount(report.vatTotal, report.currency)}`);
  lines.push("");
  for (const location of report.locations) {
    lines.push(`3068 ${location.name}: ${formatAmount(location.netSales, report.currency)}`);
  }
  if (report.refundsTotal !== 0) {
    lines.push(`3068 Återbetalningar: ${formatAmount(report.refundsTotal, report.currency)}`);
  }
  lines.push("");
  lines.push(`Totalt: ${formatAmount(report.bankTotal, report.currency)}`);
  lines.push(`Antal ordrar: ${report.orderCount}`);
  return lines.join("\n");
}

export function formatMonthlyReportCsv(report: WooMonthlyReport): string {
  const rows: (string | number)[][] = [
    ["Konto", "Beskrivning", "Belopp"],
    ["1930", "Bank", report.bankTotal.toFixed(2)],
    ["2630", "Utgående moms 6%", report.vatTotal.toFixed(2)],
    ...report.locations.map((location) => ["3068", location.name, location.netSales.toFixed(2)]),
  ];
  if (report.refundsTotal !== 0) {
    rows.push(["3068", "Återbetalningar", report.refundsTotal.toFixed(2)]);
  }
  rows.push([]);
  rows.push(["", "Totalt", report.bankTotal.toFixed(2)]);
  rows.push(["", "Antal ordrar", report.orderCount]);

  const csv = rows.map((row) => row.join(";")).join("\r\n");
  // UTF-8 BOM so Excel on Windows renders å/ä/ö correctly instead of mojibake.
  return `﻿${csv}`;
}
