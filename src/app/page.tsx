"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, ShoppingCart, TrendingUp, Users, Wallet } from "lucide-react";
import { useSettings } from "@/components/settings-provider";
import { ConnectionGate } from "@/components/connection-gate";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { LoadingBlock } from "@/components/ui/spinner";
import { OrderStatusBadge } from "@/components/status-badge";
import {
  getCustomersTotal,
  getOrdersTotals,
  getOutOfStockCount,
  getRecentOrders,
  getSalesReport,
  getTopSellers,
  WooCommerceApiError,
} from "@/lib/woocommerce";
import type { WooOrder, WooOrdersTotals, WooReportPeriod, WooTopSeller } from "@/lib/types";

interface DashboardData {
  totalSales: string;
  currency: string;
  totalOrders: number;
  averageOrderValue: number;
  customersTotal: number;
  outOfStock: number;
  statusTotals: WooOrdersTotals[];
  topSellers: WooTopSeller[];
  recentOrders: WooOrder[];
}

const PERIOD_OPTIONS: { value: WooReportPeriod; label: string }[] = [
  { value: "today", label: "Idag" },
  { value: "week", label: "Denna vecka" },
  { value: "month", label: "Denna månad" },
  { value: "year", label: "Detta år" },
];

function formatMoney(value: number | string, currency: string) {
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat("sv-SE", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default function DashboardPage() {
  const { settings, configured } = useSettings();
  const [period, setPeriod] = useState<WooReportPeriod>("week");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const [sales, statusTotals, outOfStock, recentOrders, topSellers, customersTotal] =
          await Promise.all([
            getSalesReport(settings, period),
            getOrdersTotals(settings),
            getOutOfStockCount(settings),
            getRecentOrders(settings, 5),
            getTopSellers(settings, period),
            getCustomersTotal(settings),
          ]);
        if (cancelled) return;
        const currency = recentOrders[0]?.currency ?? "SEK";
        setData({
          totalSales: sales.total_sales,
          currency,
          totalOrders: sales.total_orders,
          averageOrderValue: sales.total_orders > 0 ? Number(sales.total_sales) / sales.total_orders : 0,
          customersTotal,
          outOfStock,
          statusTotals,
          topSellers,
          recentOrders,
        });
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte hämta data.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [configured, settings, period]);

  return (
    <ConnectionGate>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold">Översikt</h1>
            <p className="text-sm text-muted mt-1">Försäljningssiffror för vald period</p>
          </div>
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value as WooReportPeriod)}
            className="max-w-[180px]"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {loading && <LoadingBlock />}
        {error && <p className="text-sm text-danger">{error}</p>}

        {data && !loading && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                icon={TrendingUp}
                label="Försäljning"
                value={formatMoney(data.totalSales, data.currency)}
              />
              <StatCard icon={ShoppingCart} label="Ordrar" value={String(data.totalOrders)} />
              <StatCard
                icon={Wallet}
                label="Snitt per order"
                value={formatMoney(data.averageOrderValue, data.currency)}
              />
              <StatCard icon={Users} label="Kunder totalt" value={String(data.customersTotal)} />
              <StatCard
                icon={AlertTriangle}
                label="Slut i lager"
                value={String(data.outOfStock)}
                tone={data.outOfStock > 0 ? "warning" : undefined}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <Card>
                <CardHeader>
                  <p className="font-medium text-sm">Ordrar per status</p>
                  <p className="text-xs text-muted mt-0.5">Alla tider</p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {data.statusTotals
                    .filter((s) => s.total > 0)
                    .map((s) => (
                      <div
                        key={s.slug}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                      >
                        <span className="text-muted">{s.name}</span>
                        <span className="font-medium">{s.total}</span>
                      </div>
                    ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <p className="font-medium text-sm">Bästsäljare</p>
                  <p className="text-xs text-muted mt-0.5">
                    {PERIOD_OPTIONS.find((o) => o.value === period)?.label}
                  </p>
                </CardHeader>
                <CardContent>
                  {data.topSellers.length > 0 ? (
                    <TopSellersList items={data.topSellers} />
                  ) : (
                    <p className="text-sm text-muted text-center py-6">
                      Inga sålda produkter under perioden.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <p className="font-medium text-sm">Senaste ordrarna</p>
                <Link href="/ordrar" className="text-sm text-primary hover:underline">
                  Visa alla
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {data.recentOrders.map((order) => (
                      <tr key={order.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium">#{order.number}</td>
                        <td className="px-4 py-3 text-muted">
                          {order.billing.first_name} {order.billing.last_name}
                        </td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatMoney(order.total, order.currency)}
                        </td>
                      </tr>
                    ))}
                    {data.recentOrders.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-muted" colSpan={4}>
                          Inga ordrar än.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ConnectionGate>
  );
}

function TopSellersList({ items }: { items: WooTopSeller[] }) {
  const top = items.slice(0, 8);
  const max = Math.max(...top.map((i) => i.quantity), 1);
  return (
    <ol className="space-y-3">
      {top.map((item, index) => (
        <li key={item.product_id} className="flex items-center gap-3">
          <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{item.name}</p>
            <div className="mt-1 h-1.5 rounded-full bg-muted-bg">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max((item.quantity / max) * 100, 4)}%` }}
              />
            </div>
          </div>
          <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted">
            {item.quantity} st
          </span>
        </li>
      ))}
    </ol>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div
          className={`rounded-md p-2 ${
            tone === "warning" ? "bg-warning-bg text-warning" : "bg-primary/10 text-primary"
          }`}
        >
          <Icon size={18} />
        </div>
        <div>
          <p className="text-xs text-muted">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
