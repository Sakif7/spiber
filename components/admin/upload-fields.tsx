"use client";

import { useState } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { uploadErrorMessage } from "./upload-error";

/**
 * The file-picker button every admin uploader shares: a shadcn Button wrapping
 * a hidden `<input type="file">`, so a click anywhere on it opens the picker
 * and the control still looks like the rest of the admin.
 */
export function UploadButton({
  onFile,
  busy,
  label = "Upload",
  busyLabel = "Uploading…",
  accept = "image/*",
  variant = "outline",
  size = "sm",
  className,
}: {
  onFile: (file: File) => void;
  busy?: boolean;
  label?: string;
  busyLabel?: string;
  accept?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={cn("w-fit", className)}
    >
      <label className={busy ? "" : "cursor-pointer"}>
        <Upload className="size-4" />
        {busy ? busyLabel : label}
        <input
          type="file"
          accept={accept}
          hidden
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>
    </Button>
  );
}

/**
 * Reusable single public-image upload control for admin forms (gallery cover,
 * event cover, course thumbnail, …). Posts to /api/admin/uploads and stores the
 * returned public `url`.
 */
export function SingleImageField({
  value,
  onChange,
  label = "Upload",
  endpoint = "/api/admin/uploads",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  /** Upload endpoint — admin forms use the default; the seller portal passes
   * its own `requireSeller`-gated `/api/seller/uploads`. */
  endpoint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(endpoint, { method: "POST", body: fd });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) onChange(json.data.url);
    else setError(uploadErrorMessage(json?.error?.code));
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        {value && (
          <div className="border-border relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-md border">
            <Image
              src={value}
              alt=""
              fill
              sizes="120px"
              style={{ objectFit: "cover" }}
            />
          </div>
        )}
        <UploadButton
          onFile={upload}
          busy={busy}
          label={value ? "Replace" : label}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onChange("")}
          >
            Remove
          </Button>
        )}
      </div>
      {error && <p className="text-destructive text-[13px]">{error}</p>}
    </div>
  );
}
