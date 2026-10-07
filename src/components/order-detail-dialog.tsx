"use client";

import { useEffect, useState, useTransition } from "react";
import { Printer } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { LoadingBlock, Spinner } from "@/components/ui/spinner";
import { OrderStatusBadge } from "@/components/status-badge";
import { addOrderNote, getOrder, listOrderNotes, WooCommerceApiError } from "@/lib/woocommerce";
import type { WooSettings } from "@/lib/settings";
import type { WooAddress, WooOrder, WooOrderNote } from "@/lib/types";

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
  const [notes, setNotes] = useState<WooOrderNote[] | null>(null);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<"packing" | "invoice" | null>(null);

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
    listOrderNotes(settings, orderId)
      .then((data) => {
        if (!cancelled) setNotes(data);
      })
      .catch(() => {
        // Non-critical — the notes list just stays empty.
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, settings]);

  async function handleAddNote() {
    if (orderId === null || !newNote.trim()) return;
    setAddingNote(true);
    setNoteError(null);
    try {
      const note = await addOrderNote(settings, orderId, newNote.trim());
      setNotes((prev) => [note, ...(prev ?? [])]);
      setNewNote("");
    } catch (err) {
      setNoteError(err instanceof WooCommerceApiError ? err.message : "Kunde inte lägga till notering.");
    } finally {
      setAddingNote(false);
    }
  }

  function handlePrint(mode: "packing" | "invoice") {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 0);
  }

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

          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => handlePrint("packing")}>
              <Printer size={14} />
              Skriv ut följesedel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handlePrint("invoice")}>
              <Printer size={14} />
              Skriv ut faktura
            </Button>
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

          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium text-muted mb-2">Anteckningar</p>
            {notes === null ? (
              <p className="text-sm text-muted">Laddar…</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                {notes.length === 0 && <p className="text-sm text-muted">Inga anteckningar än.</p>}
                {notes.map((note) => (
                  <div key={note.id} className="text-sm bg-muted-bg rounded-md p-2.5">
                    <p className="text-xs text-muted mb-0.5">
                      {formatDate(note.date_created)}
                      {note.customer_note ? " · Synlig för kunden" : ""}
                    </p>
                    <p className="whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))}
              </div>
            )}
            {noteError && <p className="text-sm text-danger mb-2">{noteError}</p>}
            <div className="flex gap-2">
              <Textarea
                rows={2}
                placeholder="Lägg till en notering…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={addingNote || !newNote.trim()}
                className="self-end"
              >
                {addingNote && <Spinner />}
                Lägg till
              </Button>
            </div>
          </div>

          <div className="print-only">
            <h1 className="text-lg font-semibold mb-1">
              {printMode === "invoice" ? "Faktura" : "Följesedel"} — Order #{order.number}
            </h1>
            <p className="text-sm mb-4">{formatDate(order.date_created)}</p>

            <p className="text-xs font-medium mb-1">
              {printMode === "invoice" ? "Fakturaadress" : "Leveransadress"}
            </p>
            <div className="text-sm mb-4">
              {formatAddress(printMode === "invoice" || !hasShipping ? order.billing : order.shipping).map(
                (line, i) => (
                  <p key={i}>{line}</p>
                )
              )}
            </div>

            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left border-b border-black">
                  <th className="py-1">Produkt</th>
                  <th className="py-1 text-right">Antal</th>
                  {printMode === "invoice" && <th className="py-1 text-right">Summa</th>}
                </tr>
              </thead>
              <tbody>
                {order.line_items.map((item) => (
                  <tr key={item.id} className="border-b border-black/20">
                    <td className="py-1">{item.name}</td>
                    <td className="py-1 text-right">{item.quantity}</td>
                    {printMode === "invoice" && (
                      <td className="py-1 text-right">{formatMoney(item.total, order.currency)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {printMode === "invoice" && (
              <div className="text-sm ml-auto max-w-[220px] space-y-1">
                <div className="flex justify-between">
                  <span>Frakt</span>
                  <span>{formatMoney(order.shipping_total, order.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Moms</span>
                  <span>{formatMoney(order.total_tax, order.currency)}</span>
                </div>
                <div className="flex justify-between font-medium border-t border-black pt-1">
                  <span>Totalt</span>
                  <span>{formatMoney(order.total, order.currency)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
