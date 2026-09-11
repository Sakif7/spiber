"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, FormGrid } from "@/components/admin/ui/form-shell";
import { SelectField } from "@/components/admin/ui/select-field";
import { formatApiError } from "@/lib/http/form-error";
import { cn } from "@/lib/cn";
import { BLOCK_INFO, blockSummary } from "@/lib/pdf/engine/catalogue";
import {
  FIXED_BLOCK_TYPES,
  OVERLAY_BLOCK_TYPES,
  PAGE_HEIGHT_PT,
  PAGE_WIDTH_PT,
  type Block,
  type BlockOf,
  type Theme,
} from "@/lib/schemas/pdf-template";
import { NumberField } from "./fields";
import { usePageRaster } from "./page-raster";
import type { PdfPreview } from "./use-pdf-preview";

export type StampAssetSummary = {
  id: string;
  name: string;
  width: number;
  height: number;
};

const ASSETS_API = "/api/admin/company/pdf-templates/assets";

export const assetImageUrl = (id: string) => `${ASSETS_API}/${id}`;

/**
 * The stamp inspector: which image, where it is anchored, how big — and its
 * position, by dragging it on an outline. The outline is not the rendered
 * document (a PDF in an iframe cannot be dragged over); the preview beside
 * it updates as soon as the drag ends.
 *
 * Anchored to the page, the outline is the A4 sheet. Anchored to a block, it
 * is that block's own box — for the signature row, the two signature lines
 * at their real positions, so a signature can be dropped onto its line and
 * will stay on it whichever page the row ends up on.
 */
export function StampForm({
  block,
  blocks,
  theme,
  assets,
  preview,
  onProps,
  onAssetUploaded,
}: {
  block: BlockOf<"stamp">;
  /** Every block, for the anchor picker and the pad. */
  blocks: Block[];
  theme: Theme;
  assets: StampAssetSummary[];
  preview: PdfPreview;
  onProps: (patch: Partial<BlockOf<"stamp">["props"]>) => void;
  onAssetUploaded: (asset: StampAssetSummary) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const asset = assets.find((a) => a.id === block.props.assetId) ?? null;
  const anchorable = blocks.filter(
    (b) => !FIXED_BLOCK_TYPES.has(b.type) && !OVERLAY_BLOCK_TYPES.has(b.type),
  );
  const target = anchorable.find((b) => b.id === block.props.blockId) ?? null;
  const anchoredToBlock = block.props.anchor === "block";

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name.replace(/\.png$/i, ""));
      const res = await fetch(ASSETS_API, { method: "POST", body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(formatApiError(json));
      const created = json.data as StampAssetSummary;
      onAssetUploaded(created);
      onProps({ assetId: created.id });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function setAnchor(anchor: "page" | "block") {
    if (anchor === block.props.anchor) return;
    if (anchor === "block") {
      // Default to the signature row — where a signature goes — and start
      // the stamp just above its left line.
      const sign = anchorable.find((b) => b.type === "signOff");
      onProps({
        anchor,
        blockId: block.props.blockId ?? sign?.id ?? anchorable[0]?.id,
        x: 0,
        y: -10,
      });
    } else {
      onProps({ anchor, x: 60, y: 700 });
    }
  }

  return (
    <>
      <FormGrid>
        <FormField
          label="Image"
          hint={
            uploadError ? (
              <span className="text-destructive">{uploadError}</span>
            ) : (
              "PNG with a transparent background, up to 2 MB. Stored encrypted."
            )
          }
        >
          {/* min-w-0 on both: a nowrap select trigger would otherwise size
              its grid cell to its full text and overflow the column. */}
          <div className="flex min-w-0 items-center gap-2">
            <SelectField
              value={block.props.assetId}
              onChange={(assetId) => onProps({ assetId })}
              options={assets.map((a) => ({
                value: a.id,
                label: `${a.name} (${a.width}×${a.height})`,
              }))}
              placeholder="Choose an image…"
              ariaLabel="Image"
              emptyLabel="— none —"
              className="min-w-0 flex-1"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/png"
              className="sr-only"
              aria-label="Upload a PNG"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </FormField>
        <FormField
          label="Anchored to"
          hint={
            anchoredToBlock
              ? "Moves with the block, whichever page it lands on."
              : "A fixed spot on the sheet, whatever the content does."
          }
        >
          <SelectField
            value={block.props.anchor}
            onChange={(v) => setAnchor(v as "page" | "block")}
            options={[
              { value: "block", label: "A block (follows it across pages)" },
              { value: "page", label: "The page (fixed spot)" },
            ]}
            className="min-w-0"
          />
        </FormField>
      </FormGrid>

      <FormGrid>
        {anchoredToBlock ? (
          <FormField
            label="Block"
            hint={
              target ? undefined : (
                <span className="text-[var(--tone-warning-fg)]">
                  That block no longer exists — the stamp will not print.
                </span>
              )
            }
          >
            <SelectField
              value={target?.id ?? ""}
              onChange={(blockId) => onProps({ blockId })}
              options={anchorable.map((b) => ({
                value: b.id,
                label:
                  `${BLOCK_INFO[b.type].label} — ${blockSummary(b) || "…"}`.slice(
                    0,
                    60,
                  ),
              }))}
              placeholder="Choose a block…"
              className="min-w-0"
            />
          </FormField>
        ) : (
          <FormField label="Pages">
            <SelectField
              value={block.props.pages}
              onChange={(v) =>
                onProps({ pages: v as "all" | "first" | "last" })
              }
              options={[
                { value: "last", label: "Last page only" },
                { value: "first", label: "First page only" },
                { value: "all", label: "Every page" },
              ]}
            />
          </FormField>
        )}
        <NumberField
          label="Width (pt)"
          value={block.props.width}
          onChange={(width) => onProps({ width: width ?? 10 })}
          min={10}
          max={500}
          hint={
            asset
              ? `Height ${Math.round((block.props.width * asset.height) / asset.width)} pt`
              : undefined
          }
        />
      </FormGrid>

      <FormGrid cols={3}>
        <NumberField
          label="Opacity"
          value={block.props.opacity}
          onChange={(opacity) => onProps({ opacity: opacity ?? 1 })}
          min={0.05}
          max={1}
          step={0.05}
        />
        <NumberField
          label={
            anchoredToBlock
              ? "X from block left (pt)"
              : "X from sheet left (pt)"
          }
          value={block.props.x}
          onChange={(x) => onProps({ x: x ?? 0 })}
          min={-400}
          max={PAGE_WIDTH_PT}
          step={0.5}
        />
        <NumberField
          label={
            anchoredToBlock ? "Y from block top (pt)" : "Y from sheet top (pt)"
          }
          value={block.props.y}
          onChange={(y) => onProps({ y: y ?? 0 })}
          min={-400}
          max={PAGE_HEIGHT_PT}
          step={0.5}
          hint={anchoredToBlock ? "Negative = above the block." : undefined}
        />
      </FormGrid>

      <PositionPad
        block={block}
        blocks={blocks}
        target={target}
        theme={theme}
        assets={assets}
        preview={preview}
        onMove={(x, y) => onProps({ x, y })}
      />
    </>
  );
}

/** The area a pad shows, in page points. */
type Canvas = { x0: number; y0: number; w: number; h: number };

/**
 * The stamp is dragged on the real page.
 *
 * The pad rasterises the page the stamp is on from the very PDF the preview
 * pane shows, and reads the block boxes the server reported for it, so pixel
 * for pixel it is the preview: the stamp overlay sits exactly where the PDF
 * draws it. Anchored to the page the pad is the whole sheet; anchored to a
 * block it is the strip of the page around that block, and offsets are
 * measured from the block's own top-left. Until the first render lands (or
 * when the block is missing) it falls back to a schematic outline.
 */
function PositionPad({
  block,
  blocks,
  target,
  theme,
  assets,
  preview,
  onMove,
}: {
  block: BlockOf<"stamp">;
  blocks: Block[];
  target: Block | null;
  theme: Theme;
  assets: StampAssetSummary[];
  preview: PdfPreview;
  onMove: (x: number, y: number) => void;
}) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const anchoredToBlock = block.props.anchor === "block";
  const box = anchoredToBlock
    ? (preview.boxes.find((b) => b.id === block.props.blockId) ?? null)
    : null;
  // Which page to show: the block's, or the one the page-stamp prints on
  // (0 = last).
  const page = anchoredToBlock
    ? (box?.page ?? 0)
    : block.props.pages === "last"
      ? 0
      : 1;
  const raster = usePageRaster(preview.blob, page);
  const contentWidth = PAGE_WIDTH_PT - 2 * theme.page.padX;
  const pageW = raster?.widthPt ?? PAGE_WIDTH_PT;
  const pageH = raster?.heightPt ?? PAGE_HEIGHT_PT;

  // The block's top-left in page points — the origin the offsets are from.
  // Without a box (no render yet, block gone) the schematic uses its own
  // origin at (0, 0).
  const origin = anchoredToBlock
    ? box
      ? { x: box.left, y: box.top }
      : { x: 0, y: 0 }
    : { x: 0, y: 0 };
  const canvas: Canvas = anchoredToBlock
    ? { x0: origin.x - 40, y0: origin.y - 140, w: contentWidth + 80, h: 360 }
    : { x0: 0, y0: 0, w: pageW, h: pageH };
  const showRaster = Boolean(raster) && (!anchoredToBlock || Boolean(box));
  // The page image trails the render by a moment; say so rather than let a
  // stamp look like it is somewhere it is not.
  const rasterStale =
    showRaster && (preview.stale || raster?.source !== preview.blob);

  const scale = () => (padRef.current?.clientWidth ?? canvas.w) / canvas.w;
  const dims = (b: BlockOf<"stamp">) => {
    const a = assets.find((x) => x.id === b.props.assetId);
    const h = a ? (b.props.width * a.height) / a.width : b.props.width * 0.5;
    return { w: b.props.width, h };
  };
  const px = (pt: number) => `${((pt - canvas.x0) / canvas.w) * 100}%`;
  const py = (pt: number) => `${((pt - canvas.y0) / canvas.h) * 100}%`;
  const pw = (pt: number) => `${(pt / canvas.w) * 100}%`;
  const ph = (pt: number) => `${(pt / canvas.h) * 100}%`;

  /** Pointer position → page points. */
  const toPage = (e: React.PointerEvent, r: DOMRect) => {
    const s = scale();
    return {
      x: (e.clientX - r.left) / s + canvas.x0,
      y: (e.clientY - r.top) / s + canvas.y0,
    };
  };

  function pointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const pad = padRef.current;
    if (!pad) return;
    const p = toPage(e, pad.getBoundingClientRect());
    // Where on the stamp the pointer grabbed it, so it does not jump.
    dragRef.current = {
      dx: p.x - (origin.x + block.props.x),
      dy: p.y - (origin.y + block.props.y),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }
  function pointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const pad = padRef.current;
    const d = dragRef.current;
    if (!pad || !d) return;
    const p = toPage(e, pad.getBoundingClientRect());
    const { w, h } = dims(block);
    // Keep at least half the stamp inside the pad.
    const absX = Math.min(
      canvas.x0 + canvas.w - w / 2,
      Math.max(canvas.x0 - w / 2, p.x - d.dx),
    );
    const absY = Math.min(
      canvas.y0 + canvas.h - h / 2,
      Math.max(canvas.y0 - h / 2, p.y - d.dy),
    );
    onMove(
      Math.round((absX - origin.x) * 2) / 2,
      Math.round((absY - origin.y) * 2) / 2,
    );
  }
  function pointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function keyNudge(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 1;
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    onMove(block.props.x + d[0], block.props.y + d[1]);
  }

  // Without the real page, the other stamps on the same anchor are greyed in
  // so they can be placed relative to each other. With it, they are in the
  // picture already.
  const others = showRaster
    ? []
    : blocks.filter(
        (b): b is BlockOf<"stamp"> =>
          b.type === "stamp" &&
          b.id !== block.id &&
          !b.hidden &&
          b.props.anchor === block.props.anchor &&
          (!anchoredToBlock || b.props.blockId === block.props.blockId),
      );
  const active = dims(block);

  return (
    <FormField
      label="Position"
      hint={
        showRaster
          ? `The real ${anchoredToBlock ? "page around the block" : "page"}, as the preview renders it${
              rasterStale ? " (catching up…)" : ""
            }. Drag the stamp; arrow keys nudge by 1 pt, Shift for 10.`
          : anchoredToBlock
            ? "Drag the stamp relative to the block; the dashed line is its top edge. Arrow keys nudge by 1 pt, Shift for 10."
            : "Drag the stamp on the page; the dashed box is the print margin. Arrow keys nudge by 1 pt, Shift for 10."
      }
    >
      <div
        ref={padRef}
        // A sheet of paper, whatever the admin theme: the stamps are drawn in ink.
        className="relative w-full max-w-[520px] touch-none overflow-hidden rounded-md border bg-white shadow-xs select-none"
        style={{ aspectRatio: `${canvas.w} / ${canvas.h}` }}
        data-testid="stamp-pad"
        data-raster={showRaster ? "page" : "outline"}
        data-raster-stale={rasterStale ? "true" : undefined}
      >
        {showRaster && raster ? (
          // eslint-disable-next-line @next/next/no-img-element -- an object URL drawn by pdf.js
          <img
            src={raster.url}
            alt=""
            draggable={false}
            className={cn(
              "pointer-events-none absolute max-w-none transition-opacity",
              rasterStale && "opacity-50",
            )}
            style={{
              left: px(0),
              top: py(0),
              width: pw(raster.widthPt),
              height: ph(raster.heightPt),
            }}
          />
        ) : anchoredToBlock ? (
          <BlockOutline
            target={target}
            contentWidth={contentWidth}
            px={px}
            py={py}
            pw={pw}
          />
        ) : (
          <div
            aria-hidden
            className="absolute border border-dashed border-neutral-300"
            style={{
              left: px(theme.page.padX),
              right: px(theme.page.padX),
              top: py(theme.page.padTop),
              bottom: ph(theme.page.padBottom),
            }}
          />
        )}
        {others.map((o) => {
          const d = dims(o);
          return (
            <div
              key={o.id}
              aria-hidden
              className="absolute rounded-sm bg-neutral-300/60"
              style={{
                left: px(origin.x + o.props.x),
                top: py(origin.y + o.props.y),
                width: pw(d.w),
                height: ph(d.h),
              }}
            />
          );
        })}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Stamp position"
          aria-valuetext={`${block.props.x} pt, ${block.props.y} pt`}
          aria-valuenow={Math.round(block.props.y)}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onKeyDown={keyNudge}
          className={cn(
            "border-ring focus-visible:ring-ring/50 absolute cursor-grab rounded-sm border-2 outline-none focus-visible:ring-[3px]",
            dragging && "cursor-grabbing",
          )}
          style={{
            left: px(origin.x + block.props.x),
            top: py(origin.y + block.props.y),
            width: pw(active.w),
            height: ph(active.h),
            opacity: showRaster ? 1 : block.props.opacity,
          }}
        >
          {block.props.assetId ? (
            // eslint-disable-next-line @next/next/no-img-element -- a gated, no-store image; next/image cannot optimise it
            <img
              src={assetImageUrl(block.props.assetId)}
              alt=""
              draggable={false}
              className="pointer-events-none size-full object-fill"
              // Over the real page the stamp is already in the picture: the
              // box is the handle, and its image only shows while it moves.
              style={{ opacity: showRaster ? (dragging ? 0.7 : 0) : 1 }}
            />
          ) : (
            <div className="size-full bg-neutral-200" />
          )}
        </div>
      </div>
    </FormField>
  );
}

/**
 * The target block, schematically: its top edge and width, and for the
 * signature row its actual geometry — 215 pt boxes, 26 pt of space for a pen,
 * a 107 pt rule with the label under it (see `blocks/sign-off.tsx`).
 */
function BlockOutline({
  target,
  contentWidth,
  px,
  py,
  pw,
}: {
  target: Block | null;
  contentWidth: number;
  px: (pt: number) => string;
  py: (pt: number) => string;
  pw: (pt: number) => string;
}) {
  const edge = (
    <div
      aria-hidden
      className="absolute border-t border-dashed border-neutral-400"
      style={{ left: px(0), width: pw(contentWidth), top: py(0) }}
    />
  );
  if (!target) return edge;
  if (target.type === "signOff") {
    const boxes = [
      { left: 0, label: target.props.left },
      ...(target.props.right
        ? [{ left: contentWidth - 215, label: target.props.right }]
        : []),
    ];
    return (
      <>
        {edge}
        {boxes.map((b) => (
          <div
            key={b.left}
            aria-hidden
            className="absolute"
            style={{ left: px(b.left), top: py(26), width: pw(107) }}
          >
            <div className="border-t border-neutral-800" />
            <div className="text-center font-serif text-[7px] leading-tight font-bold text-neutral-700">
              {b.label}
            </div>
          </div>
        ))}
      </>
    );
  }
  // Any other block: a band standing in for its (unknown) height.
  return (
    <>
      {edge}
      <div
        aria-hidden
        className="absolute bg-neutral-100"
        style={{
          left: px(0),
          width: pw(contentWidth),
          top: py(0),
          height: "18%",
        }}
      />
      <div
        aria-hidden
        className="absolute text-[8px] text-neutral-400"
        style={{ left: px(4), top: py(4) }}
      >
        {BLOCK_INFO[target.type].label}
      </div>
    </>
  );
}
