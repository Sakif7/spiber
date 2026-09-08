"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadButton } from "./upload-fields";
import { uploadErrorMessage } from "./upload-error";

// Re-exported so existing importers keep working after the helper moved out.
export { uploadErrorMessage };

export function ImageUploader({
  value,
  onChange,
  endpoint = "/api/admin/uploads",
}: {
  value: string[];
  onChange: (urls: string[]) => void;
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
    if (res.ok && json?.ok) onChange([...value, json.data.url]);
    else setError(uploadErrorMessage(json?.error?.code));
  }

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url, i) => (
            <div
              key={url}
              className="border-border relative size-20 shrink-0 overflow-hidden rounded-md border"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="80px"
                style={{ objectFit: "cover" }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove image ${i + 1}`}
                title="Remove"
                className="absolute top-1 right-1 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      )}
      <UploadButton
        onFile={upload}
        busy={busy}
        label={value.length > 0 ? "Add image" : "Upload image"}
      />
      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}
