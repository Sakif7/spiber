"use client";

import type { CSSProperties } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Stamp,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormSection } from "@/components/admin/ui/form-shell";
import { cn } from "@/lib/cn";
import {
  ADDABLE_BLOCK_TYPES,
  BLOCK_INFO,
  blockSummary,
} from "@/lib/pdf/engine/catalogue";
import {
  FIXED_BLOCK_TYPES,
  OVERLAY_BLOCK_TYPES,
  type Block,
  type BlockOf,
  type BlockType,
} from "@/lib/schemas/pdf-template";
import type { StampAssetSummary } from "./stamp-form";

/**
 * The left-hand outline of the document: the stationery (shown or hidden,
 * never moved) and the content blocks in the order they print, sortable by
 * drag or keyboard, each selectable for the inspector.
 */

function Sortable({
  id,
  children,
}: {
  id: string;
  children: (
    handle: React.HTMLAttributes<HTMLButtonElement>,
  ) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({
        ...attributes,
        ...listeners,
      } as React.HTMLAttributes<HTMLButtonElement>)}
    </div>
  );
}

export function BlockList({
  blocks,
  selectedId,
  onSelect,
  onChange,
  onAdd,
  assets,
}: {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (blocks: Block[]) => void;
  onAdd: (type: BlockType) => void;
  assets: StampAssetSummary[];
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const stationery = blocks.filter((b) => FIXED_BLOCK_TYPES.has(b.type));
  const stamps = blocks.filter(
    (b): b is BlockOf<"stamp"> => b.type === "stamp",
  );
  const flow = blocks.filter(
    (b) => !FIXED_BLOCK_TYPES.has(b.type) && !OVERLAY_BLOCK_TYPES.has(b.type),
  );

  const patch = (id: string, p: Partial<Block>) =>
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...p } as Block) : b)));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = flow.findIndex((b) => b.id === active.id);
    const to = flow.findIndex((b) => b.id === over.id);
    if (from < 0 || to < 0) return;
    const reordered = arrayMove(flow, from, to);
    onChange([...stationery, ...stamps, ...reordered]);
  }

  function duplicate(block: Block) {
    const copy = {
      ...structuredClone(block),
      id: `${block.id.slice(0, 30)}-${Math.random().toString(36).slice(2, 6)}`,
    } as Block;
    const at = blocks.findIndex((b) => b.id === block.id);
    const next = [...blocks];
    next.splice(at + 1, 0, copy);
    onChange(next);
    onSelect(copy.id);
  }

  function remove(block: Block) {
    onChange(blocks.filter((b) => b.id !== block.id));
    if (selectedId === block.id) {
      const rest = flow.filter((b) => b.id !== block.id);
      onSelect(rest[0]?.id ?? stationery[0]?.id ?? "");
    }
  }

  return (
    <div className="grid gap-4">
      <FormSection
        title="Stationery"
        description="Repeats on every page; switch off to hide."
      >
        <div className="grid grid-cols-1 gap-2">
          {stationery.map((b) => (
            <div
              key={b.id}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5",
                selectedId === b.id && "border-ring bg-accent/40",
              )}
            >
              <Switch
                id={`st-${b.id}`}
                checked={!b.hidden}
                onCheckedChange={(on) =>
                  patch(b.id, { hidden: on ? undefined : true })
                }
                aria-label={`Show ${BLOCK_INFO[b.type].label}`}
              />
              <Label htmlFor={`st-${b.id}`} className="sr-only">
                Show {BLOCK_INFO[b.type].label}
              </Label>
              <button
                type="button"
                onClick={() => onSelect(b.id)}
                className="text-foreground min-w-0 flex-1 truncate text-left text-sm font-medium"
              >
                {BLOCK_INFO[b.type].label}
              </button>
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Content"
        description="Printed top to bottom. Drag to reorder."
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Plus className="size-4" />
                Add block
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {ADDABLE_BLOCK_TYPES.map((info) => (
                <DropdownMenuItem
                  key={info.type}
                  onSelect={() => onAdd(info.type)}
                >
                  <div className="grid gap-0.5">
                    <span>{info.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {info.description}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        {flow.length === 0 ? (
          <p className="text-muted-foreground py-2">
            No content blocks. Add one to start.
          </p>
        ) : (
          <DndContext
            id="pdf-template-blocks"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={flow.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid grid-cols-1 gap-1.5">
                {flow.map((b) => {
                  const summary = blockSummary(b);
                  return (
                    <Sortable key={b.id} id={b.id}>
                      {(handle) => (
                        <div
                          data-block-id={b.id}
                          className={cn(
                            "bg-card flex items-center gap-1.5 rounded-md border px-1.5 py-1",
                            selectedId === b.id && "border-ring bg-accent/40",
                            b.hidden && "opacity-60",
                          )}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground cursor-grab"
                            aria-label={`Drag ${BLOCK_INFO[b.type].label}`}
                            {...handle}
                          >
                            <GripVertical className="size-4" />
                          </Button>
                          <button
                            type="button"
                            onClick={() => onSelect(b.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="text-muted-foreground text-admin-2xs block font-mono tracking-[0.12em] uppercase">
                              {BLOCK_INFO[b.type].label}
                            </span>
                            <span className="text-foreground block truncate text-sm">
                              {summary || (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </span>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground"
                            onClick={() =>
                              patch(b.id, {
                                hidden: b.hidden ? undefined : true,
                              })
                            }
                            aria-label={b.hidden ? "Show block" : "Hide block"}
                          >
                            {b.hidden ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground"
                            onClick={() => duplicate(b)}
                            aria-label="Duplicate block"
                          >
                            <Copy className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => remove(b)}
                            aria-label="Delete block"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </Sortable>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </FormSection>

      <FormSection
        title="Stamps"
        description="Seal, signature, name stamp — placed anywhere on the sheet."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAdd("stamp")}
          >
            <Plus className="size-4" />
            Add stamp
          </Button>
        }
      >
        {stamps.length === 0 ? (
          <p className="text-muted-foreground py-2">
            No stamps. Documents print without a seal or signature.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-1.5">
            {stamps.map((b) => {
              const asset = assets.find((a) => a.id === b.props.assetId);
              return (
                <div
                  key={b.id}
                  data-block-id={b.id}
                  className={cn(
                    "bg-card flex items-center gap-1.5 rounded-md border px-1.5 py-1",
                    selectedId === b.id && "border-ring bg-accent/40",
                    b.hidden && "opacity-60",
                  )}
                >
                  <Stamp className="text-muted-foreground mx-1 size-4 shrink-0" />
                  <button
                    type="button"
                    onClick={() => onSelect(b.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="text-muted-foreground text-admin-2xs block font-mono tracking-[0.12em] uppercase">
                      {b.props.anchor === "block"
                        ? (() => {
                            const t = blocks.find(
                              (x) => x.id === b.props.blockId,
                            );
                            return t
                              ? `On ${BLOCK_INFO[t.type].label}`
                              : "Block missing";
                          })()
                        : b.props.pages === "all"
                          ? "Every page"
                          : b.props.pages === "first"
                            ? "First page"
                            : "Last page"}
                    </span>
                    <span className="text-foreground block truncate text-sm">
                      {asset?.name ?? (
                        <span className="text-muted-foreground">
                          No image chosen
                        </span>
                      )}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    onClick={() =>
                      patch(b.id, { hidden: b.hidden ? undefined : true })
                    }
                    aria-label={b.hidden ? "Show stamp" : "Hide stamp"}
                  >
                    {b.hidden ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(b)}
                    aria-label="Delete stamp"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </FormSection>
    </div>
  );
}
