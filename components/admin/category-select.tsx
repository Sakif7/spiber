"use client";

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

  const sel: React.CSSProperties = {
    height: 40,
    padding: "0 10px",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--r-sm)",
    font: "inherit",
    background: "var(--color-surface)",
    width: "100%",
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <select
        style={sel}
        value={parentId}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Parent category"
      >
        {parents.length === 0 && (
          <option value="">— create a category first —</option>
        )}
        {parents.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {subs.length > 0 && (
        <select
          style={sel}
          value={subValue}
          onChange={(e) => onChange(e.target.value || parentId)}
          aria-label="Subcategory"
        >
          <option value="">All of {parentName}</option>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
