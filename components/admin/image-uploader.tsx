"use client";

import { useState } from "react";
import Image from "next/image";

export function ImageUploader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) onChange([...value, json.data.url]);
    else setError(json?.error?.code ?? "upload_failed");
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {value.map((url, i) => (
          <div
            key={url}
            style={{
              position: "relative",
              width: 80,
              height: 80,
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid var(--color-border)",
            }}
          >
            <Image
              src={url}
              alt=""
              fill
              sizes="80px"
              style={{ objectFit: "cover" }}
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label="Remove"
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 20,
                height: 20,
                borderRadius: 999,
                border: 0,
                background: "rgba(0,0,0,.6)",
                color: "#fff",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
        <label
          style={{
            width: 80,
            height: 80,
            display: "grid",
            placeItems: "center",
            border: "1px dashed var(--color-border)",
            borderRadius: 8,
            cursor: "pointer",
            color: "var(--color-text-muted)",
            fontSize: 24,
          }}
        >
          {busy ? "…" : "+"}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {error && (
        <span
          style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
