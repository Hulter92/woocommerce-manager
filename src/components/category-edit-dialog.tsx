"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  createCategory,
  updateCategory,
  WooCommerceApiError,
  type CategoryInput,
} from "@/lib/woocommerce";
import type { WooSettings } from "@/lib/settings";
import type { WooCategory } from "@/lib/types";

export function CategoryEditDialog({
  target,
  categories,
  settings,
  onClose,
  onSaved,
}: {
  target: WooCategory | "new" | null;
  categories: WooCategory[];
  settings: WooSettings;
  onClose: () => void;
  onSaved: (category: WooCategory) => void;
}) {
  const isNew = target === "new";
  const editing = isNew ? null : target;

  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={isNew ? "Ny kategori" : `Redigera ${editing?.name ?? ""}`}
    >
      {target !== null && (
        <CategoryForm
          key={isNew ? "new" : editing!.id}
          editing={editing}
          categories={categories}
          settings={settings}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

function CategoryForm({
  editing,
  categories,
  settings,
  onClose,
  onSaved,
}: {
  editing: WooCategory | null;
  categories: WooCategory[];
  settings: WooSettings;
  onClose: () => void;
  onSaved: (category: WooCategory) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [parentId, setParentId] = useState<"" | number>(editing?.parent || "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentOptions = categories.filter((c) => !editing || c.id !== editing.id);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const input: CategoryInput = {
        name,
        parent: parentId === "" ? 0 : parentId,
        description,
      };
      const saved = editing
        ? await updateCategory(settings, editing.id, input)
        : await createCategory(settings, input);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof WooCommerceApiError ? err.message : "Kunde inte spara kategorin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="category-name">Namn</Label>
        <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <Label htmlFor="category-parent">Överordnad kategori</Label>
        <Select
          id="category-parent"
          value={parentId}
          onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Ingen</option>
          {parentOptions.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="category-description">Beskrivning</Label>
        <Textarea
          id="category-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="secondary" onClick={onClose}>
          Avbryt
        </Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving && <Spinner />}
          Spara
        </Button>
      </div>
    </div>
  );
}
