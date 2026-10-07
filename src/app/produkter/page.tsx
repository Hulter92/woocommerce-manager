"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { useSettings } from "@/components/settings-provider";
import { ConnectionGate } from "@/components/connection-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock } from "@/components/ui/spinner";
import { ProductEditDialog } from "@/components/product-edit-dialog";
import { BulkEditDialog } from "@/components/bulk-edit-dialog";
import { listCategories, listProducts, WooCommerceApiError } from "@/lib/woocommerce";
import type { WooCategory, WooProduct } from "@/lib/types";

const STOCK_LABEL: Record<WooProduct["stock_status"], { label: string; tone: "success" | "danger" | "warning" }> = {
  instock: { label: "I lager", tone: "success" },
  outofstock: { label: "Slut i lager", tone: "danger" },
  onbackorder: { label: "Restnoterad", tone: "warning" },
};

export default function ProdukterPage() {
  const { settings, configured } = useSettings();
  const [products, setProducts] = useState<WooProduct[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [stockStatus, setStockStatus] = useState<"" | WooProduct["stock_status"]>("");
  const [categoryId, setCategoryId] = useState<"" | number>("");
  const [categories, setCategories] = useState<WooCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();
  const [editingProduct, setEditingProduct] = useState<WooProduct | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEditing, setBulkEditing] = useState(false);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    listCategories(settings)
      .then((cats) => {
        if (!cancelled) setCategories(cats);
      })
      .catch(() => {
        // Non-critical — the category filter just won't have options.
      });
    return () => {
      cancelled = true;
    };
  }, [configured, settings]);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const res = await listProducts(settings, {
          page,
          search,
          stockStatus: stockStatus || undefined,
          categoryId: categoryId || undefined,
        });
        if (cancelled) return;
        setProducts(res.items);
        setTotalPages(Math.max(1, res.totalPages));
        setSelectedIds(new Set());
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte hämta produkter.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [configured, settings, page, search, stockStatus, categoryId]);

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === products.length ? new Set() : new Set(products.map((p) => p.id))
    );
  }

  const selectedProducts = products.filter((p) => selectedIds.has(p.id));

  return (
    <ConnectionGate>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Produkter</h1>
          <p className="text-sm text-muted mt-1">Klicka på pennan för att redigera en produkt.</p>
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
          <Select
            value={categoryId}
            onChange={(e) => {
              setPage(1);
              setCategoryId(e.target.value ? Number(e.target.value) : "");
            }}
            className="max-w-[200px]"
          >
            <option value="">Alla kategorier</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.count})
              </option>
            ))}
          </Select>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted-bg px-4 py-2.5">
            <p className="text-sm font-medium">{selectedIds.size} markerade</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
                Avmarkera
              </Button>
              <Button size="sm" onClick={() => setBulkEditing(true)}>
                Redigera markerade
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <LoadingBlock />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-3 font-medium w-8">
                      <input
                        type="checkbox"
                        checked={products.length > 0 && selectedIds.size === products.length}
                        onChange={toggleSelectAll}
                        aria-label="Markera alla på sidan"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Produkt</th>
                    <th className="px-4 py-3 font-medium">Pris</th>
                    <th className="px-4 py-3 font-medium">Lager</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const isVariable = product.type === "variable";
                    const stockInfo = STOCK_LABEL[product.stock_status];

                    return (
                      <tr key={product.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={() => toggleSelected(product.id)}
                            aria-label={`Markera ${product.name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
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
                              <div className="h-9 w-9 rounded bg-muted-bg shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium truncate">{product.name}</p>
                              {product.sku && (
                                <p className="text-xs text-muted">SKU: {product.sku}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isVariable ? "Varierar" : product.regular_price || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isVariable ? "—" : product.manage_stock ? (product.stock_quantity ?? 0) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={stockInfo.tone}>{stockInfo.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setEditingProduct(product)}
                            className="text-muted hover:text-foreground"
                            aria-label="Redigera produkt"
                            title="Redigera namn, pris, lager, kategorier och bilder"
                          >
                            <Pencil size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted" colSpan={6}>
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

      <ProductEditDialog
        product={editingProduct}
        categories={categories}
        settings={settings}
        onClose={() => setEditingProduct(null)}
        onSaved={(updated) => {
          setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        }}
      />

      {bulkEditing && (
        <BulkEditDialog
          products={selectedProducts}
          categories={categories}
          settings={settings}
          onClose={() => setBulkEditing(false)}
          onSaved={(updated) => {
            setProducts((prev) => {
              const byId = new Map(updated.map((p) => [p.id, p]));
              return prev.map((p) => byId.get(p.id) ?? p);
            });
            setSelectedIds(new Set());
          }}
        />
      )}
    </ConnectionGate>
  );
}
