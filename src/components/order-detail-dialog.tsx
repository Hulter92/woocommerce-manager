"use client";

import { useEffect, useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { LoadingBlock } from "@/components/ui/spinner";
import { OrderStatusBadge } from "@/components/status-badge";
import { getOrder, WooCommerceApiError } from "@/lib/woocommerce";
import type { WooSettings } from "@/lib/settings";
import type { WooAddress, WooOrder } from "@/lib/types";

function formatMoney(value: string | number, currency: string) {
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat("sv-SE", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value)
  );
}

function formatAddress(address: WooAddress) {
  const lines = [
    [address.first_name, address.last_name].filter(Boolean).join(" "),
    address.company,
    address.address_1,
    address.address_2,
    [address.postcode, address.city].filter(Boolean).join(" "),
    address.country,
  ].filter(Boolean);
  return lines;
}

export function OrderDetailDialog({
  orderId,
  settings,
  onClose,
}: {
  orderId: number | null;
  settings: WooSettings;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<WooOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    if (orderId === null) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const data = await getOrder(settings, orderId);
        if (cancelled) return;
        setOrder(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte hämta ordern.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, settings]);

  const hasShipping = order && formatAddress(order.shipping).length > 0;

  return (
    <Dialog open={orderId !== null} onClose={onClose} title={order ? `Order #${order.number}` : "Order"}>
      {loading && <LoadingBlock />}
      {error && <p className="text-sm text-danger">{error}</p>}
      {order && !loading && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <OrderStatusBadge status={order.status} />
            <p className="text-sm text-muted">{formatDate(order.date_created)}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted mb-1">Fakturaadress</p>
              <div className="text-sm space-y-0.5">
                {formatAddress(order.billing).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
                {order.billing.email && <p className="text-muted">{order.billing.email}</p>}
                {order.billing.phone && <p className="text-muted">{order.billing.phone}</p>}
              </div>
            </div>
            {hasShipping && (
              <div>
                <p className="text-xs font-medium text-muted mb-1">Leveransadress</p>
                <div className="text-sm space-y-0.5">
                  {formatAddress(order.shipping).map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted mb-2">Produkter</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-1.5 font-medium">Produkt</th>
                  <th className="py-1.5 font-medium text-right">Antal</th>
                  <th className="py-1.5 font-medium text-right">Á-pris</th>
                  <th className="py-1.5 font-medium text-right">Summa</th>
                </tr>
              </thead>
              <tbody>
                {order.line_items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-1.5">{item.name}</td>
                    <td className="py-1.5 text-right text-muted">{item.quantity}</td>
                    <td className="py-1.5 text-right text-muted">
                      {formatMoney(item.price, order.currency)}
                    </td>
                    <td className="py-1.5 text-right">{formatMoney(item.total, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border pt-3 space-y-1 text-sm ml-auto max-w-[220px]">
            <div className="flex justify-between text-muted">
              <span>Frakt</span>
              <span>{formatMoney(order.shipping_total, order.currency)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Moms</span>
              <span>{formatMoney(order.total_tax, order.currency)}</span>
            </div>
            {Number(order.discount_total) > 0 && (
              <div className="flex justify-between text-muted">
                <span>Rabatt</span>
                <span>-{formatMoney(order.discount_total, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-1 border-t border-border">
              <span>Totalt</span>
              <span>{formatMoney(order.total, order.currency)}</span>
            </div>
          </div>

          {order.customer_note && (
            <div>
              <p className="text-xs font-medium text-muted mb-1">Kundens meddelande</p>
              <p className="text-sm bg-muted-bg rounded-md p-3">{order.customer_note}</p>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
