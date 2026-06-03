"use client";

import { useState } from "react";
import Image from "next/image";
import { Placeholder } from "@/components/ui/placeholder";

export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const main = images[active];

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "1 / 1",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-hairline)",
        }}
      >
        {main ? (
          <Image
            src={main}
            alt={name}
            fill
            sizes="(max-width: 980px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
            priority
          />
        ) : (
          <Placeholder
            label={name}
            tone="teal"
            style={{ position: "absolute", inset: 0 }}
          />
        )}
      </div>

      {images.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-pressed={i === active}
              style={{
                position: "relative",
                width: 72,
                height: 72,
                borderRadius: "var(--r-md)",
                overflow: "hidden",
                padding: 0,
                cursor: "pointer",
                background: "var(--color-surface-2)",
                border:
                  i === active
                    ? "2px solid var(--color-brand)"
                    : "1px solid var(--color-border)",
                transition: "border-color 160ms var(--ease-out-expo)",
              }}
            >
              <Image
                src={img}
                alt=""
                fill
                sizes="72px"
                style={{ objectFit: "cover" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
