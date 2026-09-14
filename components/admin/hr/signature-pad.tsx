"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * How a signature gets into the system: an image file (photo or scan of a
 * signature, or a transparent PNG) or a drawing on a pad. Either way the
 * result is a PNG data URL no wider than 1000px, which is what the API
 * stores — the same shape whether the admin adds it on the employee's page
 * or the person adds it in their portal.
 */
const MAX_WIDTH = 1000;

/** Any image the browser can decode → a PNG data URL, downscaled. */
export async function fileToSignaturePng(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not an image");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

/** The pad's strokes → a PNG cropped to the ink, with a little air around it. */
function padToPng(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 12;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(width, maxX + pad) - sx;
  const sh = Math.min(height, maxY + pad) - sy;
  const out = document.createElement("canvas");
  const scale = Math.min(1, MAX_WIDTH / sw);
  out.width = Math.max(1, Math.round(sw * scale));
  out.height = Math.max(1, Math.round(sh * scale));
  const octx = out.getContext("2d");
  if (!octx) return null;
  octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

/** A drawing surface sized to its box, ink in near-black, transparent ground. */
export function SignaturePadDialog({
  open,
  onCancel,
  onDone,
}: {
  open: boolean;
  onCancel: () => void;
  onDone: (png: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const hasInkRef = useRef(false);

  // The bitmap matches the box at device resolution. The dialog's portal
  // mounts a render after `open` flips, so an effect on `open` never sees
  // the canvas — it is sized from the ref callback when the element
  // appears, again if the box changes before any ink, and checked once
  // more on the first stroke, the only moment the size truly matters.
  const fit = (canvas: HTMLCanvasElement) => {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    // Layout size, not the bounding rect: the dialog zooms in as it opens
    // and a rect read mid-animation is 95% of the real box.
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (w < 1 || h < 1 || (canvas.width === w && canvas.height === h)) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#101828";
    }
  };
  const observer = useRef<ResizeObserver | null>(null);
  const setCanvas = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    fit(el);
    observer.current = new ResizeObserver(() => {
      if (!drawing.current && !hasInkRef.current) fit(el);
    });
    observer.current.observe(el);
  }, []);
  useEffect(() => {
    if (!open) return;
    hasInkRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a fresh pad each time it opens
    setHasInk(false);
  }, [open]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasInkRef.current) fit(e.currentTarget);
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    hasInkRef.current = true;
    last.current = point(e);
    const ctx = e.currentTarget.getContext("2d");
    if (ctx && last.current) {
      // A tap leaves a dot, so a dotted "i" is not lost.
      ctx.beginPath();
      ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = "#101828";
      ctx.fill();
      setHasInk(true);
    }
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    // Slightly heavier when pressed harder on a pen; a mouse reports 0.5.
    ctx.lineWidth = 1.6 + (e.pressure > 0 ? e.pressure : 0.5) * 1.8;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }
  function up() {
    drawing.current = false;
    last.current = null;
  }
  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false;
    setHasInk(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Draw your signature</DialogTitle>
          <DialogDescription>
            Sign in the box with a mouse, finger or pen, the way you sign on
            paper. It is stored encrypted and placed into documents you sign.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <canvas
            ref={setCanvas}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={up}
            aria-label="Signature drawing area"
            className="bg-background h-48 w-full cursor-crosshair touch-none rounded-md border"
            style={{
              backgroundImage:
                "linear-gradient(transparent 70%, var(--color-border) 70%, var(--color-border) calc(70% + 1px), transparent calc(70% + 1px))",
            }}
          />
          {!hasInk && (
            <span className="text-muted-foreground pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs">
              Sign here
            </span>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={clear}
            disabled={!hasInk}
          >
            <Eraser className="size-4" /> Clear
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!hasInk}
              onClick={() => {
                const png = canvasRef.current && padToPng(canvasRef.current);
                if (png) onDone(png);
              }}
            >
              Use this signature
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The two ways in, as buttons: pick an image file, or open the pad. Calls
 * `onPick` with the PNG data URL and where it came from.
 */
export function SignaturePicker({
  onPick,
  disabled,
  uploadLabel = "Upload image",
  drawLabel = "Draw",
  size = "sm",
}: {
  onPick: (png: string, source: "upload" | "draw") => void;
  disabled?: boolean;
  uploadLabel?: string;
  drawLabel?: string;
  size?: "sm" | "default";
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      onPick(await fileToSignaturePng(file), "upload");
    } catch {
      setError("That file is not an image the browser can read.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="size-4" /> {uploadLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={disabled}
        onClick={() => setDrawOpen(true)}
      >
        <PenLine className="size-4" /> {drawLabel}
      </Button>
      {error && <span className="text-destructive text-xs">{error}</span>}
      <SignaturePadDialog
        open={drawOpen}
        onCancel={() => setDrawOpen(false)}
        onDone={(png) => {
          setDrawOpen(false);
          onPick(png, "draw");
        }}
      />
    </div>
  );
}
