"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { formatApiError } from "@/lib/http/form-error";

export type TreeNode = {
  id: string;
  nameEn: string;
  nameBn?: string;
  slug: string;
  parentId: string | null;
  position: number;
  children: TreeNode[];
};

export function CategoryTree({
  nodes,
  storefront = "marketplace",
}: {
  nodes: TreeNode[];
  storefront?: "instruments" | "marketplace";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(node: TreeNode, body: Record<string, unknown>) {
    setBusy(node.id);
    try {
      const res = await fetch(`/api/admin/categories/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: { en: node.nameEn, bn: node.nameBn || undefined },
          slug: node.slug,
          storefront,
          parentId: node.parentId ?? undefined,
          position: node.position,
          ...body,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) router.refresh();
      else window.alert(formatApiError(json));
    } finally {
      setBusy(null);
    }
  }

  async function rename(node: TreeNode) {
    const next = window.prompt("Category name (English)", node.nameEn);
    if (next == null || !next.trim()) return;
    await patch(node, {
      name: { en: next.trim(), bn: node.nameBn || undefined },
    });
  }

  async function move(siblings: TreeNode[], index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= siblings.length) return;
    // Reorder the sibling list, then re-number the WHOLE group 0..n-1 so the new
    // order sticks even when positions were all tied at 0 (a plain swap can't).
    const order = siblings.map((s) => s.id);
    [order[index], order[j]] = [order[j], order[index]];
    setBusy(siblings[index].id);
    try {
      const res = await fetch(`/api/admin/categories/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: order.map((id, position) => ({
            id,
            parentId: siblings[index].parentId,
            position,
          })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) router.refresh();
      else window.alert(formatApiError(json));
    } finally {
      setBusy(null);
    }
  }

  async function remove(node: TreeNode) {
    if (
      !window.confirm(
        `Delete "${node.nameEn}"${node.children.length ? " and its subcategories?" : "?"}`,
      )
    )
      return;
    setBusy(node.id);
    try {
      const res = await fetch(`/api/admin/categories/${node.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) router.refresh();
      else window.alert(formatApiError(json));
    } finally {
      setBusy(null);
    }
  }

  function renderLevel(siblings: TreeNode[], depth: number): React.ReactNode {
    return siblings.map((node, index) => (
      <div key={node.id}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-3)",
            padding: "10px 12px",
            paddingLeft: 12 + depth * 22,
            borderBottom: "1px solid var(--color-border)",
            opacity: busy === node.id ? 0.5 : 1,
          }}
        >
          <span
            style={{
              flex: 1,
              color: "var(--color-text-strong)",
              fontWeight: depth === 0 ? 600 : 400,
            }}
          >
            {node.nameEn}
            <span
              style={{
                marginLeft: 8,
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-caption)",
                color: "var(--color-text-muted)",
              }}
            >
              {node.slug}
            </span>
          </span>
          <button
            type="button"
            onClick={() => move(siblings, index, -1)}
            disabled={index === 0}
            style={iconBtn(index === 0)}
            aria-label={`Move ${node.nameEn} up`}
            title="Move up"
          >
            <ChevronUp size={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => move(siblings, index, 1)}
            disabled={index === siblings.length - 1}
            style={iconBtn(index === siblings.length - 1)}
            aria-label={`Move ${node.nameEn} down`}
            title="Move down"
          >
            <ChevronDown size={15} aria-hidden />
          </button>
          <button type="button" onClick={() => rename(node)} style={textBtn}>
            Rename
          </button>
          <button
            type="button"
            onClick={() => remove(node)}
            style={{ ...textBtn, color: "var(--color-error)" }}
          >
            Delete
          </button>
        </div>
        {node.children.length > 0 && renderLevel(node.children, depth + 1)}
      </div>
    ));
  }

  if (nodes.length === 0) {
    return (
      <p
        style={{
          padding: "var(--s-6)",
          color: "var(--color-text-muted)",
          margin: 0,
        }}
      >
        No categories yet.
      </p>
    );
  }

  return <div>{renderLevel(nodes, 0)}</div>;
}

const iconBtn = (disabled: boolean): React.CSSProperties => ({
  display: "inline-grid",
  placeItems: "center",
  width: 28,
  height: 28,
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  background: "transparent",
  cursor: disabled ? "default" : "pointer",
  color: disabled ? "var(--color-text-subtle)" : "var(--color-text)",
  opacity: disabled ? 0.45 : 1,
});
const textBtn: React.CSSProperties = {
  border: "none",
  background: "none",
  cursor: "pointer",
  color: "var(--color-text-muted)",
  fontSize: "var(--fs-small)",
  fontFamily: "inherit",
};
