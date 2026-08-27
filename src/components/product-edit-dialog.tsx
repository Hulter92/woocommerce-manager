"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import Image from "next/image";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { LoadingBlock, Spinner } from "@/components/ui/spinner";
import {
  listVariations,
  updateProduct,
  updateVariation,
  WooCommerceApiError,
} from "@/lib/woocommerce";
import type { WooSettings } from "@/lib/settings";
import type { WooCategory, WooProduct, WooVariation } from "@/lib/types";

interface WorkingImage {
  id?: number;
  src: string;
}

interface VariationEdit {
  regular_price: string;
  stock_quantity: string;
}

function toVariationEdit(v: WooVariation): VariationEdit {
  return { regular_price: v.regular_price, stock_quantity: String(v.stock_quantity ?? "") };
}

function variationLabel(variation: WooVariation): string {
  const attrs = variation.attributes.map((a) => a.option).filter(Boolean).join(" / ");
  return attrs || variation.sku || `Variant #${variation.id}`;
}

export function ProductEditDialog({
  product,
  categories,
  settings,
  onClose,
  onSaved,
}: {
  product: WooProduct | null;
  categories: WooCategory[];
  settings: WooSettings;
  onClose: () => void;
  onSaved: (updated: WooProduct) => void;
}) {
  return (
    <Dialog open={product !== null} onClose={onClose} title="Redigera produkt">
      {product && (
        <ProductEditForm
          key={product.id}
          product={product}
          categories={categories}
          settings={settings}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

function ProductEditForm({
  product,
  categories,
  settings,
  onClose,
  onSaved,
}: {
  product: WooProduct;
  categories: WooCategory[];
  settings: WooSettings;
  onClose: () => void;
  onSaved: (updated: WooProduct) => void;
}) {
  const isVariable = product.type === "variable";

  const [name, setName] = useState(product.name);
  const [regularPrice, setRegularPrice] = useState(product.regular_price);
  const [stockQuantity, setStockQuantity] = useState(String(product.stock_quantity ?? ""));
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(
    () => new Set(product.categories.map((c) => c.id))
  );
  const [images, setImages] = useState<WorkingImage[]>(() =>
    product.images.map((img) => ({ id: img.id, src: img.src }))
  );
  const [newImageUrl, setNewImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [variations, setVariations] = useState<WooVariation[] | null>(null);
  const [variationEdits, setVariationEdits] = useState<Record<number, VariationEdit>>({});
  const [loadingVariations, setLoadingVariations] = useState(isVariable);

  useEffect(() => {
    if (!isVariable) return;
    let cancelled = false;
    listVariations(settings, product.id)
      .then((data) => {
        if (cancelled) return;
        setVariations(data);
        setVariationEdits(Object.fromEntries(data.map((v) => [v.id, toVariationEdit(v)])));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte hämta varianter.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingVariations(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isVariable, product.id, settings]);

  function toggleCategory(id: number) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function addImageUrl() {
    const url = newImageUrl.trim();
    if (!url) return;
    setImages((prev) => [...prev, { src: url }]);
    setNewImageUrl("");
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProduct(settings, product.id, {
        name,
        categories: Array.from(selectedCategoryIds, (id) => ({ id })),
        images: images.map((img) => (img.id ? { id: img.id } : { src: img.src })),
        ...(isVariable
          ? {}
          : {
              regular_price: regularPrice,
              stock_quantity: stockQuantity === "" ? null : Number(stockQuantity),
            }),
      });

      if (isVariable && variations) {
        for (const variation of variations) {
          const edit = variationEdits[variation.id];
          if (!edit) continue;
          const changed =
            edit.regular_price !== variation.regular_price ||
            edit.stock_quantity !== String(variation.stock_quantity ?? "");
          if (!changed) continue;
          await updateVariation(settings, product.id, variation.id, {
            regular_price: edit.regular_price,
            stock_quantity: edit.stock_quantity === "" ? null : Number(edit.stock_quantity),
          });
        }
      }

      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte spara produkten.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="product-name">Namn</Label>
        <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {isVariable ? (
        <div>
          <Label>Varianter</Label>
          {loadingVariations ? (
            <LoadingBlock label="Laddar varianter…" />
          ) : variations && variations.length > 0 ? (
            <div className="max-h-56 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <tbody>
                  {variations.map((variation) => {
                    const edit = variationEdits[variation.id] ?? toVariationEdit(variation);
                    return (
                      <tr key={variation.id} className="border-b border-border last:border-0">
                        <td className="py-2 pl-3 pr-2">{variationLabel(variation)}</td>
                        <td className="py-2 pr-2">
                          <Input
                            value={edit.regular_price}
                            onChange={(e) =>
                              setVariationEdits((prev) => ({
                                ...prev,
                                [variation.id]: { ...edit, regular_price: e.target.value },
                              }))
                            }
                            className="w-20"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            type="number"
                            value={edit.stock_quantity}
                            disabled={!variation.manage_stock}
                            onChange={(e) =>
                              setVariationEdits((prev) => ({
                                ...prev,
                                [variation.id]: { ...edit, stock_quantity: e.target.value },
                              }))
                            }
                            className="w-16"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted py-1">Inga varianter hittades.</p>
          )}
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="product-price">Pris</Label>
            <Input
              id="product-price"
              value={regularPrice}
              onChange={(e) => setRegularPrice(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="product-stock">Lagersaldo</Label>
            <Input
              id="product-stock"
              type="number"
              value={stockQuantity}
              disabled={!product.manage_stock}
              onChange={(e) => setStockQuantity(e.target.value)}
            />
          </div>
        </div>
      )}

      <div>
        <Label>Kategorier</Label>
        <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 space-y-1">
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCategoryIds.has(cat.id)}
                onChange={() => toggleCategory(cat.id)}
              />
              {cat.name}
            </label>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted py-1">Inga kategorier hittades.</p>
          )}
        </div>
      </div>

      <div>
        <Label>Bilder</Label>
        <div className="flex flex-wrap gap-3">
          {images.map((img, index) => (
            <div key={img.id ?? img.src} className="relative">
              <Image
                src={img.src}
                alt=""
                width={64}
                height={64}
                className="rounded object-cover border border-border"
                unoptimized
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-1.5 -right-1.5 rounded-full bg-danger text-white p-0.5"
                aria-label="Ta bort bild"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Bild-URL…"
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addImageUrl();
              }
            }}
          />
          <Button variant="secondary" size="sm" onClick={addImageUrl}>
            <Plus size={14} />
            Lägg till
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="secondary" onClick={onClose}>
          Avbryt
        </Button>
        <Button onClick={handleSave} disabled={saving || loadingVariations}>
          {saving && <Spinner />}
          Spara
        </Button>
      </div>
    </div>
  );
}
