"use client";

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { parseCsv } from "@/lib/csv";
import { createProduct, findProductBySku, updateProduct, WooCommerceApiError } from "@/lib/woocommerce";
import type { WooSettings } from "@/lib/settings";
import type { WooProduct } from "@/lib/types";

interface ParsedRow {
  sku: string;
  name: string;
  regularPrice: string;
  stockQuantity: string;
}

interface ImportResult {
  sku: string;
  name: string;
  outcome: "created" | "updated" | "error";
  error?: string;
}

function findColumn(header: string[], candidates: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

export function ProductImportDialog({
  settings,
  onClose,
  onImported,
}: {
  settings: WooSettings;
  onClose: () => void;
  onImported: (products: WooProduct[]) => void;
}) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  async function handlePickFile() {
    setFileError(null);
    try {
      const path = await open({ filters: [{ name: "CSV", extensions: ["csv"] }] });
      if (!path) return;
      const text = await readTextFile(path);
      const table = parseCsv(text);
      if (table.length < 2) {
        setFileError("Filen innehåller inga datarader.");
        return;
      }
      const [header, ...dataRows] = table;
      const skuCol = findColumn(header, ["sku"]);
      const nameCol = findColumn(header, ["namn", "name"]);
      const priceCol = findColumn(header, ["ordinarie pris", "regular_price", "pris", "price"]);
      const stockCol = findColumn(header, ["lager", "stock_quantity", "stock"]);
      if (skuCol === -1 || nameCol === -1) {
        setFileError('Hittade inte kolumnerna "sku" och "namn" i filen.');
        return;
      }
      const parsed: ParsedRow[] = dataRows
        .filter((r) => r.some((cell) => cell.trim() !== ""))
        .map((r) => ({
          sku: r[skuCol]?.trim() ?? "",
          name: r[nameCol]?.trim() ?? "",
          regularPrice: priceCol !== -1 ? r[priceCol]?.trim() ?? "" : "",
          stockQuantity: stockCol !== -1 ? r[stockCol]?.trim() ?? "" : "",
        }));
      setRows(parsed);
      setResults(null);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Kunde inte läsa filen.");
    }
  }

  async function handleImport() {
    if (!rows) return;
    setImporting(true);
    const outcomes: ImportResult[] = [];
    const imported: WooProduct[] = [];

    for (const row of rows) {
      if (!row.name) {
        outcomes.push({ sku: row.sku, name: row.name, outcome: "error", error: "Namn saknas." });
        continue;
      }
      try {
        const existing = row.sku ? await findProductBySku(settings, row.sku) : null;
        const stockQuantity = row.stockQuantity === "" ? undefined : Number(row.stockQuantity);
        if (existing) {
          const updated = await updateProduct(settings, existing.id, {
            name: row.name,
            ...(row.regularPrice ? { regular_price: row.regularPrice } : {}),
            ...(stockQuantity !== undefined ? { stock_quantity: stockQuantity } : {}),
          });
          imported.push(updated);
          outcomes.push({ sku: row.sku, name: row.name, outcome: "updated" });
        } else {
          const created = await createProduct(settings, {
            name: row.name,
            sku: row.sku || undefined,
            regular_price: row.regularPrice || undefined,
            stock_quantity: stockQuantity,
            manage_stock: stockQuantity !== undefined,
          });
          imported.push(created);
          outcomes.push({ sku: row.sku, name: row.name, outcome: "created" });
        }
      } catch (err) {
        outcomes.push({
          sku: row.sku,
          name: row.name,
          outcome: "error",
          error: err instanceof WooCommerceApiError ? err.message : "Okänt fel.",
        });
      }
    }

    if (imported.length > 0) onImported(imported);
    setResults(outcomes);
    setImporting(false);
  }

  return (
    <Dialog open onClose={onClose} title="Importera produkter från CSV">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Filen måste ha kolumnerna <strong>sku</strong> och <strong>namn</strong> (eller{" "}
          <strong>name</strong>), samt valfritt pris och lagersaldo. Produkter matchas mot
          befintliga via SKU — hittas ingen match skapas en ny produkt. Kategorier hanteras inte
          av importen.
        </p>

        {!rows && (
          <Button variant="secondary" onClick={handlePickFile}>
            Välj CSV-fil…
          </Button>
        )}

        {fileError && <p className="text-sm text-danger">{fileError}</p>}

        {rows && !results && (
          <>
            <div className="rounded-md border border-border max-h-56 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Namn</th>
                    <th className="px-3 py-2 font-medium">Pris</th>
                    <th className="px-3 py-2 font-medium">Lager</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5">{row.sku}</td>
                      <td className="px-3 py-1.5">{row.name}</td>
                      <td className="px-3 py-1.5">{row.regularPrice}</td>
                      <td className="px-3 py-1.5">{row.stockQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted">
              {rows.length} rad{rows.length === 1 ? "" : "er"} hittades
              {rows.length > 10 ? " (visar de första 10)" : ""}.
            </p>
          </>
        )}

        {results && (
          <div className="rounded-md border border-border max-h-56 overflow-y-auto">
            <ul className="text-sm divide-y divide-border">
              {results.map((r, i) => (
                <li key={i} className={`px-3 py-1.5 ${r.outcome === "error" ? "text-danger" : ""}`}>
                  {r.name || r.sku} —{" "}
                  {r.outcome === "created"
                    ? "Skapad"
                    : r.outcome === "updated"
                      ? "Uppdaterad"
                      : r.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>
            {results ? "Stäng" : "Avbryt"}
          </Button>
          {rows && !results && (
            <Button onClick={handleImport} disabled={importing || rows.length === 0}>
              {importing && <Spinner />}
              Importera {rows.length} produkter
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
