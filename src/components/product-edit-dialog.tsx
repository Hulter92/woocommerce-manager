"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import Image from "next/image";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { updateProduct, WooCommerceApiError } from "@/lib/woocommerce";
import type { WooSettings } from "@/lib/settings";
import type { WooCategory, WooProduct } from "@/lib/types";

interface WorkingImage {
  id?: number;
  src: string;
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

  const isVariable = product.type === "variable";

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
        <p className="text-sm text-muted">
          Pris och lager hanteras per variant — expandera produkten i listan.
        </p>
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
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Spinner />}
          Spara
        </Button>
      </div>
    </div>
  );
}
