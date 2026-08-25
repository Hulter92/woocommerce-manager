"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { Save } from "lucide-react";
import { useSettings } from "@/components/settings-provider";
import { ConnectionGate } from "@/components/connection-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock, Spinner } from "@/components/ui/spinner";
import { listProducts, updateProduct, WooCommerceApiError } from "@/lib/woocommerce";
import type { WooProduct } from "@/lib/types";

const STOCK_LABEL: Record<WooProduct["stock_status"], { label: string; tone: "success" | "danger" | "warning" }> = {
  instock: { label: "I lager", tone: "success" },
  outofstock: { label: "Slut i lager", tone: "danger" },
  onbackorder: { label: "Restnoterad", tone: "warning" },
};

interface EditState {
  regular_price: string;
  stock_quantity: string;
}

export default function ProdukterPage() {
  const { settings, configured } = useSettings();
  const [products, setProducts] = useState<WooProduct[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [stockStatus, setStockStatus] = useState<"" | WooProduct["stock_status"]>("");
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<number, EditState>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const res = await listProducts(settings, { page, search, stockStatus: stockStatus || undefined });
        if (cancelled) return;
        setProducts(res.items);
        setTotalPages(Math.max(1, res.totalPages));
        setEdits(
          Object.fromEntries(
            res.items.map((p) => [
              p.id,
              { regular_price: p.regular_price, stock_quantity: String(p.stock_quantity ?? "") },
            ])
          )
        );
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte hämta produkter.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [configured, settings, page, search, stockStatus]);

  function isDirty(product: WooProduct) {
    const edit = edits[product.id];
    if (!edit) return false;
    return (
      edit.regular_price !== product.regular_price ||
      edit.stock_quantity !== String(product.stock_quantity ?? "")
    );
  }

  async function handleSave(product: WooProduct) {
    const edit = edits[product.id];
    if (!edit) return;
    setSavingId(product.id);
    setError(null);
    try {
      const updated = await updateProduct(settings, product.id, {
        regular_price: edit.regular_price,
        stock_quantity: edit.stock_quantity === "" ? null : Number(edit.stock_quantity),
      });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      setEdits((prev) => ({
        ...prev,
        [product.id]: {
          regular_price: updated.regular_price,
          stock_quantity: String(updated.stock_quantity ?? ""),
        },
      }));
    } catch (err) {
      setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte spara produkten.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <ConnectionGate>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Produkter</h1>
          <p className="text-sm text-muted mt-1">Redigera pris och lagersaldo.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Sök produkt eller SKU…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="max-w-xs"
          />
          <Select
            value={stockStatus}
            onChange={(e) => {
              setPage(1);
              setStockStatus(e.target.value as typeof stockStatus);
            }}
            className="max-w-[200px]"
          >
            <option value="">Alla lagerstatusar</option>
            <option value="instock">I lager</option>
            <option value="outofstock">Slut i lager</option>
            <option value="onbackorder">Restnoterad</option>
          </Select>
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
                    <th className="px-4 py-3 font-medium">Produkt</th>
                    <th className="px-4 py-3 font-medium">Pris</th>
                    <th className="px-4 py-3 font-medium">Lager</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const edit = edits[product.id] ?? { regular_price: "", stock_quantity: "" };
                    const dirty = isDirty(product);
                    const stockInfo = STOCK_LABEL[product.stock_status];
                    return (
                      <tr key={product.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {product.images[0] ? (
                              <Image
                                src={product.images[0].src}
                                alt={product.images[0].alt || product.name}
                                width={36}
                                height={36}
                                className="rounded object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="h-9 w-9 rounded bg-muted-bg" />
                            )}
                            <div>
                              <p className="font-medium">{product.name}</p>
                              {product.sku && (
                                <p className="text-xs text-muted">SKU: {product.sku}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={edit.regular_price}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [product.id]: { ...edit, regular_price: e.target.value },
                              }))
                            }
                            className="w-24"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            value={edit.stock_quantity}
                            disabled={!product.manage_stock}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [product.id]: { ...edit, stock_quantity: e.target.value },
                              }))
                            }
                            className="w-20"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={stockInfo.tone}>{stockInfo.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!dirty || savingId === product.id}
                            onClick={() => handleSave(product)}
                          >
                            {savingId === product.id ? <Spinner /> : <Save size={14} />}
                            Spara
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted" colSpan={5}>
                        Inga produkter hittades.
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
