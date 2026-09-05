"use client";

import { SelectField } from "./ui/select-field";

export type CategoryOption = {
  id: string;
  name: string;
  parentId: string | null;
};

/**
 * Two-step category picker for product forms. The first dropdown lists top-level
 * (parent) categories; when the chosen parent has subcategories, a second
 * dropdown appears for the sub. A product can sit on the parent itself
 * ("All of {parent}") or on a sub. Controlled by `value` (the saved categoryId —
 * a parent OR a sub id) and `onChange`.
 */
export function CategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (categoryId: string) => void;
}) {
  const parents = categories.filter((c) => !c.parentId);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const selected = byId.get(value);
  // Resolve the parent of the current value: a sub → its parent; a top-level
  // category → itself; nothing chosen yet → the first parent.
  const parentId = selected
    ? (selected.parentId ?? selected.id)
    : (parents[0]?.id ?? "");
  const subs = categories.filter((c) => c.parentId === parentId);
  const parentName = byId.get(parentId)?.name ?? "";
  // "" in the sub dropdown means "assign to the parent itself".
  const subValue = value === parentId ? "" : value;

  return (
    <div className="grid gap-1.5">
      <SelectField
        value={parentId}
        onChange={onChange}
        ariaLabel="Parent category"
        placeholder={
          parents.length === 0 ? "Create a category first" : "Choose a category"
        }
        options={parents.map((p) => ({ value: p.id, label: p.name }))}
      />
      {subs.length > 0 && (
        <SelectField
          value={subValue}
          onChange={(v) => onChange(v || parentId)}
          ariaLabel="Subcategory"
          emptyLabel={`All of ${parentName}`}
          options={subs.map((s) => ({ value: s.id, label: s.name }))}
        />
      )}
    </div>
  );
}
