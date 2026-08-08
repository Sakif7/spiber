"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { uploadErrorMessage } from "./image-uploader";

/**
 * Reusable single public-image upload control for admin forms (gallery cover,
 * event cover, …). Posts to /api/admin/uploads and stores the returned public
 * `url`. Mirrors the blog post-editor's SingleImage, shared here so the Company
 * forms stay consistent.
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

  const btn: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: "var(--r-sm)",
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    color: "var(--color-brand-deep)",
    fontWeight: 600,
    fontSize: "var(--fs-sm)",
    cursor: busy ? "default" : "pointer",
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {value && (
          <div
            style={{
              position: "relative",
              width: 120,
              height: 68,
              borderRadius: "var(--r-sm)",
              overflow: "hidden",
              border: "1px solid var(--color-border)",
              flexShrink: 0,
            }}
          >
            <Image
              src={value}
              alt=""
              fill
              sizes="120px"
              style={{ objectFit: "cover" }}
            />
          </div>
        )}
        <label style={btn}>
          {busy ? "Uploading…" : value ? "Replace" : label}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-sm)",
              background: "var(--color-surface)",
              color: "var(--color-error)",
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Remove
          </button>
        )}
      </div>
      {error && (
        <span style={{ color: "var(--color-error)", fontSize: "var(--fs-sm)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
