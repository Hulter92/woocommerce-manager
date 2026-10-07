"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { updateProduct, WooCommerceApiError, type UpdateProductInput } from "@/lib/woocommerce";
import type { WooSettings } from "@/lib/settings";
import type { WooCategory, WooProduct } from "@/lib/types";

interface BulkResult {
  id: number;
  name: string;
  ok: boolean;
  error?: string;
}

export function BulkEditDialog({
  products,
  categories,
  settings,
  onClose,
  onSaved,
}: {
  products: WooProduct[];
  categories: WooCategory[];
  settings: WooSettings;
  onClose: () => void;
  onSaved: (updated: WooProduct[]) => void;
}) {
  const [applyPrice, setApplyPrice] = useState(false);
  const [price, setPrice] = useState("");
  const [applyStock, setApplyStock] = useState(false);
  const [stock, setStock] = useState("");
  const [applyStatus, setApplyStatus] = useState(false);
  const [status, setStatus] = useState<WooProduct["status"]>("publish");
  const [applyCategory, setApplyCategory] = useState(false);
  const [categoryId, setCategoryId] = useState<"" | number>("");
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<BulkResult[] | null>(null);

  const variableCount = products.filter((p) => p.type === "variable").length;
  const nothingSelected =
    !applyPrice && !applyStock && !applyStatus && !(applyCategory && categoryId !== "");

  async function handleSave() {
    setSaving(true);
    const outcomes: BulkResult[] = [];
    const updatedProducts: WooProduct[] = [];

    for (const product of products) {
      const body: UpdateProductInput = {};
      if (applyPrice && product.type !== "variable") body.regular_price = price;
      if (applyStock && product.type !== "variable") {
        body.stock_quantity = stock === "" ? null : Number(stock);
      }
      if (applyStatus) body.status = status;
      if (applyCategory && categoryId !== "") {
        const ids = new Set(product.categories.map((c) => c.id));
        ids.add(categoryId);
        body.categories = Array.from(ids, (id) => ({ id }));
      }
      if (Object.keys(body).length === 0) continue;

      try {
        const updated = await updateProduct(settings, product.id, body);
        updatedProducts.push(updated);
        outcomes.push({ id: product.id, name: product.name, ok: true });
      } catch (err) {
        outcomes.push({
          id: product.id,
          name: product.name,
          ok: false,
          error: err instanceof WooCommerceApiError ? err.message : "Okänt fel.",
        });
      }
    }

    if (updatedProducts.length > 0) onSaved(updatedProducts);
    setResults(outcomes);
    setSaving(false);
  }

  return (
    <Dialog open onClose={onClose} title={`Redigera ${products.length} markerade produkter`}>
      <div className="space-y-5">
        {(applyPrice || applyStock) && variableCount > 0 && (
          <p className="text-sm text-warning">
            {variableCount} varierande produkt{variableCount > 1 ? "er" : ""} hoppas över för
            pris/lager (sätts per variant).
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={applyPrice}
                onChange={(e) => setApplyPrice(e.target.checked)}
              />
              Ändra pris
            </label>
            {applyPrice && (
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Nytt pris"
                className="max-w-[160px] mt-1.5"
              />
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={applyStock}
                onChange={(e) => setApplyStock(e.target.checked)}
              />
              Ändra lagersaldo
            </label>
            {applyStock && (
              <Input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="Nytt lagersaldo"
                className="max-w-[160px] mt-1.5"
              />
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={applyStatus}
                onChange={(e) => setApplyStatus(e.target.checked)}
              />
              Ändra status
            </label>
            {applyStatus && (
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as WooProduct["status"])}
                className="max-w-[160px] mt-1.5"
              >
                <option value="publish">Publicerad</option>
                <option value="draft">Utkast</option>
                <option value="pending">Väntande</option>
                <option value="private">Privat</option>
              </Select>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={applyCategory}
                onChange={(e) => setApplyCategory(e.target.checked)}
              />
              Lägg till kategori
            </label>
            {applyCategory && (
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
                className="max-w-[220px] mt-1.5"
              >
                <option value="">Välj kategori…</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>

        {results && (
          <div className="rounded-md border border-border max-h-40 overflow-y-auto">
            <ul className="text-sm divide-y divide-border">
              {results.map((r) => (
                <li key={r.id} className={`px-3 py-1.5 ${r.ok ? "" : "text-danger"}`}>
                  {r.name} — {r.ok ? "Uppdaterad" : r.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>
            {results ? "Stäng" : "Avbryt"}
          </Button>
          {!results && (
            <Button onClick={handleSave} disabled={saving || nothingSelected}>
              {saving && <Spinner />}
              Tillämpa
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
