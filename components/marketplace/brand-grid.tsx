import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { localize, type Localized } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

export type BrandTile = {
  id: string;
  name: Localized;
  slug: string;
  logo?: string | null;
};

/**
 * "Shop by brand" grid — brand logo tiles (with a clean monogram fallback when a
 * brand has no logo). Each tile deep-links to the Shop page filtered to that
 * brand. Reuses the `.mp-cat-tile` hover treatment shared with the category grid.
 */
export function BrandGrid({
  brands,
  locale,
}: {
  brands: BrandTile[];
  locale: Locale;
}) {
  if (brands.length === 0) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: "var(--s-3)",
      }}
    >
      {brands.map((b) => {
        const name = localize(b.name, locale);
        const monogram =
          name
            .replace(/[^\p{L}\p{N}]/gu, "")
            .slice(0, 2)
            .toUpperCase() || "•";
        return (
          <Link
            key={b.id}
            href={`/kart/shop?brand=${b.id}`}
            className="mp-cat-tile"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "var(--s-5) var(--s-3)",
              borderRadius: "var(--r-lg)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              textAlign: "center",
              textDecoration: "none",
              transition:
                "transform 200ms var(--ease-out-expo), box-shadow 200ms",
            }}
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: "100%",
                height: 48,
              }}
            >
              {b.logo ? (
                <span
                  style={{ position: "relative", width: "80%", height: 44 }}
                >
                  <Image
                    src={b.logo}
                    alt={name}
                    fill
                    sizes="150px"
                    style={{ objectFit: "contain" }}
                  />
                </span>
              ) : (
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 48,
                    height: 48,
                    borderRadius: "var(--r-pill)",
                    background: "var(--color-brand-soft)",
                    color: "var(--color-brand-deep)",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  {monogram}
                </span>
              )}
            </span>
            <span
              style={{
                fontWeight: 600,
                fontSize: "var(--fs-body-sm)",
                color: "var(--color-text-strong)",
              }}
            >
              {name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
