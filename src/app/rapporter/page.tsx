"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useSettings } from "@/components/settings-provider";
import { ConnectionGate } from "@/components/connection-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { LoadingBlock } from "@/components/ui/spinner";
import { getReport, WooCommerceApiError } from "@/lib/woocommerce";
import { formatReportCsv, formatReportText } from "@/lib/report-format";
import type { WooReport, WooReportGranularity } from "@/lib/types";

const GRANULARITY_OPTIONS: { value: WooReportGranularity; label: string }[] = [
  { value: "day", label: "Dag" },
  { value: "month", label: "Månad" },
  { value: "year", label: "År" },
  { value: "range", label: "Anpassad" },
];

const FILENAME_PREFIX: Record<WooReportGranularity, string> = {
  day: "Dagsrapport",
  month: "Manadsrapport",
  year: "Arsrapport",
  range: "Periodrapport",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultPeriod(granularity: WooReportGranularity): string {
  const now = new Date();
  if (granularity === "day") {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return toDateValue(yesterday);
  }
  if (granularity === "year") {
    return String(now.getFullYear());
  }
  if (granularity === "range") {
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    return `${toDateValue(from)}..${toDateValue(to)}`;
  }
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${lastMonth.getFullYear()}-${pad(lastMonth.getMonth() + 1)}`;
}

function filenamePeriod(report: WooReport): string {
  return report.period.replace("..", "_");
}

function isPeriodComplete(granularity: WooReportGranularity, period: string): boolean {
  if (granularity !== "range") return Boolean(period);
  const [from, to] = period.split("..");
  return Boolean(from) && Boolean(to);
}

export default function RapporterPage() {
  const { settings, configured } = useSettings();
  const [granularity, setGranularity] = useState<WooReportGranularity>("month");
  const [period, setPeriod] = useState(() => defaultPeriod("month"));
  const [report, setReport] = useState<WooReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  function changeGranularity(next: WooReportGranularity) {
    setGranularity(next);
    setPeriod(defaultPeriod(next));
  }

  useEffect(() => {
    if (!configured || !isPeriodComplete(granularity, period)) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const data = await getReport(settings, granularity, period);
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
  }, [configured, settings, granularity, period]);

  async function handleSaveText() {
    if (!report) return;
    setSaveError(null);
    try {
      const path = await save({
        defaultPath: `${FILENAME_PREFIX[report.granularity]}_${filenamePeriod(report)}.txt`,
        filters: [{ name: "Textfil", extensions: ["txt"] }],
      });
      if (path) await writeTextFile(path, formatReportText(report));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Kunde inte spara filen.");
    }
  }

  async function handleSaveCsv() {
    if (!report) return;
    setSaveError(null);
    try {
      const path = await save({
        defaultPath: `${FILENAME_PREFIX[report.granularity]}_${filenamePeriod(report)}.csv`,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (path) await writeTextFile(path, formatReportCsv(report));
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
            <p className="text-sm text-muted mt-1">Försäljningsrapport för bokföring, per hämtställe.</p>
          </div>
          <div className="flex gap-2">
            <Select
              value={granularity}
              onChange={(e) => changeGranularity(e.target.value as WooReportGranularity)}
              className="max-w-[120px]"
            >
              {GRANULARITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            {granularity === "day" && (
              <Input
                type="date"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="max-w-[160px]"
              />
            )}
            {granularity === "month" && (
              <Input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="max-w-[160px]"
              />
            )}
            {granularity === "year" && (
              <Input
                type="number"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="max-w-[100px]"
              />
            )}
            {granularity === "range" && (
              <>
                <Input
                  type="date"
                  value={period.split("..")[0]}
                  max={period.split("..")[1]}
                  onChange={(e) => setPeriod(`${e.target.value}..${period.split("..")[1]}`)}
                  className="max-w-[160px]"
                />
                <span className="self-center text-sm text-muted">till</span>
                <Input
                  type="date"
                  value={period.split("..")[1]}
                  min={period.split("..")[0]}
                  onChange={(e) => setPeriod(`${period.split("..")[0]}..${e.target.value}`)}
                  className="max-w-[160px]"
                />
              </>
            )}
          </div>
        </div>

        {loading && <LoadingBlock />}
        {error && <p className="text-sm text-danger">{error}</p>}
        {saveError && <p className="text-sm text-danger">{saveError}</p>}

        {report && !loading && (
          <Card>
            <CardContent className="space-y-4">
              {report.orderCount === 0 ? (
                <p className="text-sm text-muted text-center py-6">
                  Inga ordrar hittades för denna period.
                </p>
              ) : (
                <>
                  <pre className="whitespace-pre-wrap rounded-md bg-muted-bg p-4 text-sm font-mono">
                    {formatReportText(report)}
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
