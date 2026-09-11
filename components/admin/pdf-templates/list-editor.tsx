"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * A repeatable list inside a block form — the fields of a column, the rows of
 * a totals stack, the items of a bullet list. Up/down/remove per row and an
 * add button, in the same chrome the course builder gives its lessons.
 */
export function ListEditor<T>({
  label,
  items,
  onChange,
  render,
  newItem,
  addLabel = "Add",
  max,
  itemLabel = (i) => `Item ${i + 1}`,
}: {
  label?: string;
  items: T[];
  onChange: (items: T[]) => void;
  render: (
    item: T,
    patch: (p: Partial<T>) => void,
    index: number,
  ) => React.ReactNode;
  newItem: () => T;
  addLabel?: string;
  max?: number;
  itemLabel?: (index: number, item: T) => string;
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    onChange(arrayMove(items, from, to));
  };
  return (
    <div className="grid gap-2">
      {label && <p className="text-foreground text-sm font-medium">{label}</p>}
      {items.map((item, i) => (
        <Card key={i} className="gap-0 p-0">
          <div className="flex items-center gap-1 border-b px-2 py-1">
            <span className="text-muted-foreground text-admin-2xs font-mono tracking-[0.12em] uppercase">
              {itemLabel(i, item)}
            </span>
            <div className="ml-auto flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label="Move up"
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                onClick={() => move(i, i + 1)}
                disabled={i === items.length - 1}
                aria-label="Move down"
              >
                <ChevronDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label="Remove"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 px-3 py-3">
            {render(
              item,
              (p) =>
                onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x))),
              i,
            )}
          </div>
        </Card>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, newItem()])}
          disabled={max != null && items.length >= max}
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
