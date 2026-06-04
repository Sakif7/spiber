import {
  Stethoscope,
  HeartPulse,
  Cpu,
  Sofa,
  Baby,
  Car,
  Wheat,
  BookOpen,
  Globe,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { localize, type Localized } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

const ICONS: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  "heart-pulse": HeartPulse,
  cpu: Cpu,
  sofa: Sofa,
  baby: Baby,
  car: Car,
  wheat: Wheat,
  "book-open": BookOpen,
  globe: Globe,
};

export type GridCategory = {
  id: string;
  name: Localized;
  slug: string;
  icon?: string;
  childCount: number;
};

/** Category-first home grid (Amazon/Daraz-style). No "Spiber" prefix. */
export function CategoryMegaGrid({
  categories,
  locale,
}: {
  categories: GridCategory[];
  locale: Locale;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: "var(--s-3)",
      }}
    >
      {categories.map((c) => {
        const Icon = (c.icon && ICONS[c.icon]) || Boxes;
        return (
          <Link
            key={c.id}
            href={`/marketplace/category/${c.slug}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "var(--s-5) var(--s-3)",
              borderRadius: "var(--r-lg)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              textAlign: "center",
              transition:
                "transform 200ms var(--ease-out-expo), box-shadow 200ms",
            }}
            className="mp-cat-tile"
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 52,
                height: 52,
                borderRadius: "var(--r-pill)",
                background: "var(--color-brand-soft)",
                color: "var(--color-brand-deep)",
              }}
            >
              <Icon size={24} strokeWidth={1.7} aria-hidden />
            </span>
            <span
              style={{
                fontWeight: 600,
                fontSize: "var(--fs-body-sm)",
                color: "var(--color-text-strong)",
              }}
            >
              {localize(c.name, locale)}
            </span>
            {c.childCount > 0 && (
              <span
                style={{
                  fontSize: "var(--fs-caption)",
                  color: "var(--color-text-muted)",
                }}
              >
                {c.childCount}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
