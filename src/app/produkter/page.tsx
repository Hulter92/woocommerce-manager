"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, Pencil, Save } from "lucide-react";
import { useSettings } from "@/components/settings-provider";
import { ConnectionGate } from "@/components/connection-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock, Spinner } from "@/components/ui/spinner";
import { ProductEditDialog } from "@/components/product-edit-dialog";
import {
  listCategories,
  listProducts,
  listVariations,
  updateVariation,
  WooCommerceApiError,
} from "@/lib/woocommerce";
import type { WooCategory, WooProduct, WooVariation } from "@/lib/types";

const STOCK_LABEL: Record<WooProduct["stock_status"], { label: string; tone: "success" | "danger" | "warning" }> = {
  instock: { label: "I lager", tone: "success" },
  outofstock: { label: "Slut i lager", tone: "danger" },
  onbackorder: { label: "Restnoterad", tone: "warning" },
};

interface EditState {
  regular_price: string;
  stock_quantity: string;
}

function toEditState(item: Pick<WooProduct | WooVariation, "regular_price" | "stock_quantity">): EditState {
  return { regular_price: item.regular_price, stock_quantity: String(item.stock_quantity ?? "") };
}

function variationLabel(variation: WooVariation): string {
  const attrs = variation.attributes.map((a) => a.option).filter(Boolean).join(" / ");
  return attrs || variation.sku || `Variant #${variation.id}`;
}

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

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [variationsByProduct, setVariationsByProduct] = useState<Record<number, WooVariation[]>>({});
  const [variationEdits, setVariationEdits] = useState<Record<number, EditState>>({});
  const [loadingVariationsFor, setLoadingVariationsFor] = useState<number | null>(null);
  const [savingVariationId, setSavingVariationId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<WooProduct | null>(null);

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

  function isDirty(edit: EditState | undefined, item: Pick<WooProduct | WooVariation, "regular_price" | "stock_quantity">) {
    if (!edit) return false;
    return edit.regular_price !== item.regular_price || edit.stock_quantity !== String(item.stock_quantity ?? "");
  }

  async function toggleExpand(product: WooProduct) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(product.id)) {
        next.delete(product.id);
      } else {
        next.add(product.id);
      }
      return next;
    });

    if (variationsByProduct[product.id]) return;
    setLoadingVariationsFor(product.id);
    try {
      const variations = await listVariations(settings, product.id);
      setVariationsByProduct((prev) => ({ ...prev, [product.id]: variations }));
      setVariationEdits((prev) => ({
        ...prev,
        ...Object.fromEntries(variations.map((v) => [v.id, toEditState(v)])),
      }));
    } catch (err) {
      setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte hämta varianter.");
    } finally {
      setLoadingVariationsFor(null);
    }
  }

  async function handleSaveVariation(productId: number, variation: WooVariation) {
    const edit = variationEdits[variation.id];
    if (!edit) return;
    setSavingVariationId(variation.id);
    setError(null);
    try {
      const updated = await updateVariation(settings, productId, variation.id, {
        regular_price: edit.regular_price,
        stock_quantity: edit.stock_quantity === "" ? null : Number(edit.stock_quantity),
      });
      setVariationsByProduct((prev) => ({
        ...prev,
        [productId]: (prev[productId] ?? []).map((v) => (v.id === variation.id ? updated : v)),
      }));
      setVariationEdits((prev) => ({ ...prev, [variation.id]: toEditState(updated) }));
    } catch (err) {
      setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte spara varianten.");
    } finally {
      setSavingVariationId(null);
    }
  }

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
                    const isVariable = product.type === "variable";
                    const stockInfo = STOCK_LABEL[product.stock_status];
                    const isExpanded = expanded.has(product.id);
                    const variations = variationsByProduct[product.id];

                    return (
                      <Fragment key={product.id}>
                        <tr className="border-b border-border last:border-0">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isVariable && (
                                <button
                                  onClick={() => toggleExpand(product)}
                                  className="shrink-0 text-muted hover:text-foreground"
                                  aria-label={isExpanded ? "Dölj varianter" : "Visa varianter"}
                                >
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                              )}
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
                            {isVariable ? (
                              <button
                                onClick={() => toggleExpand(product)}
                                className="text-primary hover:underline"
                              >
                                Varierar
                              </button>
                            ) : (
                              product.regular_price || "—"
                            )}
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

                        {isVariable && isExpanded && (
                          <tr className="border-b border-border last:border-0">
                            <td colSpan={5} className="bg-muted-bg/50 px-4 py-3">
                              {loadingVariationsFor === product.id ? (
                                <LoadingBlock label="Laddar varianter…" />
                              ) : variations && variations.length > 0 ? (
                                <table className="w-full text-sm">
                                  <tbody>
                                    {variations.map((variation) => {
                                      const vEdit =
                                        variationEdits[variation.id] ?? toEditState(variation);
                                      const vDirty = isDirty(vEdit, variation);
                                      const vStockInfo = STOCK_LABEL[variation.stock_status];
                                      return (
                                        <tr key={variation.id} className="border-b border-border last:border-0">
                                          <td className="py-2 pl-6">{variationLabel(variation)}</td>
                                          <td className="py-2">
                                            <Input
                                              value={vEdit.regular_price}
                                              onChange={(e) =>
                                                setVariationEdits((prev) => ({
                                                  ...prev,
                                                  [variation.id]: { ...vEdit, regular_price: e.target.value },
                                                }))
                                              }
                                              className="w-24"
                                            />
                                          </td>
                                          <td className="py-2">
                                            <Input
                                              type="number"
                                              value={vEdit.stock_quantity}
                                              disabled={!variation.manage_stock}
                                              onChange={(e) =>
                                                setVariationEdits((prev) => ({
                                                  ...prev,
                                                  [variation.id]: { ...vEdit, stock_quantity: e.target.value },
                                                }))
                                              }
                                              className="w-20"
                                            />
                                          </td>
                                          <td className="py-2">
                                            <Badge tone={vStockInfo.tone}>{vStockInfo.label}</Badge>
                                          </td>
                                          <td className="py-2 text-right">
                                            <Button
                                              size="sm"
                                              variant="secondary"
                                              disabled={!vDirty || savingVariationId === variation.id}
                                              onClick={() => handleSaveVariation(product.id, variation)}
                                            >
                                              {savingVariationId === variation.id ? (
                                                <Spinner />
                                              ) : (
                                                <Save size={14} />
                                              )}
                                              Spara
                                            </Button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-sm text-muted py-2">Inga varianter hittades.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
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

      <ProductEditDialog
        product={editingProduct}
        categories={categories}
        settings={settings}
        onClose={() => setEditingProduct(null)}
        onSaved={(updated) => {
          setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        }}
      />
    </ConnectionGate>
  );
}
