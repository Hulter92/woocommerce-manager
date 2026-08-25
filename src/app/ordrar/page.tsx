"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSettings } from "@/components/settings-provider";
import { ConnectionGate } from "@/components/connection-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { ORDER_STATUS_OPTIONS, OrderStatusBadge } from "@/components/status-badge";
import { listOrders, updateOrderStatus, WooCommerceApiError } from "@/lib/woocommerce";
import type { WooOrder, WooOrderStatus } from "@/lib/types";

function formatMoney(value: string, currency: string) {
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat("sv-SE", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value)
  );
}

export default function OrdrarPage() {
  return (
    <Suspense>
      <OrdrarPageInner />
    </Suspense>
  );
}

function OrdrarPageInner() {
  const { settings, configured } = useSettings();
  const searchParams = useSearchParams();
  const router = useRouter();
  const customerId = searchParams.get("customer") ? Number(searchParams.get("customer")) : undefined;
  const [orders, setOrders] = useState<WooOrder[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<WooOrderStatus | "any">("any");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const res = await listOrders(settings, { page, status, search, customerId });
        if (cancelled) return;
        setOrders(res.items);
        setTotalPages(Math.max(1, res.totalPages));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte hämta ordrar.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [configured, settings, page, status, search, customerId]);

  async function handleStatusChange(order: WooOrder, next: WooOrderStatus) {
    setUpdatingId(order.id);
    try {
      const updated = await updateOrderStatus(settings, order.id, next);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    } catch (err) {
      setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte uppdatera order.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <ConnectionGate>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Ordrar</h1>
          <p className="text-sm text-muted mt-1">Se och hantera dina beställningar.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Sök order, namn eller e-post…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="max-w-xs"
          />
          <Select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as WooOrderStatus | "any");
            }}
            className="max-w-[200px]"
          >
            <option value="any">Alla statusar</option>
            {ORDER_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          {customerId && (
            <button
              onClick={() => router.push("/ordrar")}
              className="text-sm text-primary hover:underline"
            >
              Filtrerar på kund #{customerId} · rensa
            </button>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <LoadingBlock />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Kund</th>
                    <th className="px-4 py-3 font-medium">Datum</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-4 py-3 font-medium">#{order.number}</td>
                      <td className="px-4 py-3">
                        <p>
                          {order.billing.first_name} {order.billing.last_name}
                        </p>
                        <p className="text-xs text-muted">{order.billing.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{formatDate(order.date_created)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <OrderStatusBadge status={order.status} />
                          <Select
                            value={order.status}
                            disabled={updatingId === order.id}
                            onChange={(e) =>
                              handleStatusChange(order, e.target.value as WooOrderStatus)
                            }
                            className="!w-auto text-xs py-1"
                          >
                            {ORDER_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatMoney(order.total, order.currency)}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted" colSpan={5}>
                        Inga ordrar hittades.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Sida {page} av {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Föregående
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Nästa
            </Button>
          </div>
        </div>
      </div>
    </ConnectionGate>
  );
}
