"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useSettings } from "@/components/settings-provider";
import { ConnectionGate } from "@/components/connection-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { CategoryEditDialog } from "@/components/category-edit-dialog";
import {
  deleteCategory,
  listCategories,
  updateCategory,
  WooCommerceApiError,
} from "@/lib/woocommerce";
import type { WooCategory } from "@/lib/types";

interface TreeRow {
  category: WooCategory;
  depth: number;
  siblings: WooCategory[];
  siblingIndex: number;
}

function buildTree(categories: WooCategory[]): TreeRow[] {
  const byParent = new Map<number, WooCategory[]>();
  for (const cat of categories) {
    const siblings = byParent.get(cat.parent) ?? [];
    siblings.push(cat);
    byParent.set(cat.parent, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.menu_order - b.menu_order);
  }

  const rows: TreeRow[] = [];
  function visit(parentId: number, depth: number) {
    const siblings = byParent.get(parentId) ?? [];
    siblings.forEach((category, siblingIndex) => {
      rows.push({ category, depth, siblings, siblingIndex });
      visit(category.id, depth + 1);
    });
  }
  visit(0, 0);
  return rows;
}

export default function KategorierPage() {
  const { settings, configured } = useSettings();
  const [categories, setCategories] = useState<WooCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();
  const [editTarget, setEditTarget] = useState<WooCategory | "new" | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = useCallback(() => {
    if (!configured) return;
    startTransition(async () => {
      try {
        const data = await listCategories(settings, { hideEmpty: false, orderby: "menu_order" });
        setCategories(data);
        setError(null);
      } catch (err) {
        setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte hämta kategorier.");
      }
    });
  }, [configured, settings, startTransition]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleDelete(category: WooCategory) {
    const warning =
      category.count > 0
        ? `Kategorin "${category.name}" används av ${category.count} produkt(er). De blir okategoriserade. Ta bort?`
        : `Ta bort kategorin "${category.name}"?`;
    if (!window.confirm(warning)) return;
    setBusyId(category.id);
    try {
      await deleteCategory(settings, category.id);
      reload();
    } catch (err) {
      setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte ta bort kategorin.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(row: TreeRow, direction: -1 | 1) {
    const targetIndex = row.siblingIndex + direction;
    const other = row.siblings[targetIndex];
    if (!other) return;
    setBusyId(row.category.id);
    try {
      await Promise.all([
        updateCategory(settings, row.category.id, { menu_order: other.menu_order }),
        updateCategory(settings, other.id, { menu_order: row.category.menu_order }),
      ]);
      reload();
    } catch (err) {
      setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte flytta kategorin.");
    } finally {
      setBusyId(null);
    }
  }

  const rows = buildTree(categories);

  return (
    <ConnectionGate>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold">Kategorier</h1>
            <p className="text-sm text-muted mt-1">
              Skapa, redigera, ta bort och sortera produktkategorier.
            </p>
          </div>
          <Button size="sm" onClick={() => setEditTarget("new")}>
            <Plus size={14} />
            Ny kategori
          </Button>
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
                    <th className="px-4 py-3 font-medium">Namn</th>
                    <th className="px-4 py-3 font-medium">Antal produkter</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const { category } = row;
                    const isBusy = busyId === category.id;
                    return (
                      <tr key={category.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3" style={{ paddingLeft: `${16 + row.depth * 20}px` }}>
                          {category.name}
                        </td>
                        <td className="px-4 py-3 text-muted">{category.count}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleMove(row, -1)}
                              disabled={isBusy || row.siblingIndex === 0}
                              className="text-muted hover:text-foreground disabled:opacity-30"
                              aria-label="Flytta upp"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              onClick={() => handleMove(row, 1)}
                              disabled={isBusy || row.siblingIndex === row.siblings.length - 1}
                              className="text-muted hover:text-foreground disabled:opacity-30"
                              aria-label="Flytta ner"
                            >
                              <ChevronDown size={16} />
                            </button>
                            <button
                              onClick={() => setEditTarget(category)}
                              disabled={isBusy}
                              className="text-muted hover:text-foreground"
                              aria-label="Redigera kategori"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(category)}
                              disabled={isBusy}
                              className="text-muted hover:text-danger"
                              aria-label="Ta bort kategori"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted" colSpan={3}>
                        Inga kategorier hittades.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <CategoryEditDialog
        target={editTarget}
        categories={categories}
        settings={settings}
        onClose={() => setEditTarget(null)}
        onSaved={() => reload()}
      />
    </ConnectionGate>
  );
}
