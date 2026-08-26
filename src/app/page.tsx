"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Coins, Percent, Receipt, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { useSettings } from "@/components/settings-provider";
import { ConnectionGate } from "@/components/connection-gate";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { LoadingBlock } from "@/components/ui/spinner";
import { OrderStatusBadge } from "@/components/status-badge";
import { getDashboardStats, getRecentOrders, WooCommerceApiError } from "@/lib/woocommerce";
import type { WooOrder, WooReportPeriod, WooTopSeller } from "@/lib/types";

interface DashboardData {
  totalSales: number;
  netRevenue: number;
  grossSales: number;
  taxes: number;
  currency: string;
  totalOrders: number;
  averageOrderValue: number;
  topSellers: WooTopSeller[];
  recentOrders: WooOrder[];
}

const PERIOD_OPTIONS: { value: WooReportPeriod; label: string }[] = [
  { value: "today", label: "Idag" },
  { value: "week", label: "Denna vecka" },
  { value: "month", label: "Denna månad" },
  { value: "last_month", label: "Föregående månad" },
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
        const [{ revenue, topSellers }, recentOrders] = await Promise.all([
          getDashboardStats(settings, period),
          getRecentOrders(settings, 5),
        ]);
        if (cancelled) return;
        const currency = recentOrders[0]?.currency ?? "SEK";
        setData({
          totalSales: revenue.totalSales,
          netRevenue: revenue.netRevenue,
          grossSales: revenue.grossSales,
          taxes: revenue.taxes,
          currency,
          totalOrders: revenue.ordersCount,
          averageOrderValue: revenue.ordersCount > 0 ? revenue.totalSales / revenue.ordersCount : 0,
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
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard
                icon={TrendingUp}
                label="Totalförsäljning"
                value={formatMoney(data.totalSales, data.currency)}
              />
              <StatCard
                icon={Wallet}
                label="Nettoförsäljning"
                value={formatMoney(data.netRevenue, data.currency)}
              />
              <StatCard
                icon={Receipt}
                label="Bruttoförsäljning"
                value={formatMoney(data.grossSales, data.currency)}
              />
              <StatCard icon={Percent} label="Total moms" value={formatMoney(data.taxes, data.currency)} />
              <StatCard icon={ShoppingCart} label="Ordrar" value={String(data.totalOrders)} />
              <StatCard
                icon={Coins}
                label="Snitt per order"
                value={formatMoney(data.averageOrderValue, data.currency)}
              />
            </div>

            <Card>
              <CardHeader>
                <p className="font-medium text-sm">Bästsäljare</p>
                <p className="text-xs text-muted mt-0.5">
                  {PERIOD_OPTIONS.find((o) => o.value === period)?.label}
                </p>
              </CardHeader>
              <CardContent>
                {data.topSellers.length > 0 ? (
                  <TopSellersList items={data.topSellers} currency={data.currency} />
                ) : (
                  <p className="text-sm text-muted text-center py-6">
                    Inga sålda produkter under perioden.
                  </p>
                )}
              </CardContent>
            </Card>

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

function TopSellersList({ items, currency }: { items: WooTopSeller[]; currency: string }) {
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
          <div className="w-20 shrink-0 text-right">
            <p className="text-sm tabular-nums">{item.quantity} st</p>
            <p className="text-xs tabular-nums text-muted">
              {formatMoney(item.netRevenue, currency)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="rounded-md p-2 bg-primary/10 text-primary">
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
