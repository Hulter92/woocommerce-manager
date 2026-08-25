"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useSettings } from "@/components/settings-provider";
import { ConnectionGate } from "@/components/connection-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingBlock } from "@/components/ui/spinner";
import { getMonthlyReport, WooCommerceApiError } from "@/lib/woocommerce";
import { formatMonthlyReportCsv, formatMonthlyReportText } from "@/lib/report-format";
import type { WooMonthlyReport } from "@/lib/types";

function defaultYearMonth(): string {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
}

export default function RapporterPage() {
  const { settings, configured } = useSettings();
  const [yearMonth, setYearMonth] = useState(defaultYearMonth);
  const [report, setReport] = useState<WooMonthlyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    if (!configured || !yearMonth) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const data = await getMonthlyReport(settings, yearMonth);
        if (cancelled) return;
        setReport(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte hämta rapporten.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [configured, settings, yearMonth]);

  async function handleSaveText() {
    if (!report) return;
    setSaveError(null);
    try {
      const path = await save({
        defaultPath: `Manadsrapport_${report.yearMonth}.txt`,
        filters: [{ name: "Textfil", extensions: ["txt"] }],
      });
      if (path) await writeTextFile(path, formatMonthlyReportText(report));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Kunde inte spara filen.");
    }
  }

  async function handleSaveCsv() {
    if (!report) return;
    setSaveError(null);
    try {
      const path = await save({
        defaultPath: `Manadsrapport_${report.yearMonth}.csv`,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (path) await writeTextFile(path, formatMonthlyReportCsv(report));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Kunde inte spara filen.");
    }
  }

  return (
    <ConnectionGate>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold">Rapporter</h1>
            <p className="text-sm text-muted mt-1">Månadsrapport för bokföring, per hämtställe.</p>
          </div>
          <Input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="max-w-[180px]"
          />
        </div>

        {loading && <LoadingBlock />}
        {error && <p className="text-sm text-danger">{error}</p>}
        {saveError && <p className="text-sm text-danger">{saveError}</p>}

        {report && !loading && (
          <Card>
            <CardContent className="space-y-4">
              {report.orderCount === 0 ? (
                <p className="text-sm text-muted text-center py-6">
                  Inga ordrar hittades för denna månad.
                </p>
              ) : (
                <>
                  <pre className="whitespace-pre-wrap rounded-md bg-muted-bg p-4 text-sm font-mono">
                    {formatMonthlyReportText(report)}
                  </pre>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={handleSaveText}>
                      <Download size={14} />
                      Spara som .txt
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleSaveCsv}>
                      <FileSpreadsheet size={14} />
                      Spara som CSV
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ConnectionGate>
  );
}
