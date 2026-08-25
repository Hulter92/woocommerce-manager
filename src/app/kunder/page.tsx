"use client";

import { useEffect, useState, useTransition } from "react";
import { useSettings } from "@/components/settings-provider";
import { ConnectionGate } from "@/components/connection-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { listCustomers, WooCommerceApiError } from "@/lib/woocommerce";
import type { WooCustomer } from "@/lib/types";
import Link from "next/link";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium" }).format(new Date(value));
}

export default function KunderPage() {
  const { settings, configured } = useSettings();
  const [customers, setCustomers] = useState<WooCustomer[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const res = await listCustomers(settings, { page, search });
        if (cancelled) return;
        setCustomers(res.items);
        setTotalPages(Math.max(1, res.totalPages));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte hämta kunder.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [configured, settings, page, search]);

  return (
    <ConnectionGate>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Kunder</h1>
          <p className="text-sm text-muted mt-1">Sök och se dina kunders uppgifter.</p>
        </div>

        <Input
          placeholder="Sök namn eller e-post…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="max-w-xs"
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <LoadingBlock />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-3 font-medium">Namn</th>
                    <th className="px-4 py-3 font-medium">E-post</th>
                    <th className="px-4 py-3 font-medium">Ort</th>
                    <th className="px-4 py-3 font-medium">Kund sedan</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {customer.first_name} {customer.last_name}
                      </td>
                      <td className="px-4 py-3 text-muted">{customer.email}</td>
                      <td className="px-4 py-3 text-muted">{customer.billing.city || "—"}</td>
                      <td className="px-4 py-3 text-muted">{formatDate(customer.date_created)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/ordrar?customer=${customer.id}`}>
                          <Button variant="ghost" size="sm">
                            Visa ordrar
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted" colSpan={5}>
                        Inga kunder hittades.
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
