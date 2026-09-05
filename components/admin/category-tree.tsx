"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
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
          className={cn(
            "border-border/60 flex items-center gap-3 border-b py-2.5 pr-3",
            busy === node.id && "opacity-50",
          )}
          // Indent grows with the nesting depth, so it stays inline.
          style={{ paddingLeft: 12 + depth * 22 }}
        >
          <span
            className={cn(
              "text-foreground min-w-0 flex-1 text-[13px]",
              depth === 0 ? "font-semibold" : "font-normal",
            )}
          >
            {node.nameEn}
            <span className="text-muted-foreground ml-2 font-mono text-xs">
              {node.slug}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => move(siblings, index, -1)}
            disabled={index === 0}
            aria-label={`Move ${node.nameEn} up`}
            title="Move up"
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => move(siblings, index, 1)}
            disabled={index === siblings.length - 1}
            aria-label={`Move ${node.nameEn} down`}
            title="Move down"
          >
            <ChevronDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => rename(node)}
          >
            <Pencil />
            Rename
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            onClick={() => remove(node)}
            aria-label={`Delete ${node.nameEn}`}
            title="Delete"
          >
            <Trash2 />
          </Button>
        </div>
        {node.children.length > 0 && renderLevel(node.children, depth + 1)}
      </div>
    ));
  }

  if (nodes.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-[13px]">
        No categories yet.
      </p>
    );
  }

  return <div>{renderLevel(nodes, 0)}</div>;
}
